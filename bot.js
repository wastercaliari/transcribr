// TranscriBR (servidor 24/7) — entra sozinho nas calls de voz e transcreve todo mundo.
//
// Roda num computador que fica sempre ligado. Ninguém precisa instalar nada:
// quando alguém entra num canal de voz, o bot entra junto e posta as falas no canal "transcribr-".
// Quando a call esvazia, ele sai. Motores de STT: Whisper local -> Groq -> Gemini (configurável).
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

// Tudo que aparece na tela também vai para logs/bot.log (ajuda a diagnosticar problemas)
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_PATH = path.join(LOG_DIR, 'bot.log');
try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > 2_000_000) fs.renameSync(LOG_PATH, LOG_PATH + '.old');
} catch { /* ignora */ }
for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
        original(...args);
        try {
            const text = args.map(a => typeof a === 'string' ? a : (a && a.stack) || JSON.stringify(a)).join(' ');
            fs.appendFileSync(LOG_PATH, `[${new Date().toLocaleString('pt-BR')}] ${text}\n`);
        } catch { /* ignora */ }
    };
}

// Trava de instância única
const lockServer = net.createServer();
if (require.main === module) {
    lockServer.listen(49152, '127.0.0.1');
    lockServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log('JÁ EXISTE OUTRA INSTÂNCIA DO BOT RODANDO. Encerrando esta.');
            process.exit(3);
        }
    });
}

const {
    Client, GatewayIntentBits, ChannelType, MessageFlags,
    PermissionFlagsBits, REST, Routes, SlashCommandBuilder, WebhookClient,
    AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const {
    joinVoiceChannel, EndBehaviorType, VoiceConnectionStatus, entersState
} = require('@discordjs/voice');
const prism = require('prism-media');
const {
    recordAudioUtterance,
    exportSessionAudioWav,
    clearAudioSession,
    getAudioSessionStats
} = require('./src/audio_recorder.js');
const { speechStorage } = require('./src/speech_storage.js');

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const WEBHOOK_URL = process.env.TRANSCRIBR_WEBHOOK_URL || '';
// Ordem dos motores: groq (Whisper large-v3 gratuito na nuvem) ou local (offline)
const STT_ORDER = (process.env.STT_ORDER || 'groq').split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
const LOCAL_MAX_QUEUE = Number(process.env.LOCAL_MAX_QUEUE || 2);
const LEAVE_GRACE_MS = 15_000;

// Código de saída 2 = erro de configuração (o iniciar_servidor.bat não fica reiniciando em loop)
if (require.main === module && (!DISCORD_TOKEN || /cole_o_token/i.test(DISCORD_TOKEN))) {
    console.error('ERRO: DISCORD_BOT_TOKEN não configurado no arquivo .env! Rode instalar_servidor.bat ou edite o .env.');
    process.exit(2);
}
const webhook = (() => {
    const m = WEBHOOK_URL.match(/webhooks\/(\d+)\/([\w-]+)/);
    return m ? new WebhookClient({ id: m[1], token: m[2] }) : null;
})();

const STATE_FILE = path.join(__dirname, 'server_state.json');
let state = { paused: false };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch { /* primeira execução */ }
const LOG_FILE = path.join(__dirname, 'transcript_log.jsonl');
function logLine(guildId, author, text) {
    try {
        speechStorage.logLine(guildId, author, text);
    } catch { /* ignora */ }
}
function readLog(guildId, sinceMs) {
    try {
        return speechStorage.readLog(guildId, sinceMs);
    } catch { return []; }
}
function pruneLog() {
    try {
        speechStorage.pruneLog();
    } catch { /* sem log ainda */ }
}
const saveState = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); } catch { /* ignora */ } };

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const isTranscribrChannel = (name) => /^trans(cr|ci)br/.test(name.toLowerCase());
const sessions = new Map();        // guildId -> { connection, voiceChannel, listening:Set }
const leaveTimers = new Map();     // guildId -> timeout
const history = new Map();         // guildId -> últimas falas

// ---------- Whisper local (stt_server.py) ----------
let sttProc = null;
let localReady = false;
let sttDisabled = false;
let sttExits = [];
const STT_URL = 'http://127.0.0.1:8765/';

// Escolhe o Python: .venv do instalador > "py -3" (ignora o atalho falso da Microsoft Store) > python
function pythonCommand() {
    if (process.env.PYTHON) return [process.env.PYTHON, []];
    const venvPy = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
    const venvPyUnix = path.join(__dirname, '.venv', 'bin', 'python');
    if (fs.existsSync(venvPy)) return [venvPy, []];
    if (fs.existsSync(venvPyUnix)) return [venvPyUnix, []];
    try {
        if (require('child_process').spawnSync('py', ['-3', '--version']).status === 0) return ['py', ['-3']];
    } catch { /* sem py */ }
    return ['python', []];
}

function startLocalStt() {
    if (!STT_ORDER.includes('local') || sttDisabled) return;
    const [cmd, args] = pythonCommand();
    localReady = false;
    sttProc = spawn(cmd, [...args, path.join(__dirname, 'stt_server.py')], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
    const relay = (d) => String(d).split(/\r?\n/).filter(l => l.trim()).forEach(l => console.log(l));
    sttProc.stdout.on('data', relay);
    sttProc.stderr.on('data', relay);
    sttProc.on('error', e => console.error('Whisper local não iniciou:', e.message));
    sttProc.on('exit', (code) => {
        localReady = false;
        const now = Date.now();
        sttExits = sttExits.filter(t => now - t < 120_000);
        sttExits.push(now);
        if (sttExits.length >= 3) {
            sttDisabled = true;
            console.error('❌ Whisper local falhou 3 vezes seguidas e foi desativado. O bot segue com Groq/Gemini. ' +
                'Rode diagnostico.bat para ver o motivo.');
            return;
        }
        console.warn(`Whisper local encerrou (código ${code}); reiniciando em 10 s...`);
        setTimeout(startLocalStt, 10_000);
    });
}

// Só usa o Whisper local quando ele já respondeu ao teste de saúde (evita "fetch failed" durante o carregamento)
function watchLocalStt() {
    if (!STT_ORDER.includes('local')) return;
    setInterval(async () => {
        try {
            const ok = (await fetch(STT_URL, { signal: AbortSignal.timeout(2000) })).ok;
            if (ok && !localReady) console.log('✅ Whisper local pronto.');
            localReady = ok;
        } catch { localReady = false; }
    }, 5000);
}
let localPending = 0;

// ---------- Áudio ----------
const RMS_THRESHOLD = 200;
const MIN_SPEECH_SECONDS = 1.0;
const TRIM_FRAME_BYTES = 640;
const TRIM_PADDING_FRAMES = 9;

function trimTrailingSilence(pcm) {
    const rmsOf = (start) => {
        let sum = 0, n = 0;
        for (let i = start; i + 1 < Math.min(start + TRIM_FRAME_BYTES, pcm.length); i += 2) {
            const v = pcm.readInt16LE(i); sum += v * v; n++;
        }
        return n ? Math.sqrt(sum / n) : 0;
    };
    let end = pcm.length - (pcm.length % TRIM_FRAME_BYTES);
    while (end > 0 && rmsOf(end - TRIM_FRAME_BYTES) < RMS_THRESHOLD) end -= TRIM_FRAME_BYTES;
    end = Math.min(pcm.length, end + TRIM_PADDING_FRAMES * TRIM_FRAME_BYTES);
    return pcm.subarray(0, end);
}

function pcmToWav(pcm, sampleRate = 16000) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
}

