// TranscriBR (servidor 24/7) — entra sozinho nas calls de voz e transcreve todo mundo.
//
// Roda num computador que fica sempre ligado. Ninguém precisa instalar nada:
// quando alguém entra num canal de voz, o bot entra junto e posta as falas no canal "transcribr-".
// Quando a call esvazia, ele sai. Motores de STT: Whisper local -> Groq -> Gemini (configurável).
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
lockServer.listen(49152, '127.0.0.1');
lockServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('JÁ EXISTE OUTRA INSTÂNCIA DO BOT RODANDO. Encerrando esta.');
        process.exit(3);
    }
});

const {
    Client, GatewayIntentBits, ChannelType, MessageFlags,
    PermissionFlagsBits, REST, Routes, SlashCommandBuilder, WebhookClient
} = require('discord.js');
const {
    joinVoiceChannel, EndBehaviorType, VoiceConnectionStatus, entersState
} = require('@discordjs/voice');
const prism = require('prism-media');
const { GoogleGenAI } = require('@google/genai');

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WEBHOOK_URL = process.env.TRANSCRIBR_WEBHOOK_URL || '';
// Ordem dos motores: local, groq, gemini (os sem chave são ignorados)
// Padrão: Groq (Whisper large-v3, o mais preciso e grátis) > Whisper local (ilimitado) > Gemini (último recurso)
const STT_ORDER = (process.env.STT_ORDER || (GROQ_API_KEY ? 'groq,gemini' : 'gemini')).split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
const LOCAL_MAX_QUEUE = Number(process.env.LOCAL_MAX_QUEUE || 2);
const LEAVE_GRACE_MS = 15_000;

// Código de saída 2 = erro de configuração (o iniciar_servidor.bat não fica reiniciando em loop)
if (!DISCORD_TOKEN || /cole_o_token/i.test(DISCORD_TOKEN)) {
    console.error('ERRO: DISCORD_BOT_TOKEN não configurado no arquivo .env! Rode instalar_servidor.bat ou edite o .env.');
    process.exit(2);
}
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const webhook = (() => {
    const m = WEBHOOK_URL.match(/webhooks\/(\d+)\/([\w-]+)/);
    return m ? new WebhookClient({ id: m[1], token: m[2] }) : null;
})();

const STATE_FILE = path.join(__dirname, 'server_state.json');
let state = { paused: false };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch { /* primeira execução */ }
const LOG_FILE = path.join(__dirname, 'transcript_log.jsonl');
function logLine(guildId, author, text) {
    try { fs.appendFileSync(LOG_FILE, JSON.stringify({ t: Date.now(), g: guildId, a: author, x: text }) + '\n'); } catch { /* ignora */ }
}
function readLog(guildId, sinceMs) {
    try {
        return fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } })
            .filter(e => e && e.g === guildId && e.t >= sinceMs);
    } catch { return []; }
}
function pruneLog() {
    try {
        const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
        const keep = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(l => { try { return JSON.parse(l).t >= cutoff; } catch { return false; } });
        fs.writeFileSync(LOG_FILE, keep.length ? keep.join('\n') + '\n' : '');
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
const MIN_SPEECH_SECONDS = 1.2;
const TRIM_FRAME_BYTES = 640;
const TRIM_PADDING_FRAMES = 5;

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
const stylePrompt = (names) =>
    `Conversa informal em português do Brasil entre amigos, com gírias e palavrões. Termos e nomes: ${hintTerms(names).join(', ')}.`.slice(0, 700);

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

async function geminiGenerate(contents, temperature = 0) {
    try {
        return (await ai.models.generateContent({ model: 'gemini-3.5-flash', config: { temperature }, contents })).text;
    } catch {
        return (await ai.models.generateContent({ model: 'gemini-3.5-flash-lite', config: { temperature }, contents })).text;
    }
}

async function sttGemini(wav, names, userName) {
    const prompt =
        `Você é um transcritor de conversa para chat do Discord em tempo real.\n` +
        `Quem está falando agora: "${userName}". Pessoas na chamada: ${names.join(', ')}.\n` +
        (vocabulary().length ? `Vocabulário do grupo (grafia correta): ${vocabulary().join(', ')}.\n` : '') +
        `Regras: 1) Transcreva fielmente em português do Brasil, com pontuação natural. ` +
        `2) Use a grafia correta dos nomes dos participantes. 3) Mantenha gírias e palavrões EXATAMENTE como ditos, sem censurar. ` +
        `4) NUNCA invente <noise>, timestamps ou descrições de som. 5) NÃO adivinhe: se algo estiver abafado, omita. ` +
        `6) Retorne APENAS o texto falado. Se não houver voz humana compreensível, responda exatamente: [SILÊNCIO]`;
    const part = { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } };
    return { text: ((await geminiGenerate([part, prompt])) || '').trim(), conf: null, nsp: 0, engine: 'gemini' };
}

// ---------- Segunda opinião ----------
const SECOND_OPINION = (process.env.SECOND_OPINION || '1') !== '0';
const CONF_OK = Number(process.env.CONF_THRESHOLD || -0.45);   // acima disso o resultado é aceito direto

const normWords = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
// Similaridade entre dois textos (1 = idênticos), por distância de edição de palavras
function similarity(a, b) {
    const x = normWords(a), y = normWords(b);
    if (!x.length && !y.length) return 1;
    const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
    for (let j = 1; j <= y.length; j++) d[0][j] = j;
    for (let i = 1; i <= x.length; i++) {
        for (let j = 1; j <= y.length; j++) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
        }
    }
    return 1 - d[x.length][y.length] / Math.max(x.length, y.length);
}

