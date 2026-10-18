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

        // Otimização de performance: WAL (Write-Ahead Logging) e sincronização Normal
        if (!this.isMemory) {
            try {
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

        if (this.engine === 'sqlite') {
            try {
                this.insertStmt.run(g, a, x, t);
                return true;
            } catch (err) {
                console.error('❌ [SpeechStorage] Erro ao inserir fala no SQLite:', err.message);
                return false;
            }
        } else {
            if (this.isMemory) {
                this.memoryEntries.push({ t, g, a, x });
            } else {
                try {
                    fs.appendFileSync(this.fallbackLogPath, JSON.stringify({ t, g, a, x }) + '\n', 'utf8');
                } catch {
                    return false;
                }
            }
            return true;
        }
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
     * Limpa o histórico de falas de uma guild específica (usado por /limpar)
     */
    clearGuild(guildId) {
        if (!guildId || this.closed) return 0;
        const g = String(guildId);

        if (this.engine === 'sqlite') {
            try {
                const info = this.clearGuildStmt.run(g);
                return info.changes;
            } catch (err) {
                console.error('❌ [SpeechStorage] Erro ao limpar guild no SQLite:', err.message);
                return 0;
            }
        } else {
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

// Instância padrão do bot com auto-importação transparente do JSONL legado
const defaultSpeechStorage = new SpeechStorage({ autoImportJsonl: true });

module.exports = {
    SpeechStorage,
    speechStorage: defaultSpeechStorage,
    DEFAULT_RETENTION_MS,
    DEFAULT_DB_PATH
};