function preprocessAudio(pcm, sampleRate = 16000) {
    const n = Math.floor(pcm.length / 2);
    const out = Buffer.alloc(n * 2);
    const rc = 1 / (2 * Math.PI * 100);
    const alpha = rc / (rc + 1 / sampleRate);
    let prevX = 0, prevY = 0, peak = 1;
    const filtered = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = pcm.readInt16LE(i * 2);
        const y = alpha * (prevY + x - prevX);
        prevX = x; prevY = y;
        filtered[i] = y;
        const a = Math.abs(y);
        if (a > peak) peak = a;
    }
    const gain = Math.min(8, Math.max(1, 22000 / peak));
    for (let i = 0; i < n; i++) {
        out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(filtered[i] * gain))), i * 2);
    }
    return out;
}

// ---------- Filtros de texto ----------
const TAG_REGEX = /^(<[^>]+>|\[[^\]]+\]|\([^\)]+\)|\d+:\d+)$/i;
const IGNORED_WORDS = new Set([
    'noise', '<noise>', 'ruído', '<ruído>', 'chiado', 'som', '0:00', '00:00',
    'silêncio', '[silêncio]', 'silencio', '[silencio]', 'música', '[música]', 'ininteligível', '[ininteligível]'
]);
const WHISPER_HALLUCINATIONS = /legendas? (pela|por|de) |amara\.org|obrigado por assistir|inscreva-se|se inscreva|deixe seu like|tradu[çc][ãa]o:|subtitles? by|thanks for watching|www\.|\.com/i;

function applyCorrections(text) {
    try {
        const file = path.join(__dirname, 'corrections.json');
        if (!fs.existsSync(file)) return text;
        const dict = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const [wrong, right] of Object.entries(dict)) {
            if (!wrong || wrong.startsWith('_')) continue;
            const esc = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'giu'), right);
        }
    } catch (e) { console.warn('corrections.json inválido:', e.message); }
    return text;
}

function isSuspicious(text, seconds) {
    if (WHISPER_HALLUCINATIONS.test(text)) return 'frase típica de alucinação';
    if (text.length / Math.max(seconds, 0.1) > 30) return 'texto longo demais para a duração';
    const words = text.toLowerCase().split(/\s+/);
    if (words.length >= 6 && new Set(words).size / words.length < 0.3) return 'repetição em loop';
    return null;
}

// Interpreta a resposta de um Whisper: descarta segmentos suspeitos e devolve { text, conf, nsp }
//  conf = média do avg_logprob dos segmentos mantidos (quanto mais perto de 0, mais confiante)
//  nsp  = maior no_speech_prob entre os segmentos mantidos
function parseWhisper(data, seconds) {
    const segs = Array.isArray(data.segments) ? data.segments : [];
    let text, conf = null, nsp = 0;
    if (segs.length) {
        const kept = segs.filter(sg => {
            const bad = sg.no_speech_prob > 0.6 || sg.avg_logprob < -1.0 || sg.compression_ratio > 2.4;
            if (bad) console.log(`🛑 Segmento descartado: "${(sg.text || '').trim()}"`);
            return !bad;
        });
        text = kept.map(sg => (sg.text || '').trim()).join(' ').trim();
        if (kept.length) {
            conf = kept.reduce((a, sg) => a + sg.avg_logprob, 0) / kept.length;
            nsp = Math.max(...kept.map(sg => sg.no_speech_prob || 0));
        }
    } else {
        text = (data.text || '').trim();
    }
    const why = text ? isSuspicious(text, seconds) : null;
    if (why) { console.log(`🛑 Descartado (${why}): "${text}"`); return { text: '', conf: null, nsp: 0 }; }
    return { text, conf, nsp };
}

// ---------- Vocabulário (nomes, gírias, termos do grupo) ----------
let vocabCache = { mtime: 0, words: [] };
function vocabulary() {
    try {
        const file = path.join(__dirname, 'vocabulario.txt');
        const st = fs.statSync(file);
        if (st.mtimeMs !== vocabCache.mtime) {
            const words = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
            vocabCache = { mtime: st.mtimeMs, words };
        }
        return vocabCache.words;
    } catch { return []; }
}
const hintTerms = (names) => [...new Set([...names, ...vocabulary()])];
const stylePrompt = (names) => {
    const terms = hintTerms(names).join(', ');
    return `Transcrição em português do Brasil, pontuação correta, mantendo gírias, palavrões e termos: ${terms}.`.slice(0, 850);
};

