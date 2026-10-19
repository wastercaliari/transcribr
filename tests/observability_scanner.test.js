// Testes unitários para o ObservabilityScanner e Motor de Auto-Remediação
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { ObservabilityScanner } = require('../scripts/observability_scanner.js');

describe('Observability Scanner & Auto-Remediation (SCRUM-64)', () => {

    it('deve diagnosticar estado HEALTHY quando todas as métricas estiverem normais', async () => {
        const scanner = new ObservabilityScanner();
        const normalMetrics = {
            process_uptime_seconds: [{ value: 7200, labels: {} }],
            nodejs_memory_heap_used_bytes: [{ value: 80 * 1024 * 1024, labels: {} }], // 80 MB
            nodejs_memory_rss_bytes: [{ value: 150 * 1024 * 1024, labels: {} }],
            transcribr_active_voice_sessions: [{ value: 1, labels: {} }],
            transcribr_bot_paused: [{ value: 0, labels: {} }],
            transcribr_utterances_total: [
                { value: 100, labels: { status: 'posted' } },
                { value: 5, labels: { status: 'discarded' } }
            ],
            transcribr_speech_storage_records_total: [{ value: 120, labels: {} }],
            transcribr_stt_engine_available: [
                { value: 1, labels: { engine: 'groq' } },
                { value: 1, labels: { engine: 'local' } }
            ]
        };

        const diagnosis = await scanner.scanAndDiagnose({ injectedMetrics: normalMetrics });
        assert.strictEqual(diagnosis.status, 'HEALTHY');
        assert.strictEqual(diagnosis.issuesCount, 0);

        const report = scanner.formatMarkdownReport(diagnosis);
        assert.ok(report.includes('HEALTHY'));
        assert.ok(report.includes('limites nominais'));
    });

    it('deve detectar e alertar sobre HIGH_MEMORY_PRESSURE quando Heap ultrapassar 400MB', async () => {
        const scanner = new ObservabilityScanner();
        const highMemMetrics = {
            nodejs_memory_heap_used_bytes: [{ value: 450 * 1024 * 1024, labels: {} }], // 450 MB
            nodejs_memory_rss_bytes: [{ value: 500 * 1024 * 1024, labels: {} }],
            transcribr_stt_engine_available: [{ value: 1, labels: { engine: 'groq' } }]
        };

        const diagnosis = await scanner.scanAndDiagnose({ injectedMetrics: highMemMetrics });
        assert.strictEqual(diagnosis.status, 'WARNING');
        assert.ok(diagnosis.issues.some(i => i.id === 'HIGH_MEMORY_PRESSURE'));
    });

    it('deve detectar ALL_STT_ENGINES_DOWN com severidade CRITICAL quando groq e local estiverem indisponíveis', async () => {
        const scanner = new ObservabilityScanner();
        const enginesDownMetrics = {
            nodejs_memory_heap_used_bytes: [{ value: 50 * 1024 * 1024, labels: {} }],
            transcribr_stt_engine_available: [
                { value: 0, labels: { engine: 'groq' } },
                { value: 0, labels: { engine: 'local' } }
            ]
        };

        const diagnosis = await scanner.scanAndDiagnose({ injectedMetrics: enginesDownMetrics });
        assert.strictEqual(diagnosis.status, 'CRITICAL');
        assert.ok(diagnosis.issues.some(i => i.id === 'ALL_STT_ENGINES_DOWN'));
    });

    it('deve detectar HIGH_DISCARD_RATE quando descarte for superior a 40%', async () => {
        const scanner = new ObservabilityScanner();
        const highDiscardMetrics = {
            transcribr_utterances_total: [
                { value: 50, labels: { status: 'posted' } },
                { value: 50, labels: { status: 'discarded' } } // 50% descarte
            ],
            transcribr_stt_engine_available: [{ value: 1, labels: { engine: 'groq' } }]
        };

        const diagnosis = await scanner.scanAndDiagnose({ injectedMetrics: highDiscardMetrics });
        assert.ok(diagnosis.issues.some(i => i.id === 'HIGH_DISCARD_RATE'));
    });

    it('deve executar auto-remediação podando SpeechStorage em caso de pressão de memória ou buffer', async () => {
        let prunedCalled = false;
        let prunedDays = 0;
        const mockStorage = {
            pruneLog: (ms) => {
                prunedCalled = true;
                prunedDays = ms / (24 * 3600 * 1000);
                return 42;
            }
        };

        const scanner = new ObservabilityScanner({ speechStorage: mockStorage });
        const mockDiagnosis = {
            issuesCount: 1,
            issues: [
                { id: 'HIGH_MEMORY_PRESSURE', severity: 'WARNING', remediation: 'PURGE_BUFFERS_AND_GC' }
            ]
        };

        const remResult = await scanner.autoRemediate(mockDiagnosis);
        assert.strictEqual(remResult.actionsCount, 1);
        assert.strictEqual(prunedCalled, true);
        assert.strictEqual(prunedDays, 7);
        assert.ok(remResult.actions[0].detail.includes('42 registros'));
    });
});
