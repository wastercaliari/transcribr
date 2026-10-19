/**
 * TranscriBR - Módulo de Diarização Avançada & Biometria de Voz (Voice Fingerprinting)
 * Ticket: SCRUM-55 (I-11)
 *
 * Funcionalidades:
 * - Extração de atributos acústicos: RMS, ZCR (Zero-Crossing Rate), Spectral Centroid,
 *   Spectral Rolloff, Frequência Fundamental (F0 via autocorrelação) e Energia por Bandas.
 * - Geração de Voiceprint (vetor de embedding acústico de 10 dimensões normalizadas).
 * - Comparação de similaridade de cosseno e distância biométrica.
 * - Gerenciamento de perfis biométricos de falantes (Speaker Profiles) com aprendizado adaptativo.
 * - Diarização e agrupamento não-supervisionado de falas em clusters de locutores.
 */

'use strict';

const SAMPLE_RATE = 16000; // Padrão Discord mono PCM 16-bit
const FRAME_SIZE = 512;    // ~32ms por quadro de análise a 16kHz
const HOP_SIZE = 256;      // 50% de sobreposição (overlap)

/**
 * Converte Buffer PCM de 16 bits (mono little-endian) para Float32Array normalizado [-1.0, 1.0].
 * @param {Buffer} pcmBuffer
 * @returns {Float32Array}
 */
function pcmToFloat32(pcmBuffer) {
  if (!Buffer.isBuffer(pcmBuffer) || pcmBuffer.length < 2) {
    return new Float32Array(0);
  }
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  const floatSamples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const intSample = pcmBuffer.readInt16LE(i * 2);
    floatSamples[i] = intSample / 32768.0;
  }
  return floatSamples;
}

/**
 * Calcula a taxa de cruzamento por zero (Zero-Crossing Rate - ZCR).
 * @param {Float32Array} samples
 * @returns {number} ZCR entre 0 e 1
 */
