const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  pcmToFloat32,
  calculateZCR,
  calculateRMS,
  estimatePitchF0,
  analyzeSpectralProfile,
  extractVoiceprint,
  cosineSimilarity,
  VoiceDiarizer,
  SAMPLE_RATE
} = require('../src/voice_diarization');

/**
 * Utilitário para gerar buffers PCM sintéticos de teste.
 * @param {number} frequency Frequência da senoide em Hz
 * @param {number} durationMs Duração em milissegundos
 * @param {number} amplitude Amplitude [0..1]
 * @returns {Buffer}
 */
function generateTonePcm(frequency, durationMs = 200, amplitude = 0.5) {
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const buffer = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const sample = Math.sin(2 * Math.PI * frequency * t) * amplitude;
    const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    buffer.writeInt16LE(intSample, i * 2);
  }
  return buffer;
}

describe('Voice Diarization & Biometrics Module (SCRUM-55)', () => {
  describe('pcmToFloat32', () => {
    it('deve converter buffer PCM 16-bit para Float32Array normalizado', () => {
      const buffer = Buffer.alloc(4);
      buffer.writeInt16LE(0, 0);
      buffer.writeInt16LE(16384, 2); // ~0.5
      const floats = pcmToFloat32(buffer);

      assert.strictEqual(floats.length, 2);
      assert.strictEqual(floats[0], 0);
      assert.ok(Math.abs(floats[1] - 0.5) < 0.01);
    });

    it('deve tratar buffer vazio ou inválido retornando Float32Array vazio', () => {
      assert.strictEqual(pcmToFloat32(null).length, 0);
      assert.strictEqual(pcmToFloat32(Buffer.alloc(0)).length, 0);
      assert.strictEqual(pcmToFloat32(Buffer.alloc(1)).length, 0);
    });
  });

  describe('calculateZCR e calculateRMS', () => {
    it('deve calcular RMS proporcional à amplitude', () => {
      const pcmLow = generateTonePcm(200, 100, 0.2);
      const pcmHigh = generateTonePcm(200, 100, 0.8);

      const rmsLow = calculateRMS(pcmToFloat32(pcmLow));
      const rmsHigh = calculateRMS(pcmToFloat32(pcmHigh));

      assert.ok(rmsLow > 0.1 && rmsLow < 0.25);
      assert.ok(rmsHigh > 0.45 && rmsHigh < 0.65);
      assert.ok(rmsHigh > rmsLow);
    });

    it('deve calcular taxa de cruzamento por zero maior para frequências mais altas', () => {
      const pcm100Hz = generateTonePcm(100, 100, 0.5);
      const pcm1000Hz = generateTonePcm(1000, 100, 0.5);

      const zcr100 = calculateZCR(pcmToFloat32(pcm100Hz));
      const zcr1000 = calculateZCR(pcmToFloat32(pcm1000Hz));

      assert.ok(zcr1000 > zcr100);
    });
  });

  describe('estimatePitchF0 e analyzeSpectralProfile', () => {
    it('deve estimar tom fundamental F0 próximo da frequência gerada (ex.: 150Hz voz masculina)', () => {
      const pcm = generateTonePcm(150, 300, 0.7);
      const floatSamples = pcmToFloat32(pcm);
      const f0 = estimatePitchF0(floatSamples, SAMPLE_RATE);

      assert.ok(Math.abs(f0 - 150) <= 20, `Pitch estimado ${f0} deve estar próximo de 150Hz`);
    });

    it('deve retornar centróide e divisão espectral em 4 bandas', () => {
      const pcm = generateTonePcm(800, 200, 0.6);
      const floatSamples = pcmToFloat32(pcm);
      const spectral = analyzeSpectralProfile(floatSamples, SAMPLE_RATE);

      assert.ok(spectral.centroid > 0, 'Centróide deve ser positivo');
      assert.strictEqual(spectral.bandEnergies.length, 4);
      // Frequência de 800Hz deve concentrar maior energia na banda midLow (300-1000Hz)
      assert.ok(spectral.bandEnergies[1] > spectral.bandEnergies[0]);
    });
  });

  describe('extractVoiceprint & cosineSimilarity', () => {
    it('deve retornar vetor de 10 dimensões biométricas para áudio com voz ativa', () => {
      const pcm = generateTonePcm(220, 200, 0.5);
      const print = extractVoiceprint(pcm);

      assert.ok(Array.isArray(print));
      assert.strictEqual(print.length, 10);
      print.forEach((val, idx) => {
        assert.ok(!isNaN(val), `Dimensão ${idx} não pode ser NaN`);
        assert.ok(val >= 0, `Dimensão ${idx} deve ser positiva ou zero`);
      });
    });

    it('deve retornar null para silêncio absoluto', () => {
      const silence = Buffer.alloc(16000 * 2); // 1 segundo de silêncio
      const print = extractVoiceprint(silence);
      assert.strictEqual(print, null);
    });

    it('deve calcular similaridade 1.0 para o mesmo vetor', () => {
      const vec = [0.5, 0.2, 0.4, 0.8, 0.3, 0.1, 0.6, 0.2, 0.1, 0.5, 0.3, 1.0];
      const sim = cosineSimilarity(vec, vec);
      assert.ok(Math.abs(sim - 1.0) < 1e-4);
    });

    it('deve diferenciar perfis acústicos distintos (ex.: tom grave 120Hz vs agudo 1200Hz)', () => {
      const pcmLow = generateTonePcm(120, 300, 0.6);
      const pcmHigh = generateTonePcm(1200, 300, 0.6);

      const printLow = extractVoiceprint(pcmLow);
      const printHigh = extractVoiceprint(pcmHigh);

      const sim = cosineSimilarity(printLow, printHigh);
      assert.ok(sim < 0.85, `Similaridade entre perfis distintos (${sim}) deve ser inferior ao limiar de match`);
    });
  });

  describe('VoiceDiarizer', () => {
    let diarizer;

    beforeEach(() => {
      diarizer = new VoiceDiarizer({ similarityThreshold: 0.82 });
    });

    it('deve matricular (enroll) e atualizar perfis de falantes conhecidos', () => {
      const pcmA = generateTonePcm(160, 250, 0.6);
      const ok1 = diarizer.enrollSpeaker('user-1', 'Alice', pcmA);
      assert.strictEqual(ok1, true);

      // Re-enroll da mesma locutora deve atualizar perfil
      const ok2 = diarizer.enrollSpeaker('user-1', 'Alice', pcmA);
      assert.strictEqual(ok2, true);

      const telemetry = diarizer.getTelemetry();
      assert.strictEqual(telemetry.enrolledSpeakersCount, 1);
      assert.strictEqual(telemetry.activeProfiles[0].name, 'Alice');
      assert.strictEqual(telemetry.activeProfiles[0].samples, 2);
    });

    it('deve identificar corretamente locutor cadastrado a partir de nova amostra', () => {
      const pcmAlice = generateTonePcm(180, 300, 0.6);
      const pcmBob = generateTonePcm(900, 300, 0.6);

      diarizer.enrollSpeaker('u-alice', 'Alice', pcmAlice);
      diarizer.enrollSpeaker('u-bob', 'Bob', pcmBob);

      // Teste identificando amostra compatível com Alice
      const pcmTestAlice = generateTonePcm(185, 300, 0.6);
      const matchAlice = diarizer.identifySpeaker(pcmTestAlice);

      assert.strictEqual(matchAlice.match, true);
      assert.strictEqual(matchAlice.speakerId, 'u-alice');
      assert.strictEqual(matchAlice.speakerName, 'Alice');
      assert.ok(matchAlice.score >= 0.82);

      // Teste com amostra não cadastrada (ruído / silêncio)
      const silence = Buffer.alloc(1000);
      const matchSilence = diarizer.identifySpeaker(silence);
      assert.strictEqual(matchSilence.match, false);
    });

    it('deve diarizar sequência de falas atribuindo clusters consistentes', () => {
      const pcmSpeaker1 = generateTonePcm(140, 250, 0.6);
      const pcmSpeaker2 = generateTonePcm(1100, 250, 0.6);

      const utterances = [
        { id: 'utt-1', userName: 'Locutor A', pcm: pcmSpeaker1 },
        { id: 'utt-2', userName: 'Locutor B', pcm: pcmSpeaker2 },
        { id: 'utt-3', userName: 'Locutor A', pcm: pcmSpeaker1 }
      ];

      const diarized = diarizer.diarizeUtterances(utterances);

      assert.strictEqual(diarized.length, 3);
      // A primeira e a terceira fala têm a mesma frequência, devem cair no mesmo cluster
      assert.strictEqual(diarized[0].clusterId, diarized[2].clusterId);
      // A segunda fala é significativamente diferente, deve ter clusterId diferente
      assert.notStrictEqual(diarized[0].clusterId, diarized[1].clusterId);
    });

    it('deve resetar os perfis cadastrados', () => {
      diarizer.enrollSpeaker('u-1', 'Teste', generateTonePcm(200, 200, 0.5));
      assert.strictEqual(diarizer.getTelemetry().enrolledSpeakersCount, 1);
      diarizer.reset();
      assert.strictEqual(diarizer.getTelemetry().enrolledSpeakersCount, 0);
    });
  });
});