// ---------- Motores de STT ----------
// Cada motor devolve { text, conf, nsp, engine }
async function sttLocal(wav, names, seconds) {
    const q = `prompt=${encodeURIComponent(stylePrompt(names))}&hotwords=${encodeURIComponent(hintTerms(names).join(' ').slice(0, 400))}`;
    const resp = await fetch(`${STT_URL}transcribe?${q}`, {
        method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav, signal: AbortSignal.timeout(60_000)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    return { ...parseWhisper(await resp.json(), seconds), engine: 'local' };
}

let groqBlockedUntil = 0;   // disjuntor: depois de um 429 (limite da cota gratuita) fica um tempo sem tentar
async function sttGroq(wav, names, seconds) {
    const form = new FormData();
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', 'whisper-large-v3');
    form.append('language', 'pt');
    form.append('temperature', '0');
    form.append('response_format', 'verbose_json');
    form.append('prompt', stylePrompt(names));
    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${GROQ_API_KEY}` }, body: form, signal: AbortSignal.timeout(20_000)
    });
    if (resp.status === 429) {
        const wait = Math.min(Math.max(Number(resp.headers.get('retry-after')) || 60, 5), 3600);
        groqBlockedUntil = Date.now() + wait * 1000;
        throw new Error(`limite da Groq atingido; pausando por ${wait}s`);
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    return { ...parseWhisper(await resp.json(), seconds), engine: 'groq' };
}

const ENGINE_LABEL = { local: 'Whisper local', groq: 'Groq Whisper' };

function availableEngines() {
    const list = [];
    for (const e of STT_ORDER) {
        if (e === 'local' && !sttDisabled) list.push('local');
        else if (e === 'groq' && GROQ_API_KEY) list.push('groq');
    }
    return list;
}

// Executa um motor, respeitando fila do Whisper local e disjuntor da Groq. Lança erro se indisponível.
async function runEngine(id, wav, names, seconds, isLast) {
    if (id === 'local') {
        if (!isLast && (!localReady || localPending >= LOCAL_MAX_QUEUE)) throw new Error('indisponível agora');
        localPending++;
        try { return await sttLocal(wav, names, seconds); } finally { localPending--; }
    }
    if (Date.now() < groqBlockedUntil && !isLast) throw new Error('em pausa (limite atingido)');
    return await sttGroq(wav, names, seconds);
}

// ---------- Telemetria de Transcrição ----------
const telemetry = {
    audioChunksReceived: 0,
    audioDurationSeconds: 0,
    transcriptionsPosted: 0,
    hallucinationsDiscarded: 0,
    duplicatesSkipped: 0,
    engineUsage: { groq: 0, local: 0 },
    totalLatencyMs: 0,
    latencySamples: 0
};

function recordTranscriptionMetric({ durationSec, engine, latencyMs, posted, discarded, duplicate }) {
    telemetry.audioChunksReceived++;
    if (durationSec) telemetry.audioDurationSeconds += Number(durationSec) || 0;
    if (posted) telemetry.transcriptionsPosted++;
    if (discarded) telemetry.hallucinationsDiscarded++;
    if (duplicate) telemetry.duplicatesSkipped++;
    if (engine && telemetry.engineUsage[engine] !== undefined) telemetry.engineUsage[engine]++;
    if (latencyMs) {
        telemetry.totalLatencyMs += latencyMs;
        telemetry.latencySamples++;
    }
}

function getTelemetryMetrics() {
    return {
        audioChunksReceived: telemetry.audioChunksReceived,
        audioDurationTotalSec: Math.round(telemetry.audioDurationSeconds * 10) / 10,
        transcriptionsPosted: telemetry.transcriptionsPosted,
        hallucinationsDiscarded: telemetry.hallucinationsDiscarded,
        duplicatesSkipped: telemetry.duplicatesSkipped,
        avgLatencyMs: telemetry.latencySamples ? Math.round(telemetry.totalLatencyMs / telemetry.latencySamples) : 0,
        engineUsage: { ...telemetry.engineUsage }
    };
}

async function transcribe(wav, names, seconds, userName) {
    const engines = availableEngines();
    if (!engines.length) {
        console.warn(`⚠️ Nenhum motor disponível! STT_ORDER: [${STT_ORDER.join(', ')}], Groq: ${!!GROQ_API_KEY}`);
        return null;
    }
    let primary = null;
    for (let i = 0; i < engines.length; i++) {
        const isLast = i === engines.length - 1;
        try { primary = await runEngine(engines[i], wav, names, seconds, isLast); break; }
        catch (e) { console.warn(`${ENGINE_LABEL[engines[i]]} falhou${isLast ? '' : ', tentando o próximo'}: ${e.message}`); }
    }
    return primary;
}

// ---------- Postagem ----------
const textChannels = new Map();
async function postText(guild, payload) {
    const opts = typeof payload === 'string' ? { content: payload, flags: MessageFlags.SuppressNotifications } : payload;
    if (webhook && !opts.components) {
        try { await webhook.send(opts); return; } catch (e) { console.warn('Webhook falhou:', e.message); }
    }
    let ch = textChannels.get(guild.id);
    if (!ch) {
        const all = await guild.channels.fetch();
        ch = all.find(c => c && c.type === ChannelType.GuildText && isTranscribrChannel(c.name));
        if (ch) textChannels.set(guild.id, ch);
    }
    if (!ch) { console.error('Canal "transcribr-" não encontrado.'); return; }
    await ch.send(opts);
}

// ---------- Sessão de voz ----------
function humansIn(channel) {
    return [...channel.members.values()].filter(m => !m.user.bot);
}

function startListening(guild, session) {
    const { connection, voiceChannel, listening } = session;
    const receiver = connection.receiver;
    const memberOf = (id) => voiceChannel.members.get(id);
    const isMuted = (id) => { const v = memberOf(id)?.voice; return !!v && (v.mute || v.deaf); };

    receiver.speaking.on('start', (userId) => {
        if (listening.has(userId) || isMuted(userId)) return;
        const m = memberOf(userId);
        if (m?.user.bot) return;
        listening.add(userId);
        const userName = m?.displayName || client.users.cache.get(userId)?.username || 'Alguém';

        const opusStream = receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 } });
        const decoder = new prism.opus.Decoder({ rate: 16000, channels: 1, frameSize: 320 });
        const chunks = [];
        opusStream.pipe(decoder);
        decoder.on('data', c => chunks.push(c));
        const release = () => listening.delete(userId);
        opusStream.on('error', release);
        decoder.on('error', release);
        decoder.on('close', release);

        decoder.on('end', async () => {
            release();
            if (isMuted(userId)) return;
            const pcm = trimTrailingSilence(Buffer.concat(chunks));
            if (pcm.length < MIN_SPEECH_SECONDS * 32000) return;
            let sum = 0;
            for (let i = 0; i + 1 < pcm.length; i += 2) { const s = pcm.readInt16LE(i); sum += s * s; }
            const rms = Math.sqrt(sum / (pcm.length / 2));
            if (rms < RMS_THRESHOLD) return;

            const names = humansIn(voiceChannel).map(x => x.displayName);
            const seconds = (pcm.length / 32000).toFixed(1);
            console.log(`🎙️ [${userName}] ${seconds}s RMS=${Math.round(rms)}`);
            try {
                const t0 = Date.now();
                const wav = pcmToWav(preprocessAudio(pcm));
                const sttResult = await transcribe(wav, names, seconds, userName);
                const latencyMs = Date.now() - t0;
                const raw = ((sttResult && sttResult.text) || '').trim();
                const cleaned = raw.toLowerCase().replace(/^[ .!?,;"]+|[ .!?,;"]+$/g, '');
                if (!raw || cleaned.length < 2) {
                    recordTranscriptionMetric({ durationSec: seconds, latencyMs, discarded: true });
                    return;
                }
                if (IGNORED_WORDS.has(cleaned) || TAG_REGEX.test(raw)) {
                    recordTranscriptionMetric({ durationSec: seconds, latencyMs, discarded: true });
                    return;
                }
                const text = applyCorrections(raw.replace(/<[^>]+>/g, '').trim());
                if (!text) {
                    recordTranscriptionMetric({ durationSec: seconds, latencyMs, discarded: true });
                    return;
                }
                if (isDuplicateTranscription(guild.id, userName, text)) {
                    console.log(`🛡️ [Deduplicação] Fala repetida ignorada para ${userName}: "${text}"`);
                    recordTranscriptionMetric({ durationSec: seconds, latencyMs, duplicate: true });
                    return;
                }
                logLine(guild.id, userName, text);
                recordAudioUtterance(guild.id, userName, preprocessAudio(pcm));
                await postText(guild, `🎙️ **${userName}**: ${text}`);
                console.log(`📤 [${userName}] "${text}"`);
                recordTranscriptionMetric({ durationSec: seconds, latencyMs, engine: sttResult?.engine, posted: true });
            } catch (err) {
                console.error(`Erro ao transcrever ${userName}:`, err.message || err);
            }
        });
    });
}

const recentTranscriptions = new Map(); // guildId -> Map(author -> { text, time })
function isDuplicateTranscription(guildId, author, text) {
    let guildMap = recentTranscriptions.get(guildId);
    if (!guildMap) {
        guildMap = new Map();
        recentTranscriptions.set(guildId, guildMap);
    }
    const last = guildMap.get(author);
    const now = Date.now();
    if (last && last.text === text && (now - last.time) < 4000) {
        return true;
    }
    guildMap.set(author, { text, time: now });
    return false;
}

const reconnectAttempts = new Map(); // guildId -> { count, timer }

function scheduleReconnection(guild, voiceChannel) {
    clearTimeout(reconnectAttempts.get(guild.id)?.timer);
    const prev = reconnectAttempts.get(guild.id)?.count || 0;
    const count = prev + 1;
    const delay = Math.min(1000 * Math.pow(2, count - 1), 30_000);
    console.warn(`🔄 Reconectando à voz em "${voiceChannel.name}" (tentativa ${count}) em ${(delay / 1000).toFixed(1)}s...`);

    const timer = setTimeout(async () => {
        try {
            await joinChannel(voiceChannel);
            reconnectAttempts.delete(guild.id);
        } catch (e) {
            console.error(`Falha na reconexão (tentativa ${count}):`, e.message);
            if (count < 5) {
                scheduleReconnection(guild, voiceChannel);
            } else {
                console.error(`❌ Limite de reconexões atingido para "${guild.name}". Aguardando próximo ciclo.`);
                reconnectAttempts.delete(guild.id);
            }
        }
    }, delay);

    reconnectAttempts.set(guild.id, { count, timer });
}

const joining = new Set();
async function joinChannel(voiceChannel) {
    const guild = voiceChannel.guild;
    if (joining.has(guild.id)) return;
    joining.add(guild.id);
    let connection = null;
    try {
        const old = sessions.get(guild.id);
        if (old) {
            if (old.voiceChannel.id === voiceChannel.id && old.connection.state.status === VoiceConnectionStatus.Ready) {
                return;
            }
            try {
                old.connection.receiver?.speaking?.removeAllListeners();
                old.connection.destroy();
            } catch { /* ignora */ }
            sessions.delete(guild.id);
        }

        connection = joinVoiceChannel({
            channelId: voiceChannel.id, guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator, selfDeaf: false, selfMute: true
        });

        try { connection.receiver?.speaking?.removeAllListeners(); } catch { /* ignora */ }

        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
        reconnectAttempts.delete(guild.id);

        const session = { connection, voiceChannel, listening: new Set() };
        sessions.set(guild.id, session);

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
                ]);
                reconnectAttempts.delete(guild.id);
            } catch {
                try { connection.destroy(); } catch { /* ignora */ }
            }
        });
        connection.on(VoiceConnectionStatus.Destroyed, () => {
            if (sessions.get(guild.id)?.connection === connection) {
                sessions.delete(guild.id);
                const liveChannel = guild.channels.cache.get(voiceChannel.id) || voiceChannel;
                if (!state.paused && humansIn(liveChannel).length > 0) {
                    scheduleReconnection(guild, liveChannel);
                } else {
                    setTimeout(() => reconcile(guild), 3_000);
                }
            }
        });

        state.targetChannels = state.targetChannels || {};
        state.targetChannels[guild.id] = voiceChannel.id;
        saveState();

        startListening(guild, session);
        console.log(`✅ Entrei em "${voiceChannel.name}" (${humansIn(voiceChannel).length} pessoa(s))`);
    } catch (e) {
        try { connection?.destroy(); } catch { /* ignora */ }
        throw e;
    } finally {
        joining.delete(guild.id);
    }
}

function leave(guild) {
    clearTimeout(leaveTimers.get(guild.id));
    leaveTimers.delete(guild.id);
    clearTimeout(reconnectAttempts.get(guild.id)?.timer);
    reconnectAttempts.delete(guild.id);
    if (state.targetChannels?.[guild.id]) {
        delete state.targetChannels[guild.id];
        saveState();
    }
    const s = sessions.get(guild.id);
    if (!s) return;
    const channelName = s.voiceChannel.name;
    sessions.delete(guild.id);
    history.delete(guild.id);
    try {
        s.connection.receiver?.speaking?.removeAllListeners();
        s.connection.destroy();
    } catch { /* ignora */ }
    console.log(`👋 Saí de "${channelName}"`);

    // Posta botões interativos para geração de ata com 1 clique (SCRUM-44)
    try {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_resumo_30m')
                .setLabel('📝 Ata Técnica (30m)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('btn_resumo_1h')
                .setLabel('📋 Ata Técnica (1h)')
                .setStyle(ButtonStyle.Secondary)
        );
        postText(guild, {
            content: `👋 Chamada em **${channelName}** finalizada. Clique abaixo para receber a ata técnica no privado com 1 clique:`,
            components: [row]
        }).catch(() => {});
    } catch { /* ignora */ }
}

function selectTargetVoiceChannel(guild, targetChannelId, stateObj = state) {
    if (stateObj?.paused) return null;

    // Se houver um canal previamente fixado e ainda contiver pessoas, prioridade absoluta!
    if (targetChannelId) {
        const target = guild.channels?.cache?.get(targetChannelId);
        if (target &&
            (target.type === ChannelType.GuildVoice || target.type === ChannelType.GuildStageVoice || target.type === 2) &&
            target.id !== guild.afkChannelId &&
            humansIn(target).length > 0 &&
            (!client.user || target.permissionsFor(client.user)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]))) {
            return target;
        } else if (target && humansIn(target).length === 0) {
            // Canal fixado ficou sem ninguém: limpa fixação
            if (stateObj?.targetChannels?.[guild.id]) {
                delete stateObj.targetChannels[guild.id];
                if (typeof saveState === 'function') saveState();
            }
        }
    }

    // Busca dentre os canais elegíveis aquele com mais participantes
    const channels = [...(guild.channels?.cache?.values() || [])].filter(c =>
        (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice || c.type === 2) &&
        c.id !== guild.afkChannelId &&
        humansIn(c).length > 0 &&
        (!client.user || c.permissionsFor(client.user)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])));

    if (!channels.length) return null;
    channels.sort((a, b) => humansIn(b).length - humansIn(a).length);
    return channels[0];
}

const busy = new Set();
async function reconcile(guild) {
    if (busy.has(guild.id) || joining.has(guild.id)) return;
    if (reconnectAttempts.has(guild.id)) {
        // Reconexão ativa agendada para o canal atual: nunca desviar para outro canal
        return;
    }
    busy.add(guild.id);
    try {
        const session = sessions.get(guild.id);
        if (state.paused) { if (session) leave(guild); return; }

        if (session) {
            const currentChannel = guild.channels.cache.get(session.voiceChannel.id) || session.voiceChannel;
            if (humansIn(currentChannel).length > 0) {
                clearTimeout(leaveTimers.get(guild.id));
                leaveTimers.delete(guild.id);
                return;
            }
            // Call vazia: espera um pouco antes de sair
            if (!leaveTimers.has(guild.id)) {
                leaveTimers.set(guild.id, setTimeout(() => {
                    leaveTimers.delete(guild.id);
                    const s = sessions.get(guild.id);
                    if (!s) return;
                    const ch = guild.channels.cache.get(s.voiceChannel.id) || s.voiceChannel;
                    if (humansIn(ch).length === 0) {
                        leave(guild);
                        reconcile(guild);
                    }
                }, LEAVE_GRACE_MS));
            }
            return;
        }

        // Sem sessão ativa: busca o canal alvo respeitando a fixação
        const target = selectTargetVoiceChannel(guild, state.targetChannels?.[guild.id]);
        if (!target) return;

        try {
            await joinChannel(target);
        } catch (e) {
            console.error('Falha ao entrar na call:', e.message);
            scheduleReconnection(guild, target);
        }
    } finally {
        busy.delete(guild.id);
    }
}

client.on('voiceStateUpdate', (oldS, newS) => {
    if (newS.member?.id === client.user.id || oldS.member?.id === client.user.id) return;
    if (newS.member?.user.bot) return;
    const guild = newS.guild || oldS.guild;
    if (guild) reconcile(guild);
});

// ---------- Comandos ----------
const COMMANDS = [
    new SlashCommandBuilder().setName('transcrever').setDescription('Inicia a transcrição (entra na sua call, ou na que tiver gente).'),
    new SlashCommandBuilder().setName('parar').setDescription('Pausa o bot: sai da call e para de transcrever.'),
    new SlashCommandBuilder().setName('resumo').setDescription('Gera uma ata técnica da conversa de voz e envia no seu privado.')
        .addNumberOption(o => o.setName('horas')
            .setDescription('Quantidade de horas para trás (ex.: 2)')
            .setMinValue(0)
            .setMaxValue(168)
            .setRequired(false))
        .addNumberOption(o => o.setName('minutos')
            .setDescription('Quantidade de minutos para trás (ex.: 30)')
            .setMinValue(0)
            .setMaxValue(1440)
            .setRequired(false))
        .addNumberOption(o => o.setName('segundos')
            .setDescription('Quantidade de segundos para trás (ex.: 90)')
            .setMinValue(0)
            .setMaxValue(86400)
            .setRequired(false)),
    new SlashCommandBuilder().setName('limpar').setDescription('Apaga TODAS as mensagens do canal de transcrição (transcribr-).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder().setName('status').setDescription('Mostra se o bot está transcrevendo.'),
    new SlashCommandBuilder().setName('audio').setDescription('Exporta o áudio WAV consolidado das falas recentes da chamada.')
        .addNumberOption(o => o.setName('minutos')
            .setDescription('Minutos para trás (ex: 15). Se omitido, exporta toda a sessão recente.')
            .setMinValue(1)
            .setMaxValue(1440)
            .setRequired(false))
].map(c => c.toJSON());

function splitMessage(text, max = 1900) {
    if (!text) return [];
    const parts = [];
    let rest = text.trim();
    while (rest.length > max) {
        let cut = rest.lastIndexOf('\n', max);
        if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
        if (cut < max * 0.5) cut = max;

        let chunk = rest.slice(0, cut).trim();
        rest = rest.slice(cut).trim();

        // Preserva paridade de blocos de código Markdown (```)
        const codeBlockMatches = chunk.match(/```/g);
        if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
            const lastCodeBlockIndex = chunk.lastIndexOf('```');
            const afterBackticks = chunk.slice(lastCodeBlockIndex + 3);
            const langMatch = afterBackticks.match(/^([a-zA-Z0-9_-]+)/);
            const lang = langMatch ? langMatch[1] : '';

            chunk += '\n```';
            rest = '```' + lang + '\n' + rest;
        }

        parts.push(chunk);
    }
    if (rest) parts.push(rest);
    return parts;
}