function calculateZCR(samples) {
  if (samples.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / (samples.length - 1);
}

/**
 * Calcula a energia Root Mean Square (RMS).
 * @param {Float32Array} samples
 * @returns {number} RMS entre 0 e 1
 */
function calculateRMS(samples) {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Estima a frequência fundamental (F0 / Pitch) via autocorrelação normalizada.
 * Faixa típica da voz humana: 60Hz a 400Hz.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @returns {number} Frequência estimada em Hz (0 se não periódica / ruído)
 */
function estimatePitchF0(samples, sampleRate = SAMPLE_RATE) {
  if (samples.length < FRAME_SIZE) return 0;

  const minLag = Math.floor(sampleRate / 400); // ~40 samples (400Hz)
  const maxLag = Math.floor(sampleRate / 60);  // ~266 samples (60Hz)

  if (maxLag >= samples.length) return 0;

  let bestLag = 0;
  let maxCorr = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let normA = 0;
    let normB = 0;
    const len = samples.length - lag;

    for (let i = 0; i < len; i++) {
      const a = samples[i];
      const b = samples[i + lag];
      corr += a * b;
      normA += a * a;
      normB += b * b;
    }

    const norm = Math.sqrt(normA * normB);
    const normalizedCorr = norm > 1e-6 ? corr / norm : 0;

    if (normalizedCorr > maxCorr) {
      maxCorr = normalizedCorr;
      bestLag = lag;
    }
  }

  if (maxCorr > 0.35 && bestLag > 0) {
    return sampleRate / bestLag;
  }
  return 0;
}

/**
 * Análise espectral de Fourier com Janela de Hann e decomposição em 4 bandas:
 * - Sub-graves/Graves: 60Hz - 300Hz
 * - Médios-graves: 300Hz - 1000Hz
 * - Médios-agudos: 1000Hz - 3000Hz
 * - Agudos: 3000Hz - 8000Hz
 * @param {Float32Array} samples
 * @param {number} sampleRate
 */
function analyzeSpectralProfile(samples, sampleRate = SAMPLE_RATE) {
  let bands = [0, 0, 0, 0];
  const nFft = 256;
  const numBins = nFft / 2;
  const binFreqHz = sampleRate / nFft;

  if (samples.length < nFft) {
    return { centroid: 0, rolloff: 0, bandEnergies: bands };
  }

  const binMagnitudes = new Float32Array(numBins);
  let totalWeightedFreq = 0;
  let totalMagnitude = 0;

  const numFrames = Math.floor((samples.length - nFft) / HOP_SIZE) + 1;
  const framesToProcess = Math.min(Math.max(1, numFrames), 16);

  for (let f = 0; f < framesToProcess; f++) {
    const offset = f * HOP_SIZE;
    for (let k = 1; k < numBins; k++) {
      let real = 0;
      let imag = 0;
      const omega = (2 * Math.PI * k) / nFft;

      for (let n = 0; n < nFft; n++) {
        const sampleIdx = offset + n;
        if (sampleIdx >= samples.length) break;
        const hann = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (nFft - 1)));
        const val = samples[sampleIdx] * hann;
        real += val * Math.cos(omega * n);
        imag -= val * Math.sin(omega * n);
      }

      const mag = Math.sqrt(real * real + imag * imag);
      binMagnitudes[k] += mag;
      const freq = k * binFreqHz;

      totalWeightedFreq += freq * mag;
      totalMagnitude += mag;

      if (freq >= 60 && freq < 300) bands[0] += mag;
      else if (freq >= 300 && freq < 1000) bands[1] += mag;
      else if (freq >= 1000 && freq < 3000) bands[2] += mag;
      else if (freq >= 3000 && freq <= 8000) bands[3] += mag;
    }
  }

  const sumBands = bands[0] + bands[1] + bands[2] + bands[3];
  if (sumBands > 1e-6) {
    bands = bands.map(b => b / sumBands);
  }

  const centroid = totalMagnitude > 1e-6 ? totalWeightedFreq / totalMagnitude : 0;

  let rolloff = 0;
  if (totalMagnitude > 1e-6) {
    let accumulated = 0;
    const threshold = 0.85 * totalMagnitude;
    for (let k = 1; k < numBins; k++) {
      accumulated += binMagnitudes[k];
      if (accumulated >= threshold) {
        rolloff = k * binFreqHz;
        break;
      }
    }
  }

  return { centroid, rolloff, bandEnergies: bands };
}

/**
 * Extrai o vetor de Voiceprint (10 dimensões biométricas) a partir de um buffer PCM.
 * Dimensões:
 * [0] Normalized Pitch (F0 / 500)
 * [1] Spectral Centroid Normalizado (Centroid / 4000)
 * [2] Spectral Rolloff Normalizado (Rolloff / 8000)
 * [3] Zero-Crossing Rate Normalizado
 * [4] Low Band Energy (60-300Hz)
 * [5] Mid-Low Band Energy (300-1000Hz)
 * [6] Mid-High Band Energy (1000-3000Hz)
 * [7] High Band Energy (3000-8000Hz)
 * [8] Spectral Spread Normalizado ((Rolloff - Centroid) / 8000)
 * [9] High-to-Low Ratio Normalizado
 *
 * @param {Buffer} pcmBuffer
 * @param {number} sampleRate
 * @returns {number[] | null} Vetor de 10 dimensões ou null se áudio inválido/silêncio
 */
