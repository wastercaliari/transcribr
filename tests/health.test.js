// Testes unitários para o servidor de healthcheck (/health)
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { createHealthServer } = require('../bot.js');

describe('Healthcheck HTTP Server', () => {
    let server;
    const testPort = 49199;

    before((done) => {
        server = createHealthServer();
        server.listen(testPort, done);
    });

    after((done) => {
        server.close(done);
    });

    it('deve responder status 200 e payload JSON com métricas em GET /health', async () => {
        const resp = await fetch(`http://127.0.0.1:${testPort}/health`);
        assert.strictEqual(resp.status, 200);
        assert.strictEqual(resp.headers.get('content-type'), 'application/json');

        const data = await resp.json();
        assert.strictEqual(data.status, 'ok');
        assert.ok(typeof data.uptimeSeconds === 'number');
        assert.ok(Array.isArray(data.engines));
        assert.ok(typeof data.memory === 'object');
        assert.ok(typeof data.memory.rssMb === 'number');
        assert.ok(data.timestamp);
    });

    it('deve responder status 200 em GET / (root probe)', async () => {
        const resp = await fetch(`http://127.0.0.1:${testPort}/`);
        assert.strictEqual(resp.status, 200);
        const data = await resp.json();
        assert.strictEqual(data.status, 'ok');
    });

    it('deve responder 404 para rotas inexistentes', async () => {
        const resp = await fetch(`http://127.0.0.1:${testPort}/not-found`);
        assert.strictEqual(resp.status, 404);
    });
});