const isUncertain = (r) => !!r.text && r.conf !== null && (r.conf < CONF_OK || r.nsp > 0.3);

// O Gemini ouve o áudio e decide entre as duas versões (podendo corrigir erros evidentes)
async function judge(wav, a, b, names, userName) {
    const part = { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } };
    const prompt =
        `Ouça o áudio (fala em português do Brasil de "${userName}", numa conversa entre amigos: ${names.join(', ')}). ` +
        (vocabulary().length ? `Vocabulário do grupo: ${vocabulary().join(', ')}. ` : '') +
        `Dois sistemas transcreveram de formas diferentes:\nA: "${a}"\nB: "${b}"\n` +
        `Escreva a transcrição FINAL correta do que foi realmente dito. Pode escolher A ou B, ou combinar/corrigir, usando apenas o que se ouve. ` +
        `Mantenha gírias e palavrões exatamente como falados, sem censura. Não invente nada. ` +
        `Responda APENAS com o texto final. Se não houver fala humana compreensível, responda exatamente: [SILÊNCIO]`;
    return ((await geminiGenerate([part, prompt])) || '').trim().replace(/^["“]|["”]$/g, '');
}

const ENGINE_LABEL = { local: 'Whisper local', groq: 'Groq Whisper', gemini: 'Gemini' };

function availableEngines() {
    const list = [];
    for (const e of STT_ORDER) {
        if (e === 'local' && !sttDisabled) list.push('local');
        else if (e === 'groq' && GROQ_API_KEY) list.push('groq');
        else if (e === 'gemini' && ai) list.push('gemini');
    }
    return list;
}

// Executa um motor, respeitando fila do Whisper local e disjuntor da Groq. Lança erro se indisponível.
async function runEngine(id, wav, names, seconds, userName, isLast) {
    if (id === 'local') {
        if (!isLast && (!localReady || localPending >= LOCAL_MAX_QUEUE)) throw new Error('indisponível agora');
        localPending++;
        try { return await sttLocal(wav, names, seconds); } finally { localPending--; }
    }
    if (id === 'groq') {
        if (Date.now() < groqBlockedUntil && !isLast) throw new Error('em pausa (limite atingido)');
        return await sttGroq(wav, names, seconds);
    }
    return await sttGemini(wav, names, userName);
}

