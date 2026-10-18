// Testes unitários para o módulo de gravação e consolidação de áudio (SCRUM-53 / I-9)
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
    recordAudioUtterance,
    exportSessionAudioWav,
    clearAudioSession,
    getAudioSessionStats,
    createWavHeader
} = require('../src/audio_recorder.js');

describe('Audio Recorder & Consolidation Module (SCRUM-53)', () => {
    const testGuildId = 'guild_test_123';

    beforeEach(() => {
        clearAudioSession(testGuildId);
    });

    describe('recordAudioUtterance', () => {
        it('deve registrar falas em buffer e calcular estatísticas corretamente', () => {
            const pcm1 = Buffer.alloc(32000); // 1 segundo
            const pcm2 = Buffer.alloc(16000); // 0.5 segundo

            const ok1 = recordAudioUtterance(testGuildId, 'Alice', pcm1, 1000);
            const ok2 = recordAudioUtterance(testGuildId, 'Bob', pcm2, 2000);

            assert.strictEqual(ok1, true);
            assert.strictEqual(ok2, true);

            const stats = getAudioSessionStats(testGuildId);
            assert.strictEqual(stats.utteranceCount, 2);
            assert.strictEqual(stats.totalBytes, 48000);
            assert.strictEqual(stats.totalDurationSec, 1.5);
            assert.deepStrictEqual(stats.speakers.sort(), ['Alice', 'Bob']);
        });

        it('deve rejeitar entradas vazias, nulas ou sem buffer', () => {
            assert.strictEqual(recordAudioUtterance(null, 'Alice', Buffer.alloc(100)), false);
            assert.strictEqual(recordAudioUtterance(testGuildId, 'Alice', null), false);
            assert.strictEqual(recordAudioUtterance(testGuildId, 'Alice', Buffer.alloc(0)), false);
        });

        it('deve purgar trechos antigos quando o limite máximo de buffer for excedido', () => {
            const smallMaxBytes = 50000;
            const pcmLarge = Buffer.alloc(30000);

            recordAudioUtterance(testGuildId, 'Alice', pcmLarge, 1000, smallMaxBytes);
            recordAudioUtterance(testGuildId, 'Bob', pcmLarge, 2000, smallMaxBytes);

            // Total seria 60.000 > 50.000, logo deve purgar a primeira fala (Alice)
            const stats = getAudioSessionStats(testGuildId);
            assert.strictEqual(stats.utteranceCount, 1);
            assert.deepStrictEqual(stats.speakers, ['Bob']);
        });

        it('deve desativar gravação quando ENABLE_AUDIO_RECORDING for false', () => {
            const originalEnv = process.env.ENABLE_AUDIO_RECORDING;
            try {
                process.env.ENABLE_AUDIO_RECORDING = 'false';
                const ok = recordAudioUtterance(testGuildId, 'Alice', Buffer.alloc(1000));
                assert.strictEqual(ok, false);
                assert.strictEqual(getAudioSessionStats(testGuildId).utteranceCount, 0);
            } finally {
                process.env.ENABLE_AUDIO_RECORDING = originalEnv || 'true';
            }
        });
    });

    describe('exportSessionAudioWav', () => {
        it('deve exportar áudio consolidado com cabeçalho RIFF WAVE canônico de 44 bytes', () => {
            const pcm1 = Buffer.alloc(16000); // 0.5s
            const pcm2 = Buffer.alloc(16000); // 0.5s

            recordAudioUtterance(testGuildId, 'Carlos', pcm1, 1000);
            recordAudioUtterance(testGuildId, 'Diana', pcm2, 2000);

            const result = exportSessionAudioWav(testGuildId);
            assert.notStrictEqual(result, null);
            assert.strictEqual(result.utteranceCount, 2);
            assert.deepStrictEqual(result.speakers.sort(), ['Carlos', 'Diana']);

            const wav = result.wavBuffer;
            assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF');
            assert.strictEqual(wav.toString('ascii', 8, 12), 'WAVE');
            assert.strictEqual(wav.toString('ascii', 12, 16), 'fmt ');
            assert.strictEqual(wav.readUInt16LE(20), 1); // PCM
            assert.strictEqual(wav.readUInt16LE(22), 1); // Mono
            assert.strictEqual(wav.readUInt32LE(24), 16000); // 16kHz
            assert.strictEqual(wav.toString('ascii', 36, 40), 'data');

            // 44 (header) + 16000 (pcm1) + 8000 (gap 250ms) + 16000 (pcm2) = 40044 bytes
            assert.strictEqual(wav.length, 44 + 16000 + 8000 + 16000);
            assert.strictEqual(result.totalBytes, wav.length);
        });

        it('deve respeitar a janela de tempo maxSeconds na exportação', () => {
            const now = 100_000;
            const pcmOld = Buffer.alloc(16000); // de 100s atrás
            const pcmRecent = Buffer.alloc(16000); // de 10s atrás

            recordAudioUtterance(testGuildId, 'Antigo', pcmOld, now - 100_000);
            recordAudioUtterance(testGuildId, 'Recente', pcmRecent, now - 10_000);

            // Janela de 30 segundos
            const result = exportSessionAudioWav(testGuildId, {
                maxSeconds: 30,
                referenceTimestamp: now
            });

            assert.notStrictEqual(result, null);
            assert.strictEqual(result.utteranceCount, 1);
            assert.deepStrictEqual(result.speakers, ['Recente']);
        });

        it('deve retornar null se a sessão estiver vazia ou não existir', () => {
            assert.strictEqual(exportSessionAudioWav('guild_inexistente'), null);
            assert.strictEqual(exportSessionAudioWav(testGuildId), null);
        });
    });

    describe('clearAudioSession', () => {
        it('deve limpar completamente o buffer de áudio da guild', () => {
            recordAudioUtterance(testGuildId, 'Teste', Buffer.alloc(1000), 1000);
            assert.strictEqual(getAudioSessionStats(testGuildId).utteranceCount, 1);

            const cleared = clearAudioSession(testGuildId);
            assert.strictEqual(cleared, true);
            assert.strictEqual(getAudioSessionStats(testGuildId).utteranceCount, 0);
        });
    });
});