function extractVoiceprint(pcmBuffer, sampleRate = SAMPLE_RATE) {
  const floatSamples = pcmToFloat32(pcmBuffer);
  if (floatSamples.length === 0) return null;

  const rms = calculateRMS(floatSamples);
  if (rms < 0.005) {
    return null;
  }

  const zcr = calculateZCR(floatSamples);
  const f0 = estimatePitchF0(floatSamples, sampleRate);
  const spectral = analyzeSpectralProfile(floatSamples, sampleRate);

  const bands = spectral.bandEnergies;
  const spread = Math.max(0, (spectral.rolloff - spectral.centroid) / 8000.0);
  const highEnergy = bands[2] + bands[3];
  const lowEnergy = bands[0] + bands[1];
  const ratio = (lowEnergy + 1e-4) > 0 ? Math.min(1.0, (highEnergy / (lowEnergy + 1e-4)) / 3.0) : 1.0;

  const vector = [
    Math.min(1.0, f0 / 500.0),                  // 0: Pitch F0
    Math.min(1.0, spectral.centroid / 4000.0),  // 1: Centróide
    Math.min(1.0, spectral.rolloff / 8000.0),   // 2: Rolloff
    Math.min(1.0, zcr * 4.0),                   // 3: ZCR
    bands[0],                                   // 4: Low Band
    bands[1],                                   // 5: Mid-Low Band
    bands[2],                                   // 6: Mid-High Band
    bands[3],                                   // 7: High Band
    Math.min(1.0, spread),                      // 8: Spread
    ratio                                       // 9: Ratio High/Low
  ];

  return vector;
}

/**
 * Calcula a similaridade de cosseno entre dois vetores de voiceprint.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Similaridade no intervalo [0, 1]
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator < 1e-6) return 0;
  return Math.max(0, Math.min(1, dotProduct / denominator));
}

/**
 * Classe de Gerenciamento Biométrico de Locutores por Guild/Sessão.
 */
class VoiceDiarizer {
  constructor(options = {}) {
    this.similarityThreshold = options.similarityThreshold || 0.80; // Limiar de match de voz
    this.profiles = new Map(); // speakerKey -> { id, name, voiceprint: number[], sampleCount: number, lastSeen: number }
  }

  /**
   * Registra ou atualiza o perfil biométrico de um falante conhecido.
   * @param {string} speakerId ID único do participante
   * @param {string} speakerName Nome do participante
   * @param {Buffer} pcmBuffer Trecho de áudio
   * @returns {boolean} True se o perfil foi atualizado com sucesso
   */
  enrollSpeaker(speakerId, speakerName, pcmBuffer) {
    if (!speakerId || !pcmBuffer) return false;

    const print = extractVoiceprint(pcmBuffer);
    if (!print) return false;

    const existing = this.profiles.get(speakerId);
    if (!existing) {
      this.profiles.set(speakerId, {
        id: speakerId,
        name: speakerName || speakerId,
        voiceprint: print.slice(),
        sampleCount: 1,
        lastSeen: Date.now()
      });
      return true;
    }

    const alpha = Math.max(0.15, 1.0 / (existing.sampleCount + 1));
    for (let i = 0; i < print.length; i++) {
      existing.voiceprint[i] = (1 - alpha) * existing.voiceprint[i] + alpha * print[i];
    }
    existing.sampleCount++;
    existing.name = speakerName || existing.name;
    existing.lastSeen = Date.now();
    return true;
  }

  /**
   * Identifica qual dos perfis cadastrados é o provável locutor da amostra.
   * @param {Buffer} pcmBuffer Trecho de áudio a identificar
   * @param {number} [customThreshold] Limiar customizado opcional
   * @returns {{ match: boolean, speakerId: string|null, speakerName: string|null, score: number }}
   */
  identifySpeaker(pcmBuffer, customThreshold) {
    const threshold = customThreshold !== undefined ? customThreshold : this.similarityThreshold;
    const print = extractVoiceprint(pcmBuffer);
    if (!print) {
      return { match: false, speakerId: null, speakerName: null, score: 0 };
    }

    let bestSpeaker = null;
    let maxScore = -1;

    for (const profile of this.profiles.values()) {
      const score = cosineSimilarity(print, profile.voiceprint);
      if (score > maxScore) {
        maxScore = score;
        bestSpeaker = profile;
      }
    }

    if (bestSpeaker && maxScore >= threshold) {
      return {
        match: true,
        speakerId: bestSpeaker.id,
        speakerName: bestSpeaker.name,
        score: Number(maxScore.toFixed(4))
      };
    }

    return {
      match: false,
      speakerId: null,
      speakerName: null,
      score: maxScore > 0 ? Number(maxScore.toFixed(4)) : 0
    };
  }

