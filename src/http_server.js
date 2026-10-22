// PURPOSE: Servidor HTTP modularizado com autenticação básica para dashboard e APIs (SCRUM-80)
const http = require('http');
const crypto = require('crypto');

function createHealthServer({
    client,
    state,
    sessions,
    guildDiarizers,
    speechStorage,
    renderDashboardHtml,
    generatePrometheusMetrics,
    recordHttpRequest,
    getTelemetryMetrics,
    availableEngines,
    port
}) {
    const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
    const DASHBOARD_PASS = process.env.DASHBOARD_PASSWORD || '';

    function checkBasicAuth(req) {
        if (!DASHBOARD_PASS) return true; // sem senha configurada = aberto (compatibilidade)
        const authHeader = req.headers['authorization'] || '';
        if (!authHeader.startsWith('Basic ')) return false;
        try {
            const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
            const [user, pass] = decoded.split(':');
            const userOk = crypto.timingSafeEqual(Buffer.from(user), Buffer.from(DASHBOARD_USER));
            const passOk = crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(DASHBOARD_PASS));
            return userOk && passOk;
        } catch {
            return false;
        }
    }

    function sendUnauthorized(res) {
        res.writeHead(401, {
            'Content-Type': 'text/plain',
            'WWW-Authenticate': 'Basic realm="TranscriBR Dashboard"'
        });
        res.end('Unauthorized');
    }

    return http.createServer((req, res) => {
        const urlPath = req.url ? req.url.split('?')[0] : '/';
        const accept = req.headers['accept'] || '';

        // /health e /metrics ficam abertos para probes de liveness e Prometheus scraper
        const isPublicEndpoint = urlPath === '/health' || urlPath === '/metrics';

        if (!isPublicEndpoint && !checkBasicAuth(req)) {
            recordHttpRequest(urlPath + ' [401]');
            sendUnauthorized(res);
            return;
        }

        // 1. Dashboard Corporativo Web (HTML)
        if (urlPath === '/dashboard' || (urlPath === '/' && accept.includes('text/html'))) {
            recordHttpRequest('/dashboard');
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
                activeSessions: sessions ? sessions.size : 0,
                telemetry: getTelemetryMetrics(),
                biometricProfiles: Array.from(guildDiarizers.values()).reduce((acc, d) => acc + d.profiles.size, 0),
                timestamp: new Date().toISOString()
            };
            const html = renderDashboardHtml(data);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        // 2. Endpoint de Status JSON
        if (urlPath === '/api/status' || urlPath === '/health' || urlPath === '/') {
            recordHttpRequest(urlPath === '/' ? '/health' : urlPath);
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
                activeSessions: sessions ? sessions.size : 0,
                telemetry: getTelemetryMetrics(),
                biometricProfiles: Array.from(guildDiarizers.values()).reduce((acc, d) => acc + d.profiles.size, 0),
                timestamp: new Date().toISOString()
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // 3. API de Histórico de Falas Recentes
        if (urlPath === '/api/recent-speeches') {
            recordHttpRequest('/api/recent-speeches');
            const recent = speechStorage?.getRecentEntries ? speechStorage.getRecentEntries(50) : [];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(recent));
            return;
        }

        // 4. API de Telemetria
        if (urlPath === '/api/telemetry') {
            recordHttpRequest('/api/telemetry');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(getTelemetryMetrics()));
            return;
        }

        // 5. Prometheus Metrics
        if (urlPath === '/metrics') {
            recordHttpRequest('/metrics');
            const speechStats = speechStorage?.getStats ? speechStorage.getStats() : { totalEntries: 0 };
            const metricsText = generatePrometheusMetrics({
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                activeSessions: sessions ? sessions.size : 0,
                paused: state ? (state.paused ? 1 : 0) : 0,
                telemetry: getTelemetryMetrics(),
                speechCount: speechStats.totalEntries || 0,
                engines: availableEngines()
            });
            res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
            res.end(metricsText);
            return;
        }

        recordHttpRequest(req.url);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });
}

module.exports = { createHealthServer };