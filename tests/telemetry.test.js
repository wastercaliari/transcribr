// Testes unitários para o módulo de telemetria e métricas de desempenho de transcrição
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getTelemetryMetrics, recordTranscriptionMetric } = require('../bot.js');

describe('Transcription Telemetry Module', () => {
    it('deve registrar e acumular métricas de falas postadas, descartadas e duplicadas', () => {
        const initial = getTelemetryMetrics();

        recordTranscriptionMetric({ durationSec: '2.5', latencyMs: 350, engine: 'groq', posted: true });
        recordTranscriptionMetric({ durationSec: '1.0', latencyMs: 200, discarded: true });
        recordTranscriptionMetric({ durationSec: '1.5', latencyMs: 150, duplicate: true });

        const updated = getTelemetryMetrics();

        assert.strictEqual(updated.audioChunksReceived, initial.audioChunksReceived + 3);
        assert.strictEqual(updated.transcriptionsPosted, initial.transcriptionsPosted + 1);
        assert.strictEqual(updated.hallucinationsDiscarded, initial.hallucinationsDiscarded + 1);
        assert.strictEqual(updated.duplicatesSkipped, initial.duplicatesSkipped + 1);
        assert.ok(updated.engineUsage.groq >= initial.engineUsage.groq + 1);
        assert.ok(updated.avgLatencyMs > 0);
    });

    it('deve formatar corretamente a duração total em segundos com uma casa decimal', () => {
        const metrics = getTelemetryMetrics();
        assert.strictEqual(typeof metrics.audioDurationTotalSec, 'number');
        assert.ok(metrics.audioDurationTotalSec >= 0);
    });
});
