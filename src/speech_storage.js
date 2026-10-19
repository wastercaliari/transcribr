// PURPOSE: Gerenciador de persistência durável de histórico de falas em SQLite com suporte a WAL e fallback resiliente.

const fs = require('fs');
const path = require('path');

let DatabaseSync = null;
try {
    DatabaseSync = require('node:sqlite').DatabaseSync;
} catch {
    DatabaseSync = null;
}

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'transcribr.sqlite');
const DEFAULT_LOG_PATH = path.join(__dirname, '..', 'transcript_log.jsonl');
const DEFAULT_RETENTION_MS = 14 * 24 * 3600 * 1000; // 14 dias

class SpeechStorage {
    /**
     * @param {Object} [options]
     * @param {string} [options.dbPath] Caminho do arquivo SQLite (ou ':memory:')
     * @param {string} [options.fallbackLogPath] Caminho do arquivo JSONL de fallback
     * @param {boolean} [options.forceFallback] Força o uso do motor JSONL para testes de compatibilidade
     * @param {boolean} [options.autoImportJsonl] Se true, importa automaticamente registros de transcript_log.jsonl se a tabela estiver vazia
     */
    constructor(options = {}) {
        this.options = options;
        this.dbPath = options.dbPath || process.env.SQLITE_DB_PATH || DEFAULT_DB_PATH;
        this.fallbackLogPath = options.fallbackLogPath || DEFAULT_LOG_PATH;
        this.isMemory = this.dbPath === ':memory:';
        this.closed = false;
        this.pendingUtterances = new Map();
        this.memoryBlocks = [];

        if (DatabaseSync && !options.forceFallback) {
            this.engine = 'sqlite';
            this._initSqlite();
        } else {
            this.engine = 'fallback_jsonl';
            this._initFallback();
        }

        if (options.autoImportJsonl && fs.existsSync(this.fallbackLogPath)) {
            try {
                this.importJsonlFile(this.fallbackLogPath);
            } catch (err) {
                console.warn('⚠️ [SpeechStorage] Falha ao auto-importar JSONL:', err.message);
            }
        }
    }

