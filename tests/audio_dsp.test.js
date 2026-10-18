// Testes unitários para o pipeline de áudio DSP (High-Pass, AGC, Silence Trimming e WAV)
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { preprocessAudio, trimTrailingSilence, pcmToWav } = require('../bot.js');

describe('Audio DSP Pipeline', () => {
    describe('pcmToWav', () => {
        it('deve gerar cabeçalho RIFF WAV canônico de 44 bytes para áudio PCM 16kHz mono', () => {
            const samplePcm = Buffer.alloc(3200); // 100ms de áudio PCM 16-bit
            const wav = pcmToWav(samplePcm, 16000);

            assert.strictEqual(wav.length, 44 + 3200);
            assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF');
            assert.strictEqual(wav.toString('ascii', 8, 12), 'WAVE');
            assert.strictEqual(wav.toString('ascii', 12, 16), 'fmt ');
            assert.strictEqual(wav.readUInt16LE(20), 1); // PCM format (1)
            assert.strictEqual(wav.readUInt16LE(22), 1); // 1 canal (mono)
            assert.strictEqual(wav.readUInt32LE(24), 16000); // Sample rate 16000
            assert.strictEqual(wav.readUInt16LE(34), 16); // 16 bits por amostra
            assert.strictEqual(wav.toString('ascii', 36, 40), 'data');
            assert.strictEqual(wav.readUInt32LE(40), 3200); // Tamanho dos dados
        });

        it('deve tratar buffer vazio retornando apenas o cabeçalho WAV de 44 bytes', () => {
            const emptyPcm = Buffer.alloc(0);
            const wav = pcmToWav(emptyPcm, 16000);

            assert.strictEqual(wav.length, 44);
            assert.strictEqual(wav.readUInt32LE(40), 0);
        });
    });

    describe('preprocessAudio', () => {
        it('deve aplicar filtro passa-alta e controle de ganho sem estourar limites Int16', () => {
            const pcm = Buffer.alloc(1600 * 2); // 1600 amostras
            for (let i = 0; i < 1600; i++) {
                // Onda senoidal de 500Hz com amplitude moderada
                const val = Math.round(10000 * Math.sin(2 * Math.PI * 500 * (i / 16000)));
                pcm.writeInt16LE(val, i * 2);
            }

            const processed = preprocessAudio(pcm, 16000);
            assert.strictEqual(processed.length, pcm.length);

            for (let i = 0; i < processed.length; i += 2) {
                const sample = processed.readInt16LE(i);
                assert.ok(sample >= -32768 && sample <= 32767, `Amostra fora de limite Int16: ${sample}`);
            }
        });

        it('deve processar silêncio absoluto (amostras zero) com estabilidade numérica', () => {
            const silence = Buffer.alloc(640);
            const processed = preprocessAudio(silence, 16000);

            assert.strictEqual(processed.length, silence.length);
            for (let i = 0; i < processed.length; i += 2) {
                assert.strictEqual(processed.readInt16LE(i), 0);
            }
        });
    });

    describe('trimTrailingSilence', () => {
        it('deve remover silêncio final preservando o conteúdo sonoro e frames de padding', () => {
            // Cria áudio com som nos primeiros 5 frames (640 bytes cada) e silêncio nos próximos 15 frames
            const frameBytes = 640;
            const totalFrames = 20;
            const pcm = Buffer.alloc(totalFrames * frameBytes);

            for (let i = 0; i < 5 * frameBytes; i += 2) {
                pcm.writeInt16LE(1500, i); // RMS bem acima do threshold (200)
            }

            const trimmed = trimTrailingSilence(pcm);
            // Deve cortar grande parte dos frames de silêncio, mantendo no máximo 9 frames de padding
            assert.ok(trimmed.length < pcm.length, 'Deveria ter cortado o silêncio final');
            assert.ok(trimmed.length >= 5 * frameBytes, 'Deveria ter mantido todo o áudio ativo');
        });

        it('deve retornar buffer intacto se o áudio terminar com fala ativa', () => {
            const pcm = Buffer.alloc(6400);
            for (let i = 0; i < pcm.length; i += 2) {
                pcm.writeInt16LE(2000, i);
            }

            const trimmed = trimTrailingSilence(pcm);
            assert.strictEqual(trimmed.length, pcm.length);
        });
    });
});
