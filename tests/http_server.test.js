// PURPOSE: Testes unitários do servidor HTTP modularizado com autenticação básica (SCRUM-80)
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

describe('HTTP Server Module (SCRUM-80)', () => {
  let server;
  let port;
  const originalEnv = { ...process.env };

  before(async () => {
    process.env.DASHBOARD_USER = 'testuser';
    process.env.DASHBOARD_PASSWORD = 'testpass123';
    const { createHealthServer } = require('../src/http_server.js');
    server = createHealthServer({
      client: { user: { tag: 'TestBot#0001' } },
      state: { paused: false },
      sessions: new Map(),
      guildDiarizers: new Map(),
      speechStorage: { getRecentEntries: () => [], getStats: () => ({ totalEntries: 0 }) },
      renderDashboardHtml: (data) => `<html><body>${JSON.stringify(data)}</body></html>`,
      generatePrometheusMetrics: () => '# HELP test\n# TYPE test gauge\ntest 1\n',
      recordHttpRequest: () => {},
      getTelemetryMetrics: () => ({ avgLatencyMs: 0, totalTranscriptions: 0 }),
      availableEngines: () => ['groq'],
      port: 0
    });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    process.env.DASHBOARD_USER = originalEnv.DASHBOARD_USER;
    process.env.DASHBOARD_PASSWORD = originalEnv.DASHBOARD_PASSWORD;
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  function request(path, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  function basicAuth(user, pass) {
    return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  }

  it('deve retornar 401 sem credenciais em endpoint protegido', async () => {
    const res = await request('/dashboard');
    assert.strictEqual(res.status, 401);
    assert.ok(res.headers['www-authenticate']?.includes('Basic'));
  });

  it('deve retornar 401 com credenciais inválidas', async () => {
    const res = await request('/dashboard', { Authorization: basicAuth('wrong', 'wrong') });
    assert.strictEqual(res.status, 401);
  });

  it('deve retornar 200 no /dashboard com credenciais válidas', async () => {
    const res = await request('/dashboard', { Authorization: basicAuth('testuser', 'testpass123') });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('TestBot#0001'));
  });

  it('deve permitir acesso ao /health sem autenticação', async () => {
    const res = await request('/health');
    assert.strictEqual(res.status, 200);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.status, 'ok');
  });

  it('deve permitir acesso ao /metrics sem autenticação', async () => {
    const res = await request('/metrics');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('# HELP test'));
  });

  it('deve retornar 401 em /api/recent-speeches sem auth', async () => {
    const res = await request('/api/recent-speeches');
    assert.strictEqual(res.status, 401);
  });

  it('deve retornar 200 em /api/recent-speeches com auth válida', async () => {
    const res = await request('/api/recent-speeches', { Authorization: basicAuth('testuser', 'testpass123') });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body, '[]');
  });

  it('deve retornar 404 para rota inexistente', async () => {
    const res = await request('/nonexistent', { Authorization: basicAuth('testuser', 'testpass123') });
    assert.strictEqual(res.status, 404);
  });
});