async function groqChatText(prompt) {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY não configurada no .env.');
    const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
    let lastError = '';
    for (const model of models) {
        try {
            const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    temperature: 0.3,
                    max_tokens: 1500,
                    messages: [{ role: 'user', content: prompt }]
                }),
                signal: AbortSignal.timeout(35_000)
            });
            if (resp.ok) {
                const data = await resp.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) return { text: content.trim(), model: `Groq (${model})` };
            } else {
                const errData = await resp.json().catch(() => ({}));
                const msg = errData?.error?.message || (await resp.text().catch(() => '')) || `HTTP ${resp.status}`;
                lastError = msg;
                console.warn(`Groq chat ${model} falhou (${resp.status}): ${msg}`);
            }
        } catch (e) {
            lastError = e.message;
            console.warn(`Groq chat ${model} falhou:`, e.message);
        }
    }
    throw new Error(`Modelos de texto da Groq indisponíveis no momento (${lastError || 'limite temporário'}). Aguarde alguns instantes e tente novamente.`);
}

async function summarizeText(prompt) {
    if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY não configurada no .env.');
    }
    return await groqChatText(prompt);
}

// Apaga todas as mensagens do canal "transcribr-" (em lote as com menos de 14 dias, uma a uma as mais antigas)
let cleaning = false;
async function handleLimpar(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (cleaning) return i.editReply('⏳ Já existe uma limpeza em andamento.');
    const all = await i.guild.channels.fetch();
    const ch = all.find(c => c && c.type === ChannelType.GuildText && isTranscribrChannel(c.name));
    if (!ch) return i.editReply('❌ Não encontrei o canal de texto "transcribr-".');
    const perms = ch.permissionsFor(client.user);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages])) {
        return i.editReply(`❌ Preciso das permissões **Gerenciar mensagens** e **Ver histórico de mensagens** em <#${ch.id}>.`);
    }
    cleaning = true;
    let total = 0;
    let lastFirst = null;
    try {
        await i.editReply(`🧹 Limpando <#${ch.id}>...`);
        for (;;) {
            const batch = await ch.messages.fetch({ limit: 100 });
            if (!batch.size || batch.first().id === lastFirst) break;   // acabou (ou nada mais pode ser apagado)
            lastFirst = batch.first().id;
            const cutoff = Date.now() - 14 * 24 * 3600 * 1000 + 60_000;
            const recent = batch.filter(m => m.createdTimestamp > cutoff);
            const old = batch.filter(m => m.createdTimestamp <= cutoff);
            if (recent.size >= 2) { total += (await ch.bulkDelete(recent, true)).size; }
            else { for (const m of recent.values()) { await m.delete().catch(() => {}); total++; } }
            for (const m of old.values()) { await m.delete().catch(() => {}); total++; }
            if (total % 500 < 100) i.editReply(`🧹 Limpando... ${total} mensagens apagadas até agora.`).catch(() => {});
        }
        clearAudioSession(i.guild.id);
        speechStorage.clearGuild(i.guild.id);
        console.log(`🧹 /limpar: ${total} mensagens apagadas em #${ch.name}`);
        await i.editReply(`🧹 Pronto! ${total} mensagem(ns) apagada(s) de <#${ch.id}> e histórico de áudio/falas limpo.`).catch(() => {});
    } finally {
        cleaning = false;
    }
}

