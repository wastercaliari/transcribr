// Testes unitários para o módulo de métricas Prometheus (/metrics) e HTTP Ingress
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const {
    generatePrometheusMetrics,
    recordHttpRequest,
    getHttpMetrics,
    resetHttpMetrics,
    parsePrometheusText
} = require('../src/metrics.js');
const { createHealthServer } = require('../bot.js');

describe('Prometheus Metrics & Observability Module (SCRUM-64)', () => {

    describe('generatePrometheusMetrics', () => {
        it('deve gerar texto no formato canônico Prometheus com cabeçalhos HELP e TYPE válidos', () => {
            const output = generatePrometheusMetrics({
                uptime: 3600,
                memory: { rss: 104857600, heapUsed: 52428800, heapTotal: 83886080 },
                cpu: { user: 1500000, system: 500000 },
                activeSessions: 2,
                paused: false,
                telemetry: {
                    audioChunksReceived: 150,
                    audioDurationTotalSec: 450.5,
                    transcriptionsPosted: 120,
                    hallucinationsDiscarded: 15,
                    duplicatesSkipped: 15,
                    avgLatencyMs: 420
                },
                speechCount: 88,
                engines: ['groq', 'local']
            });

            assert.ok(typeof output === 'string');
            assert.ok(output.includes('# HELP process_uptime_seconds'));
            assert.ok(output.includes('# TYPE process_uptime_seconds gauge'));
            assert.ok(output.includes('process_uptime_seconds 3600'));

            assert.ok(output.includes('# HELP nodejs_memory_heap_used_bytes'));
            assert.ok(output.includes('nodejs_memory_heap_used_bytes 52428800'));

            assert.ok(output.includes('transcribr_active_voice_sessions 2'));
            assert.ok(output.includes('transcribr_bot_paused 0'));

            assert.ok(output.includes('transcribr_utterances_total{status="posted"} 120'));
            assert.ok(output.includes('transcribr_utterances_total{status="discarded"} 15'));
            assert.ok(output.includes('transcribr_utterances_total{status="duplicate"} 15'));

            assert.ok(output.includes('transcribr_audio_duration_seconds_total 450.5'));
            assert.ok(output.includes('transcribr_speech_storage_records_total 88'));

            assert.ok(output.includes('transcribr_stt_engine_available{engine="groq"} 1'));
            assert.ok(output.includes('transcribr_stt_engine_available{engine="local"} 1'));
        });

        it('deve refletir bot pausado e ausência de motor local quando configurado', () => {
            const output = generatePrometheusMetrics({
                paused: true,
                engines: ['groq']
            });

            assert.ok(output.includes('transcribr_bot_paused 1'));
            assert.ok(output.includes('transcribr_stt_engine_available{engine="groq"} 1'));
            assert.ok(output.includes('transcribr_stt_engine_available{engine="local"} 0'));
        });
    });

    describe('recordHttpRequest e getHttpMetrics', () => {
        before(() => resetHttpMetrics());

        it('deve registrar e contabilizar requisições por rota', () => {
            recordHttpRequest('/health');
            recordHttpRequest('/health');
            recordHttpRequest('/metrics');
            recordHttpRequest('/unknown');

            const metrics = getHttpMetrics();
            assert.strictEqual(metrics['/health'], 2);
            assert.strictEqual(metrics['/metrics'], 1);
            assert.strictEqual(metrics['other'], 1);
        });
    });

    describe('parsePrometheusText', () => {
        it('deve converter saída Prometheus para estrutura de dados JS inspecionável', () => {
            const raw = `
# HELP test_metric Test
# TYPE test_metric gauge
test_metric 42
transcribr_utterances_total{status="posted"} 99
transcribr_utterances_total{status="discarded"} 5
`;
            const parsed = parsePrometheusText(raw);
            assert.strictEqual(parsed.test_metric[0].value, 42);
            assert.strictEqual(parsed.transcribr_utterances_total.length, 2);
            assert.strictEqual(parsed.transcribr_utterances_total[0].labels.status, 'posted');
            assert.strictEqual(parsed.transcribr_utterances_total[0].value, 99);
            assert.strictEqual(parsed.transcribr_utterances_total[1].labels.status, 'discarded');
            assert.strictEqual(parsed.transcribr_utterances_total[1].value, 5);
        });
    });

    describe('HTTP Server Endpoint /metrics', () => {
        let server;
        const testPort = 49198;

        before((done) => {
            server = createHealthServer();
            server.listen(testPort, done);
        });

        after((done) => {
            server.close(done);
        });

        it('deve responder HTTP 200 com content-type de Prometheus em GET /metrics', async () => {
            const resp = await fetch(`http://127.0.0.1:${testPort}/metrics`);
            assert.strictEqual(resp.status, 200);
            assert.strictEqual(resp.headers.get('content-type'), 'text/plain; version=0.0.4; charset=utf-8');

            const body = await resp.text();
            assert.ok(body.includes('process_uptime_seconds'));
            assert.ok(body.includes('transcribr_active_voice_sessions'));
            assert.ok(body.includes('transcribr_utterances_total'));
            assert.ok(body.includes('transcribr_speech_storage_records_total'));

            const parsed = parsePrometheusText(body);
            assert.ok(parsed.process_uptime_seconds);
            assert.ok(parsed.nodejs_memory_rss_bytes);
            assert.ok(parsed.transcribr_http_requests_total);
        });
    });
});
