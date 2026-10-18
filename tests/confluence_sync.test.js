const test = require('node:test');
const assert = require('node:assert/strict');
const { markdownToConfluenceStorage, syncAtaToConfluence } = require('../bot.js');

test('Confluence Synchronization Module', async (t) => {
    await t.test('markdownToConfluenceStorage: deve converter títulos, tópicos e formatações para HTML de armazenamento', () => {
        const markdown = 
            '# Visão Geral\n' +
            'Texto de introdução com **negrito** e *itálico* e `código`.\n\n' +
            '## Arquitetura\n' +
            '• Item 1: API REST\n' +
            '• Item 2: Docker e Railway\n\n' +
            '---\n' +
            '### Conclusão\n' +
            'Finalizado com sucesso.';

        const html = markdownToConfluenceStorage(markdown);

        assert.match(html, /<h1>Visão Geral<\/h1>/);
        assert.match(html, /<strong>negrito<\/strong>/);
        assert.match(html, /<em>itálico<\/em>/);
        assert.match(html, /<code>código<\/code>/);
        assert.match(html, /<h2>Arquitetura<\/h2>/);
        assert.match(html, /<ul>\s*<li>Item 1: API REST<\/li>\s*<li>Item 2: Docker e Railway<\/li>\s*<\/ul>/);
        assert.match(html, /<hr \/>/);
        assert.match(html, /<h3>Conclusão<\/h3>/);
    });

    await t.test('markdownToConfluenceStorage: deve tratar markdown vazio ou nulo retornando string vazia', () => {
        assert.equal(markdownToConfluenceStorage(''), '');
        assert.equal(markdownToConfluenceStorage(null), '');
        assert.equal(markdownToConfluenceStorage(undefined), '');
    });

    await t.test('syncAtaToConfluence: deve retornar skipped quando token estiver vazio ou ausente', async () => {
        const res = await syncAtaToConfluence({
            title: 'Ata de Teste',
            summaryMarkdown: 'Conteúdo teste',
            transcriptLines: ['[10:00] Alice: Olá'],
            timeWindow: '30 minuto(s)',
            model: 'Groq (llama-3.3-70b-versatile)',
            token: ''
        });
        assert.equal(res.success, false);
        assert.equal(res.skipped, true);
        assert.match(res.reason, /não configurado/);
    });

    await t.test('syncAtaToConfluence: deve retornar erro amigável se a API retornar erro HTTP', async () => {
        await assert.rejects(
            async () => {
                await syncAtaToConfluence({
                    title: 'Ata com Token Invalido',
                    summaryMarkdown: 'Conteúdo teste',
                    transcriptLines: ['[10:00] Alice: Olá'],
                    timeWindow: '10 minuto(s)',
                    model: 'Groq',
                    token: 'ATATT_INVALID_TOKEN_12345'
                });
            },
            (err) => {
                assert.match(err.message, /Falha ao sincronizar com Confluence/);
                return true;
            }
        );
    });
});
