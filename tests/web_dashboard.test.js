const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { createHealthServer, renderDashboardHtml } = require('../bot.js');
const { escapeHtml } = require('../src/web_dashboard.js');

describe('Corporate Web Dashboard Module (SCRUM-56)', () => {
  let server;
  const testPort = 49198;

  before((done) => {
    server = createHealthServer();
    server.listen(testPort, done);
  });

  after((done) => {
    server.close(done);
  });

  describe('renderDashboardHtml & escapeHtml', () => {
    it('deve escapar caracteres perigosos prevenindo vulnerabilidade XSS (CWE-79)', () => {
      const malicious = '<script>alert("xss")</script> & " \'';
      const escaped = escapeHtml(malicious);
      assert.ok(!escaped.includes('<script>'));
      assert.ok(escaped.includes('&lt;script&gt;'));
      assert.ok(escaped.includes('&quot;'));
      assert.ok(escaped.includes('&#39;'));
    });

    it('deve renderizar HTML5 completo com estrutura executiva e KPIs', () => {
      const html = renderDashboardHtml({
        bot: 'TranscriBR#1234',
        uptimeSeconds: 7200,
        activeSessions: 2,
        memory: { heapUsedMb: 64, rssMb: 120 },
        telemetry: { avgLatencyMs: 450, transcriptionsPosted: 88, hallucinationsDiscarded: 3 }
      });

      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('TranscriBR Dashboard'));
      assert.ok(html.includes('TranscriBR#1234'));
      assert.ok(html.includes('2h 0m'));
      assert.ok(html.includes('Sessões Ativas'));
      assert.ok(html.includes('Groq Whisper Large-v3'));
    });
  });

  describe('Endpoints HTTP do Servidor Web', () => {
    it('deve servir o Dashboard HTML em GET /dashboard', async () => {
      const resp = await fetch(`http://127.0.0.1:${testPort}/dashboard`);
      assert.strictEqual(resp.status, 200);
      assert.ok(resp.headers.get('content-type').includes('text/html'));
      const text = await resp.text();
      assert.ok(text.includes('TranscriBR Dashboard'));
      assert.ok(text.includes('id="speechesTableBody"'));
    });

    it('deve servir o Dashboard HTML em GET / quando o cliente solicitar Accept: text/html', async () => {
      const resp = await fetch(`http://127.0.0.1:${testPort}/`, {
        headers: { 'Accept': 'text/html,application/xhtml+xml' }
      });
      assert.strictEqual(resp.status, 200);
      assert.ok(resp.headers.get('content-type').includes('text/html'));
      const text = await resp.text();
      assert.ok(text.includes('TranscriBR Dashboard'));
    });

    it('deve retornar JSON com status do bot e perfis biométricos em GET /api/status', async () => {
      const resp = await fetch(`http://127.0.0.1:${testPort}/api/status`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const data = await resp.json();
      assert.strictEqual(data.status, 'ok');
      assert.ok(typeof data.uptimeSeconds === 'number');
      assert.ok(typeof data.biometricProfiles === 'number');
      assert.ok(data.memory);
    });

    it('deve retornar JSON array em GET /api/recent-speeches', async () => {
      const resp = await fetch(`http://127.0.0.1:${testPort}/api/recent-speeches`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const data = await resp.json();
      assert.ok(Array.isArray(data));
    });

    it('deve retornar métricas em GET /api/telemetry', async () => {
      const resp = await fetch(`http://127.0.0.1:${testPort}/api/telemetry`);
      assert.strictEqual(resp.status, 200);
      assert.strictEqual(resp.headers.get('content-type'), 'application/json');
      const data = await resp.json();
      assert.ok('audioChunksReceived' in data);
      assert.ok('transcriptionsPosted' in data);
    });
  });
});