function formatTimeWindow(totalSec) {
    const parts = [];
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.round(totalSec % 60);
    if (h > 0) parts.push(`${h} hora(s)`);
    if (m > 0) parts.push(`${m} minuto(s)`);
    if (s > 0 || parts.length === 0) parts.push(`${s} segundo(s)`);
    return parts.join(' e ');
}

function formatDiscordMarkdown(text) {
    if (!text) return '';
    const lines = text.split('\n');
    const cleaned = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Remove linhas separadoras de tabela: |---|---| ou |:---|:---|
        if (/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(line)) {
            continue;
        }
        // Converte linhas de tabela (| Item 1 | Item 2 |) em tópicos legíveis para Discord
        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').map(c => c.trim()).filter(Boolean);
            if (cells.length > 0) {
                if (cells.length === 1) {
                    cleaned.push(`• ${cells[0]}`);
                } else {
                    cleaned.push(`• **${cells[0]}**: ${cells.slice(1).join(' — ')}`);
                }
                continue;
            }
        }
        cleaned.push(lines[i]);
    }
    return cleaned.join('\n');
}

// ---------- Integração e Sincronização com Confluence (SCRUM-45 / I-2) ----------
function formatInlineHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function markdownToConfluenceStorage(markdown) {
    if (!markdown) return '';
    const lines = markdown.split('\n');
    const htmlLines = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        if (!line) {
            if (inList) { htmlLines.push('</ul>'); inList = false; }
            continue;
        }

        if (line.startsWith('### ')) {
            if (inList) { htmlLines.push('</ul>'); inList = false; }
            htmlLines.push(`<h3>${formatInlineHtml(line.slice(4))}</h3>`);
            continue;
        }
        if (line.startsWith('## ')) {
            if (inList) { htmlLines.push('</ul>'); inList = false; }
            htmlLines.push(`<h2>${formatInlineHtml(line.slice(3))}</h2>`);
            continue;
        }
        if (line.startsWith('# ')) {
            if (inList) { htmlLines.push('</ul>'); inList = false; }
            htmlLines.push(`<h1>${formatInlineHtml(line.slice(2))}</h1>`);
            continue;
        }
        if (line === '---' || line === '***') {
            if (inList) { htmlLines.push('</ul>'); inList = false; }
            htmlLines.push('<hr />');
            continue;
        }
        if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
            if (!inList) { htmlLines.push('<ul>'); inList = true; }
            htmlLines.push(`  <li>${formatInlineHtml(line.slice(2))}</li>`);
            continue;
        }

        if (inList) { htmlLines.push('</ul>'); inList = false; }
        htmlLines.push(`<p>${formatInlineHtml(line)}</p>`);
    }
    if (inList) { htmlLines.push('</ul>'); inList = false; }
    return htmlLines.join('\n');
}