async function transcribe(wav, names, seconds, userName) {
    const engines = availableEngines();
    if (!engines.length) {
        console.warn(`⚠️ Nenhum motor disponível! STT_ORDER: [${STT_ORDER.join(', ')}], Groq: ${!!GROQ_API_KEY}, Gemini: ${!!ai}`);
        return '';
    }
    // 1) Primeiro motor que responder
    let primary = null;
    for (let i = 0; i < engines.length; i++) {
        const isLast = i === engines.length - 1;
        try { primary = await runEngine(engines[i], wav, names, seconds, userName, isLast); break; }
        catch (e) { console.warn(`${ENGINE_LABEL[engines[i]]} falhou${isLast ? '' : ', tentando o próximo'}: ${e.message}`); }
    }
    if (!primary) return '';
    if (!SECOND_OPINION || primary.engine === 'gemini' || !isUncertain(primary)) return primary.text;

    // 2) Resultado incerto: pede a opinião de outro motor (Whisper diferente primeiro, depois Gemini)
    const others = engines.filter(id => id !== primary.engine).sort((x, y) => (x === 'gemini') - (y === 'gemini'));
    let second = null;
    for (const id of others) {
        try { second = await runEngine(id, wav, names, seconds, userName, false); break; } catch { /* tenta o próximo */ }
    }
    if (!second || !second.text) return primary.text;

    const sim = similarity(primary.text, second.text);
    if (sim >= 0.8) return (second.conf !== null && primary.conf !== null && second.conf > primary.conf) ? second.text : primary.text;

    // 3) Discordam: o Gemini ouve o áudio e arbitra (se não houver Gemini, vence o de maior confiança)
    const better = (second.conf !== null && (primary.conf === null || second.conf > primary.conf)) ? second : primary;
    if (!ai) return better.text;
    try {
        const verdict = await judge(wav, primary.text, second.text, names, userName);
        const maxLen = Math.max(primary.text.length, second.text.length) * 1.5 + 20;
        if (!verdict || verdict.length > maxLen) return better.text;
        console.log(`🔍 Segunda opinião (sim ${sim.toFixed(2)}): A[${primary.engine}]="${primary.text}" | B[${second.engine}]="${second.text}" → "${verdict}"`);
        return verdict;
    } catch (e) {
        console.warn('Juiz Gemini falhou:', e.message);
        return better.text;
    }
}

// ---------- Postagem ----------
const textChannels = new Map();
async function postText(guild, content) {
    const opts = { content, flags: MessageFlags.SuppressNotifications };
    if (webhook) {
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
                const wav = pcmToWav(preprocessAudio(pcm));
                const raw = ((await transcribe(wav, names, seconds, userName)) || '').trim();
                const cleaned = raw.toLowerCase().replace(/^[ .!?,;"]+|[ .!?,;"]+$/g, '');
                if (!raw || cleaned.length < 2) return;
                if (IGNORED_WORDS.has(cleaned) || TAG_REGEX.test(raw)) return;
                const text = applyCorrections(raw.replace(/<[^>]+>/g, '').trim());
                if (!text) return;
                logLine(guild.id, userName, text);
                await postText(guild, `🎙️ **${userName}**: ${text}`);
                console.log(`📤 [${userName}] "${text}"`);
            } catch (err) {
                console.error(`Erro ao transcrever ${userName}:`, err.message || err);
            }
        });
    });
}

async function joinChannel(voiceChannel) {
    const guild = voiceChannel.guild;
    const old = sessions.get(guild.id);
    if (old) { try { old.connection.destroy(); } catch { /* ignora */ } sessions.delete(guild.id); }

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id, guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator, selfDeaf: false, selfMute: true
    });
    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (e) {
        try { connection.destroy(); } catch { /* ignora */ }
        throw e;
    }
    const session = { connection, voiceChannel, listening: new Set() };
    sessions.set(guild.id, session);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
            ]);
        } catch {
            try { connection.destroy(); } catch { /* ignora */ }
        }
    });
    connection.on(VoiceConnectionStatus.Destroyed, () => {
        if (sessions.get(guild.id)?.connection === connection) sessions.delete(guild.id);
        setTimeout(() => reconcile(guild), 3_000);
    });

    startListening(guild, session);
    console.log(`✅ Entrei em "${voiceChannel.name}" (${humansIn(voiceChannel).length} pessoa(s))`);
}