    _initSqlite() {
        if (!this.isMemory) {
            const dir = path.dirname(path.resolve(this.dbPath));
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        this.db = new DatabaseSync(this.dbPath);

        // Otimização de performance e concorrência: WAL, busy timeout e sincronização Normal
        if (!this.isMemory) {
            try {
                this.db.exec('PRAGMA busy_timeout = 5000;');
                this.db.exec('PRAGMA journal_mode = WAL;');
                this.db.exec('PRAGMA synchronous = NORMAL;');
            } catch {
                /* ignora falhas em ambientes que restrinjam PRAGMA */
            }
        }

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS speech_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                author TEXT NOT NULL,
                text TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_speech_guild_time ON speech_entries(guild_id, timestamp);

            CREATE TABLE IF NOT EXISTS speech_blocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                block_index INTEGER NOT NULL,
                start_time INTEGER NOT NULL,
                end_time INTEGER NOT NULL,
                utterance_count INTEGER NOT NULL,
                speaker_stats TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_speech_blocks_guild ON speech_blocks(guild_id, start_time);
        `);

        this.insertStmt = this.db.prepare(
            'INSERT INTO speech_entries (guild_id, author, text, timestamp) VALUES (?, ?, ?, ?)'
        );
        this.selectSinceStmt = this.db.prepare(
            'SELECT timestamp AS t, guild_id AS g, author AS a, text AS x FROM speech_entries WHERE guild_id = ? AND timestamp >= ? ORDER BY timestamp ASC'
        );
        this.pruneStmt = this.db.prepare(
            'DELETE FROM speech_entries WHERE timestamp < ?'
        );
        this.clearGuildStmt = this.db.prepare(
            'DELETE FROM speech_entries WHERE guild_id = ?'
        );
        this.countStmt = this.db.prepare(
            'SELECT COUNT(*) AS total FROM speech_entries'
        );
        this.countGuildStmt = this.db.prepare(
            'SELECT COUNT(*) AS total FROM speech_entries WHERE guild_id = ?'
        );

        this.insertBlockStmt = this.db.prepare(
            'INSERT INTO speech_blocks (guild_id, block_index, start_time, end_time, utterance_count, speaker_stats, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        this.selectBlocksStmt = this.db.prepare(
            'SELECT guild_id AS g, block_index AS bi, start_time AS st, end_time AS et, utterance_count AS uc, speaker_stats AS ss, created_at AS ca FROM speech_blocks WHERE guild_id = ? AND start_time >= ? ORDER BY block_index ASC'
        );
        this.clearGuildBlocksStmt = this.db.prepare(
            'DELETE FROM speech_blocks WHERE guild_id = ?'
        );
        this.countGuildBlocksStmt = this.db.prepare(
            'SELECT COUNT(*) AS total FROM speech_blocks WHERE guild_id = ?'
        );
    }

    _initFallback() {
        if (!this.isMemory) {
            const dir = path.dirname(path.resolve(this.fallbackLogPath));
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        this.memoryEntries = [];
    }

    /**
     * Registra uma fala de usuário no banco persistente
     */
    logLine(guildId, author, text, timestamp = Date.now()) {
        if (!guildId || !author || !text || this.closed) return false;

        const g = String(guildId);
        const a = String(author);
        const x = String(text);
        const t = Number(timestamp);

        let inserted = false;
        if (this.engine === 'sqlite') {
            try {
                this.insertStmt.run(g, a, x, t);
                inserted = true;
            } catch (err) {
                console.error('❌ [SpeechStorage] Erro ao inserir fala no SQLite:', err.message);
                return false;
            }
        } else {
            if (this.isMemory) {
                this.memoryEntries.push({ t, g, a, x });
                inserted = true;
            } else {
                try {
                    fs.appendFileSync(this.fallbackLogPath, JSON.stringify({ t, g, a, x }) + '\n', 'utf8');
                    inserted = true;
                } catch {
                    return false;
                }
            }
        }

        if (inserted) {
            let pending = this.pendingUtterances.get(g);
            if (!pending) {
                pending = [];
                this.pendingUtterances.set(g, pending);
            }
            pending.push({ t, g, a, x });
            if (pending.length >= 50) {
                const blockSlice = pending.splice(0, 50);
                this.saveBlock(g, blockSlice);
            }
        }

        return inserted;
    }

    /**
     * Recupera as falas de uma guild a partir de um timestamp
     * @returns {Array<{t: number, g: string, a: string, x: string}>}
     */
    readLog(guildId, sinceMs = 0) {
        if (!guildId || this.closed) return [];

        const g = String(guildId);
        const since = Number(sinceMs) || 0;

        if (this.engine === 'sqlite') {
            try {
                const rows = this.selectSinceStmt.all(g, since);
                return rows.map(r => ({
                    t: Number(r.t),
                    g: String(r.g),
                    a: String(r.a),
                    x: String(r.x)
                }));
            } catch (err) {
                console.error('❌ [SpeechStorage] Erro ao consultar falas no SQLite:', err.message);
                return [];
            }
        } else {
            if (this.isMemory) {
                return this.memoryEntries.filter(e => e.g === g && e.t >= since);
            }
            try {
                if (!fs.existsSync(this.fallbackLogPath)) return [];
                return fs.readFileSync(this.fallbackLogPath, 'utf8')
                    .split('\n')
                    .filter(Boolean)
                    .map(l => {
                        try { return JSON.parse(l); } catch { return null; }
                    })
                    .filter(e => e && e.g === g && e.t >= since);
            } catch {
                return [];
            }
        }
    }

    /**
     * Recupera as falas mais recentes globalmente ou de uma guild
     * @param {number} [limit=50]
     * @returns {Array<{t: number, g: string, a: string, x: string}>}
     */
    getRecentEntries(limit = 50) {
        if (this.closed) return [];
        const lim = Math.max(1, Math.min(Number(limit) || 50, 500));
        if (this.engine === 'sqlite') {
            try {
                const rows = this.db.prepare(
                    'SELECT guild_id AS g, author AS a, text AS x, timestamp AS t FROM speech_entries ORDER BY timestamp DESC LIMIT ?'
                ).all(lim);
                return rows.reverse().map(r => ({
                    t: Number(r.t),
                    g: String(r.g),
                    a: String(r.a),
                    x: String(r.x)
                }));
            } catch {
                return [];
            }
        } else {
            if (this.isMemory) {
                return this.memoryEntries.slice(-lim);
            }
            try {
                if (!fs.existsSync(this.fallbackLogPath)) return [];
                const lines = fs.readFileSync(this.fallbackLogPath, 'utf8').trim().split('\n').filter(Boolean);
                return lines.slice(-lim).map(l => {
                    try { return JSON.parse(l); } catch { return null; }
                }).filter(Boolean);
            } catch {
                return [];
            }
        }
    }

    /**
     * Remove registros antigos fora da janela de retenção
     */
    pruneLog(retentionMs = DEFAULT_RETENTION_MS) {
        if (this.closed) return 0;
        const cutoff = Date.now() - Number(retentionMs);

        if (this.engine === 'sqlite') {
            try {
                const info = this.pruneStmt.run(cutoff);
                return info.changes;
            } catch (err) {
                console.error('❌ [SpeechStorage] Erro ao podar histórico no SQLite:', err.message);
                return 0;
            }
        } else {
            if (this.isMemory) {
                const initialLen = this.memoryEntries.length;
                this.memoryEntries = this.memoryEntries.filter(e => e.t >= cutoff);
                return initialLen - this.memoryEntries.length;
            }
            try {
                if (!fs.existsSync(this.fallbackLogPath)) return 0;
                const raw = fs.readFileSync(this.fallbackLogPath, 'utf8');
                const lines = raw.split('\n').filter(Boolean);
                const keep = lines.filter(l => {
                    try { return JSON.parse(l).t >= cutoff; } catch { return false; }
                });
                fs.writeFileSync(this.fallbackLogPath, keep.length ? keep.join('\n') + '\n' : '', 'utf8');
                return lines.length - keep.length;
            } catch {
                return 0;
            }
        }
    }

    /**
     * Persiste um bloco agregado de falas (por padrão fatias de 50)
     */
    saveBlock(guildId, utterances) {
        if (!guildId || !utterances || !utterances.length || this.closed) return null;
        const g = String(guildId);
        const sorted = [...utterances].sort((a, b) => a.t - b.t);
        const startTime = sorted[0].t;
        const endTime = sorted[sorted.length - 1].t;
        const utteranceCount = sorted.length;

        const counts = {};
        for (const item of sorted) {
            const author = item.a || 'Desconhecido';
            counts[author] = (counts[author] || 0) + 1;
        }
        const speakerStats = Object.entries(counts).map(([author, count]) => ({
            author,
            count,
            percentage: Number(((count / utteranceCount) * 100).toFixed(1))
        })).sort((a, b) => b.count - a.count);

        const now = Date.now();
        const blockIndex = this.getBlockCount(g) + 1;

        if (this.engine === 'sqlite') {
            try {
                this.insertBlockStmt.run(g, blockIndex, startTime, endTime, utteranceCount, JSON.stringify(speakerStats), now);
            } catch (err) {
                console.error('❌ [SpeechStorage] Erro ao inserir bloco de falas no SQLite:', err.message);
                return null;
            }
        } else {
            if (!this.memoryBlocks) this.memoryBlocks = [];
            this.memoryBlocks.push({
                g,
                blockIndex,
                startTime,
                endTime,
                utteranceCount,
                speakerStats,
                createdAt: now
            });
        }

        return {
            guildId: g,
            blockIndex,
            startTime,
            endTime,
            utteranceCount,
            speakerStats,
            firstUtterance: sorted[0],
            lastUtterance: sorted[sorted.length - 1]
        };
    }

    /**
     * Retorna a quantidade de blocos gravados para uma guild
     */
    getBlockCount(guildId) {
        if (!guildId || this.closed) return 0;
        const g = String(guildId);
        if (this.engine === 'sqlite') {
            try {
                const row = this.countGuildBlocksStmt.get(g);
                return row ? Number(row.total) : 0;
            } catch {
                return 0;
            }
        } else {
            return (this.memoryBlocks || []).filter(b => b.g === g).length;
        }
    }

    /**
     * Retorna os blocos agregados de uma guild a partir de um timestamp
     */
    getBlocks(guildId, sinceMs = 0) {
        if (!guildId || this.closed) return [];
        const g = String(guildId);
        const since = Number(sinceMs) || 0;
        if (this.engine === 'sqlite') {
            try {
                const rows = this.selectBlocksStmt.all(g, since);
                return rows.map(r => ({
                    guildId: r.g,
                    blockIndex: Number(r.bi),
                    startTime: Number(r.st),
                    endTime: Number(r.et),
                    utteranceCount: Number(r.uc),
                    speakerStats: JSON.parse(r.ss || '[]'),
                    createdAt: Number(r.ca)
                }));
            } catch (err) {
                console.error('❌ [SpeechStorage] Erro ao buscar blocos de falas no SQLite:', err.message);
                return [];
            }
        } else {
            return (this.memoryBlocks || [])
                .filter(b => b.g === g && b.startTime >= since)
                .map(b => ({ ...b }));
        }
    }

    /**
     * Limpa o histórico de falas de uma guild específica (usado por /limpar)
     */
    clearGuild(guildId) {
        if (!guildId || this.closed) return 0;
        const g = String(guildId);
        this.pendingUtterances.delete(g);

        if (this.engine === 'sqlite') {
            try {
                this.clearGuildBlocksStmt.run(g);
                const info = this.clearGuildStmt.run(g);
                return info.changes;
            } catch (err) {
                console.error('❌ [SpeechStorage] Erro ao limpar guild no SQLite:', err.message);
                return 0;
            }
        } else {
            this.memoryBlocks = (this.memoryBlocks || []).filter(b => b.g !== g);
            if (this.isMemory) {
                const initialLen = this.memoryEntries.length;
                this.memoryEntries = this.memoryEntries.filter(e => e.g !== g);
                return initialLen - this.memoryEntries.length;
            }
            try {
                if (!fs.existsSync(this.fallbackLogPath)) return 0;
                const lines = fs.readFileSync(this.fallbackLogPath, 'utf8').split('\n').filter(Boolean);
                const keep = lines.filter(l => {
                    try { return JSON.parse(l).g !== g; } catch { return true; }
                });
                fs.writeFileSync(this.fallbackLogPath, keep.length ? keep.join('\n') + '\n' : '', 'utf8');
                return lines.length - keep.length;
            } catch {
                return 0;
            }
        }
    }

    /**
     * Importa registros de um arquivo transcript_log.jsonl existente para o SQLite
     */
    importJsonlFile(filePath) {
        if (!fs.existsSync(filePath) || this.closed) return 0;
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        let imported = 0;

        if (this.engine === 'sqlite') {
            this.db.exec('BEGIN TRANSACTION;');
            try {
                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line);
                        if (entry && entry.g && entry.a && entry.x) {
                            this.insertStmt.run(String(entry.g), String(entry.a), String(entry.x), Number(entry.t || Date.now()));
                            imported++;
                        }
                    } catch {
                        /* ignora linha corrompida */
                    }
                }
                this.db.exec('COMMIT;');
            } catch (err) {
                this.db.exec('ROLLBACK;');
                throw err;
            }
        } else {
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    if (entry && entry.g && entry.a && entry.x) {
                        this.logLine(entry.g, entry.a, entry.x, entry.t);
                        imported++;
                    }
                } catch {
                    /* ignora linha corrompida */
                }
            }
        }

        return imported;
    }

    /**
     * Retorna estatísticas de armazenamento e do motor
     */
    getStats(guildId = null) {
        if (this.closed) return { closed: true, engine: this.engine };

        let total = 0;
        let guildTotal = 0;

        if (this.engine === 'sqlite') {
            try {
                const totalRow = this.countStmt.get();
                total = totalRow ? Number(totalRow.total) : 0;
                if (guildId) {
                    const guildRow = this.countGuildStmt.get(String(guildId));
                    guildTotal = guildRow ? Number(guildRow.total) : 0;
                }
            } catch {
                /* ignora */
            }
        } else {
            if (this.isMemory) {
                total = this.memoryEntries.length;
                guildTotal = guildId ? this.memoryEntries.filter(e => e.g === String(guildId)).length : 0;
            } else {
                try {
                    if (fs.existsSync(this.fallbackLogPath)) {
                        const lines = fs.readFileSync(this.fallbackLogPath, 'utf8').split('\n').filter(Boolean);
                        total = lines.length;
                        if (guildId) {
                            guildTotal = lines.filter(l => {
                                try { return JSON.parse(l).g === String(guildId); } catch { return false; }
                            }).length;
                        }
                    }
                } catch {
                    /* ignora */
                }
            }
        }

        return {
            engine: this.engine,
            dbPath: this.dbPath,
            fallbackLogPath: this.fallbackLogPath,
            totalEntries: total,
            guildEntries: guildTotal,
            isMemory: this.isMemory
        };
    }

    /**
     * Encerra a conexão com o banco de dados
     */
    close() {
        if (this.closed) return;
        this.closed = true;
        if (this.engine === 'sqlite' && this.db) {
            try {
                this.db.close();
            } catch {
                /* ignora */
            }
        }
    }
}

// Instância padrão do bot: em testes usa memória isolada para evitar travas concorrentes no disco
const defaultDbPath = process.env.NODE_ENV === 'test' ? ':memory:' : (process.env.SQLITE_DB_PATH || DEFAULT_DB_PATH);
const defaultSpeechStorage = new SpeechStorage({
    dbPath: defaultDbPath,
    autoImportJsonl: process.env.NODE_ENV !== 'test'
});

/**
 * Agrupa uma lista cronológica de falas em blocos de tamanho fixo (padrão 50 falas)
 * com cálculo de estatísticas matemáticas exatas de participação por autor e timestamps.
 *
 * @param {Array<{t: number, g: string, a: string, x: string}>} entries
 * @param {number} [blockSize=50]
 * @returns {{
 *   blocks: Array<{
 *     blockIndex: number,
 *     startTime: number,
 *     endTime: number,
 *     durationSeconds: number,
 *     utteranceCount: number,
 *     speakerCounts: Record<string, number>,
 *     speakerStats: Array<{ author: string, count: number, percentage: number }>,
 *     firstUtterance: { t: number, a: string, x: string },
 *     lastUtterance: { t: number, a: string, x: string },
 *     entries: Array<{t: number, g: string, a: string, x: string}>
 *   }>,
 *   overallStats: Array<{ author: string, count: number, percentage: number, firstTime: number, lastTime: number }>,
 *   totalUtterances: number,
 *   startTime: number,
 *   endTime: number,
 *   totalDurationSeconds: number
 * }}
 */
function aggregateUtterancesIntoBlocks(entries, blockSize = 50) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return {
            blocks: [],
            overallStats: [],
            totalUtterances: 0,
            startTime: 0,
            endTime: 0,
            totalDurationSeconds: 0
        };
    }

    const size = Math.max(1, Number(blockSize) || 50);
    const totalUtterances = entries.length;
    const sorted = [...entries].sort((a, b) => a.t - b.t);
    const startTime = sorted[0].t;
    const endTime = sorted[sorted.length - 1].t;
    const totalDurationSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));

    // Estatísticas globais consolidadas
    const globalCounts = new Map();
    const globalFirstTime = new Map();
    const globalLastTime = new Map();

    for (const e of sorted) {
        const author = e.a || 'Desconhecido';
        globalCounts.set(author, (globalCounts.get(author) || 0) + 1);
        if (!globalFirstTime.has(author)) globalFirstTime.set(author, e.t);
        globalLastTime.set(author, e.t);
    }

    const overallStats = Array.from(globalCounts.entries())
        .map(([author, count]) => ({
            author,
            count,
            percentage: Number(((count / totalUtterances) * 100).toFixed(1)),
            firstTime: globalFirstTime.get(author),
            lastTime: globalLastTime.get(author)
        }))
        .sort((a, b) => b.count - a.count);

    // Divisão em blocos de até blockSize falas
    const blocks = [];
    let blockIndex = 1;

    for (let i = 0; i < sorted.length; i += size) {
        const slice = sorted.slice(i, i + size);
        const bStart = slice[0].t;
        const bEnd = slice[slice.length - 1].t;
        const bDuration = Math.max(0, Math.round((bEnd - bStart) / 1000));

        const counts = {};
        for (const item of slice) {
            const author = item.a || 'Desconhecido';
            counts[author] = (counts[author] || 0) + 1;
        }

        const stats = Object.entries(counts)
            .map(([author, count]) => ({
                author,
                count,
                percentage: Number(((count / slice.length) * 100).toFixed(1))
            }))
            .sort((a, b) => b.count - a.count);

        blocks.push({
            blockIndex,
            startTime: bStart,
            endTime: bEnd,
            durationSeconds: bDuration,
            utteranceCount: slice.length,
            speakerCounts: counts,
            speakerStats: stats,
            firstUtterance: slice[0],
            lastUtterance: slice[slice.length - 1],
            entries: slice
        });
        blockIndex++;
    }

    return {
        blocks,
        overallStats,
        totalUtterances,
        startTime,
        endTime,
        totalDurationSeconds
    };
}

module.exports = {
    SpeechStorage,
    speechStorage: defaultSpeechStorage,
    DEFAULT_RETENTION_MS,
    DEFAULT_DB_PATH,
    isSqliteSupported: !!DatabaseSync,
    aggregateUtterancesIntoBlocks
};
