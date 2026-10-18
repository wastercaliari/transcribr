const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SpeechStorage } = require('../src/speech_storage');

test('Speech Storage Module (SCRUM-54)', async (t) => {
    await t.test('Modo SQLite em memória (:memory:)', async (t2) => {
        const storage = new SpeechStorage({ dbPath: ':memory:' });

        await t2.test('deve inicializar com o motor correto e tabela vazia', () => {
            const stats = storage.getStats();
            assert.strictEqual(stats.engine, 'sqlite');
            assert.strictEqual(stats.totalEntries, 0);
            assert.strictEqual(stats.isMemory, true);
        });

        await t2.test('deve registrar falas e consultar por timestamp', () => {
            const baseTime = 1700000000000;
            const ok1 = storage.logLine('guild-1', 'Alice', 'Olá mundo!', baseTime);
            const ok2 = storage.logLine('guild-1', 'Bob', 'Oi Alice, tudo bem?', baseTime + 1000);
            const ok3 = storage.logLine('guild-2', 'Carlos', 'Outra conversa', baseTime + 2000);

            assert.strictEqual(ok1, true);
            assert.strictEqual(ok2, true);
            assert.strictEqual(ok3, true);

            const allGuild1 = storage.readLog('guild-1', 0);
            assert.strictEqual(allGuild1.length, 2);
            assert.strictEqual(allGuild1[0].a, 'Alice');
            assert.strictEqual(allGuild1[0].x, 'Olá mundo!');
            assert.strictEqual(allGuild1[1].a, 'Bob');

            // Filtragem por tempo
            const recentGuild1 = storage.readLog('guild-1', baseTime + 500);
            assert.strictEqual(recentGuild1.length, 1);
            assert.strictEqual(recentGuild1[0].a, 'Bob');

            // Guild diferente isolada
            const allGuild2 = storage.readLog('guild-2', 0);
            assert.strictEqual(allGuild2.length, 1);
            assert.strictEqual(allGuild2[0].a, 'Carlos');
        });

        await t2.test('deve podar falas antigas respeitando o cutoff de retenção', () => {
            const now = Date.now();
            // Registra 1 antiga e 1 recente
            storage.logLine('guild-3', 'Dave', 'Mensagem velha', now - (20 * 24 * 3600 * 1000));
            storage.logLine('guild-3', 'Dave', 'Mensagem nova', now);

            const pruned = storage.pruneLog(14 * 24 * 3600 * 1000);
            assert.ok(pruned >= 1, 'Deve podar pelo menos a mensagem velha');

            const remaining = storage.readLog('guild-3', 0);
            assert.strictEqual(remaining.length, 1);
            assert.strictEqual(remaining[0].x, 'Mensagem nova');
        });

        await t2.test('deve limpar dados de uma guild específica sem afetar as demais', () => {
            storage.logLine('guild-del', 'Eve', 'Teste apagar 1', Date.now());
            storage.logLine('guild-del', 'Eve', 'Teste apagar 2', Date.now());
            storage.logLine('guild-keep', 'Frank', 'Fica aqui', Date.now());

            const deleted = storage.clearGuild('guild-del');
            assert.strictEqual(deleted, 2);
            assert.strictEqual(storage.readLog('guild-del', 0).length, 0);
            assert.strictEqual(storage.readLog('guild-keep', 0).length, 1);
        });

        await t2.test('deve rejeitar entradas vazias ou nulas com segurança', () => {
            assert.strictEqual(storage.logLine(null, 'Alice', 'Texto'), false);
            assert.strictEqual(storage.logLine('guild-1', '', 'Texto'), false);
            assert.strictEqual(storage.logLine('guild-1', 'Alice', ''), false);
            assert.deepStrictEqual(storage.readLog(''), []);
        });

        storage.close();
    });

    await t.test('Modo Persistente em Arquivo SQLite com WAL e Importação JSONL', async (t2) => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribr-db-'));
        const dbPath = path.join(tmpDir, 'test.sqlite');
        const jsonlPath = path.join(tmpDir, 'legacy_log.jsonl');

        // Cria arquivo JSONL legado simulado
        const legacyEntries = [
            { t: 1700000001000, g: 'guild-legacy', a: 'User1', x: 'Primeira fala legada' },
            { t: 1700000002000, g: 'guild-legacy', a: 'User2', x: 'Segunda fala legada' },
            'linha corrompida invalida'
        ];
        fs.writeFileSync(jsonlPath, legacyEntries.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('\n') + '\n', 'utf8');

        const storage = new SpeechStorage({ dbPath, fallbackLogPath: jsonlPath, autoImportJsonl: true });

        await t2.test('deve auto-importar linhas válidas ignorando linhas corrompidas', () => {
            const entries = storage.readLog('guild-legacy', 0);
            assert.strictEqual(entries.length, 2);
            assert.strictEqual(entries[0].x, 'Primeira fala legada');
            assert.strictEqual(entries[1].x, 'Segunda fala legada');
        });

        await t2.test('deve persistir novas falas no arquivo em disco', () => {
            storage.logLine('guild-legacy', 'User3', 'Fala adicionada no SQLite', Date.now());
            assert.strictEqual(storage.readLog('guild-legacy', 0).length, 3);
            assert.ok(fs.existsSync(dbPath), 'Arquivo SQLite deve existir no disco');
        });

        storage.close();

        await t2.test('deve recuperar os dados ao reabrir a conexão no mesmo arquivo', () => {
            const reloaded = new SpeechStorage({ dbPath, autoImportJsonl: false });
            const entries = reloaded.readLog('guild-legacy', 0);
            assert.strictEqual(entries.length, 3);
            reloaded.close();
        });

        // Limpeza dos arquivos temporários
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignora */ }
    });

    await t.test('Modo Fallback Estruturado (Compatibilidade Node legacy)', async (t2) => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribr-fallback-'));
        const fallbackLogPath = path.join(tmpDir, 'fallback.jsonl');
        const storage = new SpeechStorage({ forceFallback: true, fallbackLogPath });

        assert.strictEqual(storage.engine, 'fallback_jsonl');

        const now = Date.now();
        storage.logLine('g-fall', 'UserX', 'Mensagem de fallback', now);
        const entries = storage.readLog('g-fall', 0);
        assert.strictEqual(entries.length, 1);
        assert.strictEqual(entries[0].x, 'Mensagem de fallback');

        const deleted = storage.clearGuild('g-fall');
        assert.strictEqual(deleted, 1);
        assert.strictEqual(storage.readLog('g-fall', 0).length, 0);

        storage.close();
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignora */ }
    });
});