  /**
   * Diariza uma lista de falas sequenciais (utterances), atribuindo cluster biométrico.
   * @param {Array<{ id?: string, userName?: string, pcm: Buffer, timestamp?: number }>} utterances
   * @returns {Array<{ index: number, speakerId: string, speakerName: string, clusterId: number, confidence: number }>}
   */
  diarizeUtterances(utterances) {
    if (!Array.isArray(utterances) || utterances.length === 0) {
      return [];
    }

    const clusters = [];
    const results = [];

    for (let i = 0; i < utterances.length; i++) {
      const u = utterances[i];
      const print = extractVoiceprint(u.pcm);

      if (!print) {
        results.push({
          index: i,
          speakerId: u.id || 'unknown',
          speakerName: u.userName || 'Desconhecido',
          clusterId: -1,
          confidence: 0
        });
        continue;
      }

      // Tenta primeiro casar com perfil cadastrado
      const idResult = this.identifySpeaker(u.pcm, this.similarityThreshold);
      if (idResult.match) {
        results.push({
          index: i,
          speakerId: idResult.speakerId,
          speakerName: idResult.speakerName,
          clusterId: 0,
          confidence: idResult.score
        });
        continue;
      }

      // Se não casou com perfil conhecido, busca cluster acústico mais próximo
      let bestCluster = null;
      let maxSim = -1;

      for (const cluster of clusters) {
        const sim = cosineSimilarity(print, cluster.centroidVector);
        if (sim > maxSim) {
          maxSim = sim;
          bestCluster = cluster;
        }
      }

      if (bestCluster && maxSim >= 0.75) {
        const n = bestCluster.count;
        for (let j = 0; j < print.length; j++) {
          bestCluster.centroidVector[j] = (bestCluster.centroidVector[j] * n + print[j]) / (n + 1);
        }
        bestCluster.count++;

        results.push({
          index: i,
          speakerId: u.id || `cluster-${bestCluster.clusterId}`,
          speakerName: u.userName || `Locutor ${bestCluster.clusterId}`,
          clusterId: bestCluster.clusterId,
          confidence: Number(maxSim.toFixed(4))
        });
      } else {
        const newClusterId = clusters.length + 1;
        clusters.push({
          clusterId: newClusterId,
          centroidVector: print.slice(),
          count: 1
        });

        results.push({
          index: i,
          speakerId: u.id || `cluster-${newClusterId}`,
          speakerName: u.userName || `Locutor ${newClusterId}`,
          clusterId: newClusterId,
          confidence: 1.0
        });
      }
    }

    return results;
  }

  /**
   * Retorna estatísticas de telemetria dos perfis cadastrados.
   */
  getTelemetry() {
    return {
      enrolledSpeakersCount: this.profiles.size,
      similarityThreshold: this.similarityThreshold,
      activeProfiles: Array.from(this.profiles.values()).map(p => ({
        id: p.id,
        name: p.name,
        samples: p.sampleCount,
        lastSeen: new Date(p.lastSeen).toISOString()
      }))
    };
  }

  /**
   * Limpa todos os perfis biométricos da memória.
   */
  reset() {
    this.profiles.clear();
  }
}

module.exports = {
  SAMPLE_RATE,
  pcmToFloat32,
  calculateZCR,
  calculateRMS,
  estimatePitchF0,
  analyzeSpectralProfile,
  extractVoiceprint,
  cosineSimilarity,
  VoiceDiarizer
};
