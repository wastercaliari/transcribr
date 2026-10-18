// PURPOSE: Gerenciador em memória de gravação e consolidação de áudio por servidor (Guild) para exportação WAV.

const DEFAULT_SAMPLE_RATE = 16000;
const BYTES_PER_SECOND = DEFAULT_SAMPLE_RATE * 2; // 16-bit mono = 32000 bytes/s
const DEFAULT_MAX_BUFFER_BYTES = 25 * 1024 * 1024; // 25 MB max buffer por guild
const SILENCE_GAP_MS = 250; // 250ms de silêncio entre falas distintas
const SILENCE_GAP_BYTES = Math.round((SILENCE_GAP_MS / 1000) * BYTES_PER_SECOND);

// Map de guildId -> { utterances: [{ userName, timestamp, pcm: Buffer }], totalBytes: number }
const guildSessions = new Map();

function createWavHeader(dataLength, sampleRate = DEFAULT_SAMPLE_RATE) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(1, 22); // Mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); // Byte rate (SampleRate * Channels * BitsPerSample / 8)
    header.writeUInt16LE(2, 32); // Block align (Channels * BitsPerSample / 8)
    header.writeUInt16LE(16, 34); // Bits per sample
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);
    return header;
}

function getMaxBufferBytes() {
    const envMb = Number(process.env.MAX_AUDIO_BUFFER_MB);
    if (!isNaN(envMb) && envMb > 0) {
        return Math.min(envMb, 50) * 1024 * 1024;
    }
    return DEFAULT_MAX_BUFFER_BYTES;
}

function isRecordingEnabled() {
    return process.env.ENABLE_AUDIO_RECORDING !== 'false';
}

function recordAudioUtterance(guildId, userName, pcmBuffer, timestamp = Date.now(), maxBufferBytes = getMaxBufferBytes()) {
    if (!isRecordingEnabled()) {
        return false;
    }
    if (!guildId || !pcmBuffer || !Buffer.isBuffer(pcmBuffer) || pcmBuffer.length === 0) {
        return false;
    }

    let session = guildSessions.get(guildId);
    if (!session) {
        session = { utterances: [], totalBytes: 0 };
        guildSessions.set(guildId, session);
    }

    const chunk = Buffer.from(pcmBuffer);
    session.utterances.push({
        userName: userName || 'Alguém',
        timestamp,
        pcm: chunk
    });
    session.totalBytes += chunk.length;

    // Purga os trechos mais antigos se ultrapassar o teto seguro de memória
    while (session.totalBytes > maxBufferBytes && session.utterances.length > 1) {
        const removed = session.utterances.shift();
        session.totalBytes -= removed.pcm.length;
    }

    return true;
}

function exportSessionAudioWav(guildId, options = {}) {
    const session = guildSessions.get(guildId);
    if (!session || session.utterances.length === 0) {
        return null;
    }

    const maxSeconds = options.maxSeconds || 0;
    const maxBytes = options.maxBytes || 24 * 1024 * 1024; // 24 MB margem Discord
    const now = options.referenceTimestamp || Date.now();

    // Filtra falas que caem dentro da janela de tempo (se informada)
    let filtered = session.utterances;
    if (maxSeconds > 0) {
        const cutoffTime = now - (maxSeconds * 1000);
        filtered = session.utterances.filter(u => u.timestamp >= cutoffTime);
    }

    if (filtered.length === 0) {
        return null;
    }

    const pcmChunks = [];
    const speakersSet = new Set();
    let accumulatedBytes = 0;
    const silenceGap = Buffer.alloc(SILENCE_GAP_BYTES); // Amostras zero para transição suave

    for (let i = 0; i < filtered.length; i++) {
        const u = filtered[i];
        speakersSet.add(u.userName);

        // Se houver fala anterior e não for a primeira, insere um pequeno silêncio delimitador
        if (i > 0 && silenceGap.length > 0) {
            if (accumulatedBytes + silenceGap.length + u.pcm.length > maxBytes) {
                break; // Atingiu teto máximo seguro para envio
            }
            pcmChunks.push(silenceGap);
            accumulatedBytes += silenceGap.length;
        }

        if (accumulatedBytes + u.pcm.length > maxBytes) {
            // Se o primeiro já estoura, corta proporcionalmente
            const allowed = maxBytes - accumulatedBytes;
            if (allowed > 0) {
                // Alinha para amostra de 16-bit (múltiplo de 2 bytes)
                const aligned = allowed - (allowed % 2);
                if (aligned > 0) {
                    pcmChunks.push(u.pcm.subarray(0, aligned));
                    accumulatedBytes += aligned;
                }
            }
            break;
        }

        pcmChunks.push(u.pcm);
        accumulatedBytes += u.pcm.length;
    }

    if (pcmChunks.length === 0 || accumulatedBytes === 0) {
        return null;
    }

    const consolidatedPcm = Buffer.concat(pcmChunks);
    const wavHeader = createWavHeader(consolidatedPcm.length, DEFAULT_SAMPLE_RATE);
    const wavBuffer = Buffer.concat([wavHeader, consolidatedPcm]);
    const durationSeconds = Math.round((consolidatedPcm.length / BYTES_PER_SECOND) * 10) / 10;

    return {
        wavBuffer,
        durationSeconds,
        utteranceCount: filtered.length,
        totalBytes: wavBuffer.length,
        speakers: Array.from(speakersSet)
    };
}

function clearAudioSession(guildId) {
    if (!guildId) return false;
    return guildSessions.delete(guildId);
}

function getAudioSessionStats(guildId) {
    const session = guildSessions.get(guildId);
    if (!session) {
        return { utteranceCount: 0, totalDurationSec: 0, totalBytes: 0, speakers: [] };
    }
    const speakers = Array.from(new Set(session.utterances.map(u => u.userName)));
    return {
        utteranceCount: session.utterances.length,
        totalDurationSec: Math.round((session.totalBytes / BYTES_PER_SECOND) * 10) / 10,
        totalBytes: session.totalBytes,
        speakers
    };
}

module.exports = {
    recordAudioUtterance,
    exportSessionAudioWav,
    clearAudioSession,
    getAudioSessionStats,
    createWavHeader,
    DEFAULT_SAMPLE_RATE,
    BYTES_PER_SECOND
};