function leave(guild) {
    const s = sessions.get(guild.id);
    if (!s) return;
    sessions.delete(guild.id);
    history.delete(guild.id);
    try { s.connection.destroy(); } catch { /* ignora */ }
    console.log(`👋 Saí de "${s.voiceChannel.name}"`);
}

const busy = new Set();
async function reconcile(guild) {
    if (busy.has(guild.id)) return;
    busy.add(guild.id);
    try {
        const session = sessions.get(guild.id);
        if (state.paused) { if (session) leave(guild); return; }

        if (session) {
            if (humansIn(session.voiceChannel).length > 0) {
                clearTimeout(leaveTimers.get(guild.id)); leaveTimers.delete(guild.id);
                return;
            }
            // Call vazia: espera um pouco antes de sair
            if (!leaveTimers.has(guild.id)) {
                leaveTimers.set(guild.id, setTimeout(() => {
                    leaveTimers.delete(guild.id);
                    const s = sessions.get(guild.id);
                    if (s && humansIn(s.voiceChannel).length === 0) { leave(guild); reconcile(guild); }
                }, LEAVE_GRACE_MS));
            }
            return;
        }

        // Sem sessão: entra no canal com mais gente
        const channels = [...guild.channels.cache.values()].filter(c =>
            (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) &&
            c.id !== guild.afkChannelId && humansIn(c).length > 0 &&
            c.permissionsFor(client.user)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]));
        if (!channels.length) return;
        channels.sort((a, b) => humansIn(b).length - humansIn(a).length);
        try { await joinChannel(channels[0]); } catch (e) {
            console.error('Falha ao entrar na call:', e.message);
            setTimeout(() => reconcile(guild), 15_000);
        }
    } finally {
        busy.delete(guild.id);
    }
}

client.on('voiceStateUpdate', (oldS, newS) => {
    const guild = newS.guild || oldS.guild;
    if (newS.member?.user.bot && newS.member.id !== client.user.id) return;
    reconcile(guild);
});

