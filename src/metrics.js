// PURPOSE: Gerador de métricas no padrão canônico Prometheus Exposition Format (text/plain; version=0.0.4)
// e rastreador de requisições HTTP internas para observabilidade contínua.

const internalHttpMetrics = {
    '/health': 0,
    '/metrics': 0,
    '/': 0,
    'other': 0
};

/**
 * Registra o consumo de um endpoint HTTP interno
 * @param {string} endpoint 
 */
function recordHttpRequest(endpoint) {
    if (endpoint === '/health' || endpoint === '/') {
        internalHttpMetrics['/health']++;
    } else if (endpoint === '/metrics') {
        internalHttpMetrics['/metrics']++;
    } else {
        internalHttpMetrics['other']++;
    }
}

/**
 * Retorna cópia das métricas HTTP registradas
 */
function getHttpMetrics() {
    return { ...internalHttpMetrics };
}

/**
 * Reseta contadores HTTP (útil para testes isolados)
 */
function resetHttpMetrics() {
    internalHttpMetrics['/health'] = 0;
    internalHttpMetrics['/metrics'] = 0;
    internalHttpMetrics['/'] = 0;
    internalHttpMetrics['other'] = 0;
}

/**
 * Gera o payload de métricas no formato canônico do Prometheus (0.0.4)
 * @param {Object} [custom] Valores customizados para injeção ou testes
 * @returns {string} Texto em conformidade com Prometheus exposition format
 */