let cachedAtlassianToken = null;
function getConfluenceToken(explicitToken) {
    if (explicitToken !== undefined) return explicitToken || null;
    if (process.env.CONFLUENCE_API_TOKEN !== undefined) {
        return process.env.CONFLUENCE_API_TOKEN || null;
    }
    if (process.env.ATLASSIAN_API_TOKEN !== undefined) {
        return process.env.ATLASSIAN_API_TOKEN || null;
    }
    if (cachedAtlassianToken) return cachedAtlassianToken;
    try {
        const fs = require('fs');
        const path = require('path');
        const tokenFile = path.resolve(__dirname, 'Atlassian Account.txt');
        if (fs.existsSync(tokenFile)) {
            const raw = fs.readFileSync(tokenFile, 'utf8');
            const match = raw.match(/ATATT[A-Za-z0-9_\-=]+/);
            if (match) {
                cachedAtlassianToken = match[0];
                return cachedAtlassianToken;
            }
        }
    } catch { /* ignora */ }
    return null;
}

async function syncAtaToConfluence({ title, summaryMarkdown, transcriptLines, timeWindow, model, token: explicitToken }) {
    const token = getConfluenceToken(explicitToken);
    const email = process.env.CONFLUENCE_EMAIL || 'wasterlucas@gmail.com';
    const domain = process.env.CONFLUENCE_DOMAIN || 'wastercaliari.atlassian.net';
    const spaceKey = process.env.CONFLUENCE_SPACE || 'TBR';
    const parentId = process.env.CONFLUENCE_PARENT_PAGE_ID || '327687';

    if (!token) {
        return { success: false, skipped: true, reason: 'CONFLUENCE_API_TOKEN não configurado' };
    }

    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    const storageHtml =
        `<p><strong>Data da Reunião:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>` +
        `<p><strong>Janela de Áudio:</strong> ${timeWindow}</p>` +
        `<p><strong>Motor de Inteligência Artificial:</strong> ${model}</p>` +
        `<hr />` +
        `<h2>Ata Técnica Estruturada</h2>` +
        markdownToConfluenceStorage(summaryMarkdown) +
        `<hr />` +
        `<h2>Transcrição Integral das Falas</h2>` +
        `<p>` +
        transcriptLines.map(l => formatInlineHtml(l)).join('<br />') +
        `</p>`;

    const payload = {
        type: 'page',
        title: title,
        space: { key: spaceKey },
        ancestors: parentId ? [{ id: String(parentId) }] : [],
        body: {
            storage: {
                value: storageHtml,
                representation: 'storage'
            }
        }
    };

    const res = await fetch(`https://${domain}/wiki/rest/api/content`, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + auth,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        const data = await res.json();
        const pageUrl = `https://${domain}/wiki${data._links?.webui || ''}`;
        return { success: true, pageId: data.id, url: pageUrl };
    } else {
        const errText = await res.text().catch(() => '');
        throw new Error(`Falha ao sincronizar com Confluence (HTTP ${res.status}): ${errText}`);
    }
}