// ---------- Comandos ----------
const COMMANDS = [
    new SlashCommandBuilder().setName('transcrever').setDescription('Inicia a transcrição (entra na sua call, ou na que tiver gente).'),
    new SlashCommandBuilder().setName('parar').setDescription('Pausa o bot: sai da call e para de transcrever.'),
    new SlashCommandBuilder().setName('resumo').setDescription('Resume as últimas horas de conversa e envia no seu privado.')
        .addNumberOption(o => o.setName('horas').setDescription('Quantas horas para trás resumir (ex.: 3)').setMinValue(0.1).setMaxValue(168).setRequired(true)),
    new SlashCommandBuilder().setName('limpar').setDescription('Apaga TODAS as mensagens do canal de transcrição (transcribr-).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder().setName('status').setDescription('Mostra se o bot está transcrevendo.')
].map(c => c.toJSON());

function splitMessage(text, max = 1900) {
    const parts = [];
    let rest = text.trim();
    while (rest.length > max) {
        let cut = rest.lastIndexOf('\n', max);
        if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
        if (cut < max * 0.5) cut = max;
        parts.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    return parts;
}

async function geminiText(prompt) {
    try {
        return (await ai.models.generateContent({ model: 'gemini-3.5-flash', config: { temperature: 0.3 }, contents: prompt })).text;
    } catch {
        return (await ai.models.generateContent({ model: 'gemini-3.5-flash-lite', config: { temperature: 0.3 }, contents: prompt })).text;
    }
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
        console.log(`🧹 /limpar: ${total} mensagens apagadas em #${ch.name}`);
        await i.editReply(`🧹 Pronto! ${total} mensagem(ns) apagada(s) de <#${ch.id}>.`).catch(() => {});
    } finally {
        cleaning = false;
    }
}

async function handleResumo(i) {
    const hours = i.options.getNumber('horas', true);
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (!ai) return i.editReply('❌ Resumo indisponível: GEMINI_API_KEY não configurada no .env.');
    const entries = readLog(i.guildId, Date.now() - hours * 3600 * 1000);
    if (!entries.length) return i.editReply(`Não há falas registradas nas últimas ${hours} hora(s).`);

    const fmt = (e) => `[${new Date(e.t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}] ${e.a}: ${e.x}`;
    let transcript = entries.map(fmt).join('\n');
    const MAX_CHARS = 300_000;
    if (transcript.length > MAX_CHARS) transcript = transcript.slice(-MAX_CHARS);

    const prompt =
        `Abaixo está a transcrição automática (pode conter erros de reconhecimento) de conversas de voz entre amigos num servidor do Discord, ` +
        `das últimas ${hours} hora(s). Faça um resumo em português do Brasil, claro e objetivo:
` +
        `- comece com 2-3 linhas sobre o panorama geral;
- depois liste os principais assuntos e decisões em tópicos curtos, citando quem disse o quê quando for relevante;
` +
        `- mencione combinados, planos e piadas marcantes;
- não invente nada que não esteja na transcrição; ignore trechos incompreensíveis.

TRANSCRIÇÃO:
${transcript}`;

    let summary;
    try { summary = await geminiText(prompt); } catch (e) { return i.editReply(`❌ O Gemini falhou: ${e.message}`); }
    summary = (summary || '').trim();
    if (!summary) return i.editReply('❌ O Gemini não retornou resumo.');

    try {
        const head = `📝 **Resumo das últimas ${hours} hora(s)** — ${entries.length} fala(s)

`;
        for (const part of splitMessage(head + summary)) await i.user.send(part);
        await i.editReply('📬 Resumo enviado no seu privado.');
    } catch {
        await i.editReply('❌ Não consegui te enviar mensagem privada. Habilite DMs de membros do servidor (Configurações de privacidade) e tente de novo.');
    }
}

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    try {
        const guild = i.guild;
        if (i.commandName === 'transcrever') {
            state.paused = false; saveState();
            const vc = i.member?.voice?.channel;
            if (!vc) {
                await i.reply({ content: '▶️ Transcrição **iniciada**. Entre numa call e eu entro junto.', flags: MessageFlags.Ephemeral });
                reconcile(guild);
                return;
            }
            await i.deferReply();
            await joinChannel(vc);
            await i.editReply(`▶️ Transcrevendo **${vc.name}**.`);
        } else if (i.commandName === 'parar') {
            state.paused = true; saveState();
            leave(guild);
            await i.reply('⏸️ Bot **pausado**. Use `/transcrever` para voltar.');
        } else if (i.commandName === 'resumo') {
            await handleResumo(i);
        } else if (i.commandName === 'limpar') {
            await handleLimpar(i);
        } else if (i.commandName === 'status') {
            const s = sessions.get(guild.id);
            const msg = state.paused ? '⏸️ **Pausado** — use `/transcrever`.'
                : s ? `🟢 Transcrevendo **${s.voiceChannel.name}** (${humansIn(s.voiceChannel).length} pessoa(s)).`
                    : '🟢 Ativo — aguardando alguém entrar numa call.';
            await i.reply({ content: msg, flags: MessageFlags.Ephemeral });
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

process.on('unhandledRejection', (e) => console.error('Rejeição não tratada:', e?.message || e));
process.on('SIGINT', () => { try { sttProc?.kill(); } catch { /* ignora */ } process.exit(0); });
process.on('SIGTERM', () => { try { sttProc?.kill(); } catch { /* ignora */ } process.exit(0); });

pruneLog();
startLocalStt();
watchLocalStt();
client.login(DISCORD_TOKEN).catch((e) => {
    console.error(`❌ Não consegui conectar ao Discord: ${e.message}`);
    if (/token|disallowed|401/i.test(e.message)) {
        console.error('O token do bot está inválido. Gere um novo em discord.com/developers > Bot > Reset Token e atualize o arquivo .env.');
        process.exit(2);
    }
    process.exit(1);
});