function generatePrometheusMetrics(custom = {}) {
    const uptime = custom.uptime !== undefined ? custom.uptime : process.uptime();
    const mem = custom.memory || process.memoryUsage();
    const cpu = custom.cpu || process.cpuUsage();
    const activeSessions = custom.activeSessions !== undefined ? custom.activeSessions : 0;
    const paused = custom.paused !== undefined ? (custom.paused ? 1 : 0) : 0;
    const telem = custom.telemetry || {
        audioChunksReceived: 0,
        audioDurationTotalSec: 0,
        transcriptionsPosted: 0,
        hallucinationsDiscarded: 0,
        duplicatesSkipped: 0,
        avgLatencyMs: 0,
        engineUsage: {}
    };
    const speechCount = custom.speechCount !== undefined ? custom.speechCount : 0;
    const engines = custom.engines || ['groq'];
    const httpReqs = custom.httpRequests || internalHttpMetrics;

    const lines = [];

    // --- Process & Runtime Metrics ---
    lines.push('# HELP process_uptime_seconds Tempo total de atividade ininterrupta do processo em segundos.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${Math.round(uptime)}`);

    lines.push('# HELP process_cpu_user_seconds_total Tempo de CPU no modo usuario consumido em segundos.');
    lines.push('# TYPE process_cpu_user_seconds_total counter');
    lines.push(`process_cpu_user_seconds_total ${(cpu.user / 1e6).toFixed(4)}`);

    lines.push('# HELP process_cpu_system_seconds_total Tempo de CPU no modo kernel consumido em segundos.');
    lines.push('# TYPE process_cpu_system_seconds_total counter');
    lines.push(`process_cpu_system_seconds_total ${(cpu.system / 1e6).toFixed(4)}`);

    lines.push('# HELP nodejs_memory_rss_bytes Memoria Resident Set Size (RSS) total alocada pelo processo.');
    lines.push('# TYPE nodejs_memory_rss_bytes gauge');
    lines.push(`nodejs_memory_rss_bytes ${mem.rss}`);

    lines.push('# HELP nodejs_memory_heap_used_bytes Memoria Heap efetivamente utilizada pelo V8 engine.');
    lines.push('# TYPE nodejs_memory_heap_used_bytes gauge');
    lines.push(`nodejs_memory_heap_used_bytes ${mem.heapUsed}`);

    lines.push('# HELP nodejs_memory_heap_total_bytes Memoria Heap total alocada pelo V8 engine.');
    lines.push('# TYPE nodejs_memory_heap_total_bytes gauge');
    lines.push(`nodejs_memory_heap_total_bytes ${mem.heapTotal}`);

    // --- TranscriBR Voice & Core Metrics ---
    lines.push('# HELP transcribr_active_voice_sessions Quantidade de chamadas de voz ativas simultaneas no Discord.');
    lines.push('# TYPE transcribr_active_voice_sessions gauge');
    lines.push(`transcribr_active_voice_sessions ${activeSessions}`);

    lines.push('# HELP transcribr_bot_paused Estado de pausa global do bot (1 se pausado, 0 se ativo).');
    lines.push('# TYPE transcribr_bot_paused gauge');
    lines.push(`transcribr_bot_paused ${paused}`);

    // --- Transcriptions & Telemetry Metrics ---
    lines.push('# HELP transcribr_utterances_total Total acumulado de falas de audio processadas categorizadas por status.');
    lines.push('# TYPE transcribr_utterances_total counter');
    lines.push(`transcribr_utterances_total{status="posted"} ${telem.transcriptionsPosted || 0}`);
    lines.push(`transcribr_utterances_total{status="discarded"} ${telem.hallucinationsDiscarded || 0}`);
    lines.push(`transcribr_utterances_total{status="duplicate"} ${telem.duplicatesSkipped || 0}`);

    lines.push('# HELP transcribr_audio_chunks_received_total Quantidade total de pedacos de audio capturados do gateway Discord.');
    lines.push('# TYPE transcribr_audio_chunks_received_total counter');
    lines.push(`transcribr_audio_chunks_received_total ${telem.audioChunksReceived || 0}`);

    lines.push('# HELP transcribr_audio_duration_seconds_total Duracao total acumulada de audio transcrito em segundos.');
    lines.push('# TYPE transcribr_audio_duration_seconds_total counter');
    lines.push(`transcribr_audio_duration_seconds_total ${Number(telem.audioDurationTotalSec || 0).toFixed(1)}`);

    lines.push('# HELP transcribr_avg_latency_ms Latencia media de resposta da API de transcricao STT em milissegundos.');
    lines.push('# TYPE transcribr_avg_latency_ms gauge');
    lines.push(`transcribr_avg_latency_ms ${telem.avgLatencyMs || 0}`);

    // --- Speech Storage (SQLite) Metrics ---
    lines.push('# HELP transcribr_speech_storage_records_total Quantidade total de falas armazenadas no buffer persistente SQLite.');
    lines.push('# TYPE transcribr_speech_storage_records_total gauge');
    lines.push(`transcribr_speech_storage_records_total ${speechCount}`);

    // --- STT Engines Readiness ---
    lines.push('# HELP transcribr_stt_engine_available Status de prontidao dos motores de transcricao STT (1 = online, 0 = offline).');
    lines.push('# TYPE transcribr_stt_engine_available gauge');
    const groqOk = engines.includes('groq') ? 1 : 0;
    const localOk = engines.includes('local') ? 1 : 0;
    lines.push(`transcribr_stt_engine_available{engine="groq"} ${groqOk}`);
    lines.push(`transcribr_stt_engine_available{engine="local"} ${localOk}`);

    // --- HTTP Server Ingress Metrics ---
    lines.push('# HELP transcribr_http_requests_total Total de requisicoes atendidas pelo servidor HTTP interno.');
    lines.push('# TYPE transcribr_http_requests_total counter');
    lines.push(`transcribr_http_requests_total{endpoint="/health"} ${httpReqs['/health'] || 0}`);
    lines.push(`transcribr_http_requests_total{endpoint="/metrics"} ${httpReqs['/metrics'] || 0}`);
    lines.push(`transcribr_http_requests_total{endpoint="other"} ${httpReqs['other'] || 0}`);

    return lines.join('\n') + '\n';
}

/**
 * Utilitário de parsing de formato Prometheus para inspeção programática
 * @param {string} text 
 * @returns {Object.<string, Array<{labels: Object, value: number}>>}
 */
function parsePrometheusText(text) {
    const result = {};
    if (!text || typeof text !== 'string') return result;

    const lines = text.split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const spaceIdx = line.indexOf(' ');
        if (spaceIdx === -1) continue;

        const metricWithLabels = line.slice(0, spaceIdx);
        const value = parseFloat(line.slice(spaceIdx + 1));

        let metricName = metricWithLabels;
        const labels = {};

        const braceOpen = metricWithLabels.indexOf('{');
        if (braceOpen !== -1 && metricWithLabels.endsWith('}')) {
            metricName = metricWithLabels.slice(0, braceOpen);
            const labelStr = metricWithLabels.slice(braceOpen + 1, -1);
            const matches = labelStr.matchAll(/([a-zA-Z0-9_]+)="([^"]*)"/g);
            for (const m of matches) {
                labels[m[1]] = m[2];
            }
        }

        if (!result[metricName]) {
            result[metricName] = [];
        }
        result[metricName].push({ labels, value });
    }

    return result;
}

module.exports = {
    generatePrometheusMetrics,
    recordHttpRequest,
    getHttpMetrics,
    resetHttpMetrics,
    parsePrometheusText
};