async function generateAndSendResumo(i, totalSeconds) {
    if (!i.deferred && !i.replied) {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
    }

    if (totalSeconds <= 0) {
        return i.editReply(
            '❌ Por favor, especifique um tempo válido usando pelo menos uma das opções: `horas`, `minutos` ou `segundos`.\n\n' +
            '💡 **Exemplos de uso:**\n' +
            '• `/resumo segundos:90`\n' +
            '• `/resumo minutos:30`\n' +
            '• `/resumo horas:2`\n' +
            '• `/resumo horas:1 minutos:30`'
        );
    }

    if (!GROQ_API_KEY) return i.editReply('❌ Resumo indisponível: configure GROQ_API_KEY no .env.');

    const tempoDesc = formatTimeWindow(totalSeconds);
    const sinceMs = Date.now() - (totalSeconds * 1000);
    const entries = readLog(i.guildId, sinceMs);

    if (!entries.length) {
        return i.editReply(`Não há falas registradas nos últimos ${tempoDesc}.`);
    }

    const fmt = (e) => `[${new Date(e.t).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}] ${e.a}: ${e.x}`;
    const transcriptLines = entries.map(fmt);
    let transcript = transcriptLines.join('\n');
    let avisoAmostragem = '';

    // Limite seguro de 18.000 caracteres para respeitar o teto gratuito de 8.000 TPM da Groq
    const MAX_CHARS = 18_000;
    let falasProcessadas = entries.length;
    if (transcript.length > MAX_CHARS) {
        const keepLines = [];
        let currLen = 0;
        for (let idx = transcriptLines.length - 1; idx >= 0; idx--) {
            const line = transcriptLines[idx];
            if (currLen + line.length + 1 > MAX_CHARS) break;
            keepLines.unshift(line);
            currLen += line.length + 1;
        }
        transcript = keepLines.join('\n');
        falasProcessadas = keepLines.length;
        avisoAmostragem = ` *(analisadas as ${falasProcessadas} falas mais recentes de ${entries.length} para respeitar a cota gratuita)*`;
    }

    const prompt =
`Você é um assistente técnico sênior e redator de atas de engenharia e desenvolvimento de software.
Abaixo está a transcrição bruta das falas de voz de uma chamada no Discord dos últimos ${tempoDesc}.
Gere uma ATA TÉCNICA estruturada, analítica, profissional e direta ao ponto em português do Brasil.

ESTRUTURA OBRIGATÓRIA DA ATA TÉCNICA:

1. 📌 **Visão Geral e Contexto**:
   - Resumo claro e conciso (2 a 3 linhas) do tema central, projeto ou propósito principal discutido na chamada.

2. 🛠️ **Arquitetura, Tecnologias e Ferramentas**:
   - Tecnologias, plataformas, bibliotecas, ferramentas e processos citados (ex.: APIs, Docker, Git/GitHub, Jira, Notion, banco de dados, deploy, etc.).
   - Ideias técnicas, arquiteturas propostas e argumentos levantados por cada participante.

3. ⚠️ **Problemas, Impedimentos ou Gargalos**:
   - Dificuldades técnicas relatadas, bugs, falhas em ferramentas, limitações de infraestrutura ou pontos de atenção discutidos.

4. ✅ **Decisões Técnicas e Próximos Passos**:
   - Decisões consolidadas e tarefas definidas.
   - Atribuição de responsabilidades (quem ficou encarregado de quê, quando mencionado).

DIRETRIZES DE RIGOR E FIDELIDADE:
- Seja ESTRITAMENTE TÉCNICO, objetivo e factual. NÃO deduza sentimentos, não romanceie e não tente adivinhar piadas.
- Baseie-se APENAS no conteúdo real presente na transcrição fornecida.
- Ignore ruídos de fundo, trechos ininteligíveis, palavras desconexas de jogos ou interjeições sem conteúdo técnico.
- NUNCA use tabelas Markdown com barras verticais ("|"). O Discord NÃO renderiza tabelas e elas ficam desformatadas. Use exclusivamente tópicos verticais (bullet points com "•"), subtítulos e negrito.

TRANSCRIÇÃO:
${transcript}`;

    let result;
    try { result = await summarizeText(prompt); } catch (e) { return i.editReply(`❌ Erro ao gerar resumo: ${e.message}`); }
    const rawSummary = (result?.text || '').trim();
    if (!rawSummary) return i.editReply('❌ A IA não retornou resumo.');
    const summary = formatDiscordMarkdown(rawSummary);

    try {
        const head = `📋 **Resumo Técnico dos últimos ${tempoDesc}** — ${falasProcessadas} fala(s)${avisoAmostragem} *(gerado por ${result.model})*\n\n`;
        for (const part of splitMessage(head + summary)) {
            await i.user.send(part);
        }

        // Gera e anexa arquivo Markdown (.md) estruturado para download (SCRUM-48)
        const timestampIso = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const mdFileName = `ata-tecnica-${timestampIso}.md`;
        const mdDoc = Buffer.from(
            `# Ata Técnica TranscriBR\n\n` +
            `- **Janela de Tempo:** ${tempoDesc}\n` +
            `- **Data:** ${new Date().toLocaleString('pt-BR')}\n` +
            `- **Falas Analisadas:** ${falasProcessadas} de ${entries.length}\n` +
            `- **Motor LLM:** ${result.model}\n\n` +
            `---\n\n` +
            `## Ata Estruturada\n\n` +
            `${rawSummary}\n\n` +
            `---\n\n` +
            `## Transcrição Integral das Falas\n\n` +
            `${transcriptLines.join('\n')}\n`,
            'utf8'
        );
        const attachment = new AttachmentBuilder(mdDoc, { name: mdFileName });
        await i.user.send({ content: '📎 **Arquivo Markdown (.md) da ata técnica anexado para download:**', files: [attachment] });

        // Exportação de áudio WAV consolidado pós-chamada (SCRUM-53 / I-9)
        let audioAviso = '';
        try {
            const audioData = exportSessionAudioWav(i.guildId, { maxSeconds: totalSeconds });
            if (audioData && audioData.wavBuffer) {
                const wavFileName = `audio-consolidado-${timestampIso}.wav`;
                const audioAttachment = new AttachmentBuilder(audioData.wavBuffer, { name: wavFileName });
                await i.user.send({
                    content: `🎙️ **Áudio WAV consolidado anexado para auditoria (${audioData.durationSeconds}s / ${audioData.utteranceCount} trecho(s)):**`,
                    files: [audioAttachment]
                });
                audioAviso = `\n🎙️ **Áudio consolidado enviado no privado (${audioData.durationSeconds}s).**`;
            }
        } catch (audioErr) {
            console.warn('Falha ao exportar áudio consolidado no resumo:', audioErr.message);
        }

        // Sincronização automática com o Confluence (SCRUM-45 / I-2)
        let confluenceAviso = '';
        try {
            const meetingTitle = `Ata Técnica - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, 'h')} (${formatTimeWindow(totalSeconds)})`;
            const confResult = await syncAtaToConfluence({
                title: meetingTitle,
                summaryMarkdown: rawSummary,
                transcriptLines,
                timeWindow: tempoDesc,
                model: result.model
            });
            if (confResult.success) {
                confluenceAviso = `\n🌐 **Sincronizado no Confluence:** [Abrir Página](${confResult.url})`;
            }
        } catch (confErr) {
            console.warn('Confluence auto-sync ignorado/falhou:', confErr.message);
        }

        await i.editReply(`📬 Resumo técnico e anexos (.md e áudio) enviados no seu privado.${audioAviso}${confluenceAviso}`);
    } catch {
        await i.editReply('❌ Não consegui te enviar mensagem privada. Habilite DMs de membros do servidor (Configurações de privacidade) e tente de novo.');
    }
}

async function handleResumo(i) {
    const hours = i.options.getNumber('horas') || 0;
    const minutes = i.options.getNumber('minutos') || 0;
    const seconds = i.options.getNumber('segundos') || 0;
    const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
    return await generateAndSendResumo(i, totalSeconds);
}

async function handleAudio(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const minutos = i.options.getNumber('minutos');
    const totalSeconds = minutos ? minutos * 60 : 0;
    const audioData = exportSessionAudioWav(i.guildId, { maxSeconds: totalSeconds });
    if (!audioData || !audioData.wavBuffer) {
        return await i.editReply('⚠️ Nenhum áudio gravado na sessão recente para este servidor.');
    }
    const timestampIso = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const wavFileName = `audio-consolidado-${timestampIso}.wav`;
    const audioAttachment = new AttachmentBuilder(audioData.wavBuffer, { name: wavFileName });
    const durMsg = `${audioData.durationSeconds}s de fala (${audioData.utteranceCount} trecho(s))`;
    const speakersMsg = audioData.speakers.length > 0 ? ` • Participantes: ${audioData.speakers.join(', ')}` : '';
    await i.editReply({
        content: `🎙️ **Áudio WAV consolidado exportado:** ${durMsg}${speakersMsg}.\n*(Download direto no anexo abaixo)*`,
        files: [audioAttachment]
    });
}

client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        try {
            if (i.customId === 'btn_resumo_30m') {
                await generateAndSendResumo(i, 1800);
            } else if (i.customId === 'btn_resumo_1h') {
                await generateAndSendResumo(i, 3600);
            }
        } catch (e) {
            console.error('Erro no botão interativo:', e.message);
            try {
                (i.deferred || i.replied)
                    ? await i.editReply(`❌ ${e.message}`)
                    : await i.reply({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral });
            } catch { /* ignora */ }
        }
        return;
    }
    if (!i.isChatInputCommand()) return;
    try {
        const guild = i.guild;
        if (i.commandName === 'transcrever') {
            state.paused = false;
            const vc = i.member?.voice?.channel;
            if (!vc) {
                saveState();
                await i.reply({ content: '▶️ Transcrição **iniciada**. Entre numa call e eu entro junto.', flags: MessageFlags.Ephemeral });
                reconcile(guild);
                return;
            }
            state.targetChannels = state.targetChannels || {};
            state.targetChannels[guild.id] = vc.id;
            saveState();
            await i.deferReply();
            await joinChannel(vc);
            await i.editReply(`▶️ Transcrevendo **${vc.name}**.`);
        } else if (i.commandName === 'parar') {
            state.paused = true;
            if (state.targetChannels?.[guild.id]) {
                delete state.targetChannels[guild.id];
            }
            saveState();
            leave(guild);
            await i.reply('⏸️ Bot **pausado**. Use `/transcrever` para voltar.');
        } else if (i.commandName === 'resumo') {
            await handleResumo(i);
        } else if (i.commandName === 'limpar') {
            await handleLimpar(i);
        } else if (i.commandName === 'status') {
            const s = sessions.get(guild.id);
            const targetId = state.targetChannels?.[guild.id];
            const targetCh = targetId ? guild.channels.cache.get(targetId) : null;
            const targetMsg = targetCh ? ` (fixado em **${targetCh.name}**)` : '';
            const baseMsg = state.paused ? '⏸️ **Pausado** — use `/transcrever`.'
                : s ? `🟢 Transcrevendo **${s.voiceChannel.name}** (${humansIn(s.voiceChannel).length} pessoa(s))${targetMsg}.`
                    : '🟢 Ativo — aguardando alguém entrar numa call.';
            const t = getTelemetryMetrics();
            const teleMsg = `\n📊 **Telemetria de Transcrição**:\n` +
                `• Falas postadas: **${t.transcriptionsPosted}** (${t.audioDurationTotalSec}s processados)\n` +
                `• Latência média STT: **${t.avgLatencyMs}ms**\n` +
                `• Ruídos/alucinações filtrados: **${t.hallucinationsDiscarded}** (duplicações ignoradas: ${t.duplicatesSkipped})\n` +
                `• Motores acionados: Groq (${t.engineUsage.groq}), Local (${t.engineUsage.local})`;
            await i.reply({ content: `${baseMsg}\n${teleMsg}`, flags: MessageFlags.Ephemeral });
        } else if (i.commandName === 'audio') {
            await handleAudio(i);
        }
    } catch (e) {
        console.error('Erro no comando:', e.message);
        try { (i.deferred || i.replied) ? await i.editReply(`❌ ${e.message}`) : await i.reply({ content: `❌ ${e.message}`, flags: MessageFlags.Ephemeral }); } catch { /* ignora */ }
    }
});

// Garante que existe o canal "transcribr-" (cria se puder) e avisa se faltar permissão
async function checkTextChannel(guild) {
    const all = await guild.channels.fetch();
    let ch = all.find(x => x && x.type === ChannelType.GuildText && isTranscribrChannel(x.name));
    if (!ch && !webhook) {
        try {
            ch = await guild.channels.create({ name: 'transcribr-', type: ChannelType.GuildText });
            console.log(`📌 Criei o canal #${ch.name} em "${guild.name}".`);
        } catch {
            console.warn(`⚠️ Em "${guild.name}" não existe um canal de texto chamado "transcribr-" e eu não tenho permissão para criá-lo. Crie o canal manualmente.`);
            return;
        }
    }
    if (ch && !webhook) {
        const perms = ch.permissionsFor(client.user);
        if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
            console.warn(`⚠️ Sem permissão de ver/escrever em #${ch.name}. Dê "Ver canal" e "Enviar mensagens" ao bot nesse canal.`);
        } else {
            console.log(`📌 Canal de transcrição: #${ch.name}`);
        }
    }
}

client.once('clientReady', async (c) => {
    console.log('='.repeat(55));
    console.log(`🤖 TranscriBR servidor online como ${c.user.tag}`);
    console.log(`Motores (ordem): ${STT_ORDER.join(' > ')} | Servidores: ${client.guilds.cache.map(g => g.name).join(', ')}`);
    console.log('='.repeat(55));
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    // Se sobrou uma "Interactions Endpoint URL" no portal, o Discord não entrega os comandos ao bot: remove sozinho
    try {
        const app = await rest.get(Routes.currentApplication());
        if (app.interactions_endpoint_url) {
            await rest.patch(Routes.currentApplication(), { body: { interactions_endpoint_url: null } });
            console.log('🔧 Removi a "Interactions Endpoint URL" do portal (necessário para os comandos funcionarem).');
        }
    } catch (e) { console.warn('Não consegui verificar a Interactions Endpoint URL:', e.message); }

    if (!client.guilds.cache.size) {
        console.warn('⚠️ O bot não está em nenhum servidor. Convide com:');
        console.warn(`https://discord.com/oauth2/authorize?client_id=${c.user.id}&scope=bot%20applications.commands&permissions=1125376`);
    }

    for (const guild of client.guilds.cache.values()) {
        try {
            await rest.put(Routes.applicationGuildCommands(c.user.id, guild.id), { body: COMMANDS });
        } catch (e) { console.error('Erro ao sincronizar comandos:', e.message); }
        try { await checkTextChannel(guild); } catch (e) { console.warn('Verificação do canal falhou:', e.message); }
        reconcile(guild);
    }
    // Reavalia periodicamente (garante a volta mesmo se algum evento falhar)
    setInterval(() => client.guilds.cache.forEach(g => reconcile(g)), 60_000);
});

const HEALTH_PORT = Number(process.env.PORT || process.env.HEALTH_PORT || 8080);
function createHealthServer() {
    return http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            const data = {
                status: 'ok',
                bot: client.user ? client.user.tag : 'offline',
                uptimeSeconds: Math.round(process.uptime()),
                engines: availableEngines(),
                paused: state.paused,
                memory: {
                    rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
                    heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
                },
                activeSessions: sessions.size,
                telemetry: getTelemetryMetrics(),
                timestamp: new Date().toISOString()
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });
}

let healthServer = null;
process.on('unhandledRejection', (e) => console.error('Rejeição não tratada:', e?.message || e));
process.on('SIGINT', () => { try { healthServer?.close(); sttProc?.kill(); } catch { /* ignora */ } process.exit(0); });
process.on('SIGTERM', () => { try { healthServer?.close(); sttProc?.kill(); } catch { /* ignora */ } process.exit(0); });

if (require.main === module) {
    pruneLog();
    startLocalStt();
    watchLocalStt();
    try {
        healthServer = createHealthServer();
        healthServer.listen(HEALTH_PORT, () => {
            console.log(`🌐 Servidor HTTP de healthcheck ativo na porta ${HEALTH_PORT} (/health)`);
        });
        healthServer.on('error', (err) => {
            console.warn(`Servidor de healthcheck não pôde subir na porta ${HEALTH_PORT}: ${err.message}`);
        });
    } catch (e) { console.warn('Erro ao iniciar healthcheck:', e.message); }

    client.login(DISCORD_TOKEN).catch((e) => {
        console.error(`❌ Não consegui conectar ao Discord: ${e.message}`);
        if (/token|disallowed|401/i.test(e.message)) {
            console.error('O token do bot está inválido. Gere um novo em discord.com/developers > Bot > Reset Token e atualize o arquivo .env.');
            process.exit(2);
        }
        process.exit(1);
    });
}

module.exports = {
    preprocessAudio,
    trimTrailingSilence,
    pcmToWav,
    formatDiscordMarkdown,
    formatTimeWindow,
    splitMessage,
    applyCorrections,
    isSuspicious,
    parseWhisper,
    createHealthServer,
    getTelemetryMetrics,
    recordTranscriptionMetric,
    markdownToConfluenceStorage,
    syncAtaToConfluence,
    selectTargetVoiceChannel,
    recordAudioUtterance,
    exportSessionAudioWav,
    clearAudioSession,
    getAudioSessionStats,
    handleAudio,
    speechStorage,
    logLine,
    readLog,
    pruneLog
};

