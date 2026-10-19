const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const {
  getJiraAuth,
  textToAdf,
  createJiraIssue,
  extractActionItemsFromAta
} = require('../src/jira_integration');
const { handleJira } = require('../bot');

describe('Bidirectional Jira Integration Module (SCRUM-58)', () => {
  const originalEmail = process.env.ATLASSIAN_EMAIL;
  const originalToken = process.env.ATLASSIAN_API_TOKEN;

  before(() => {
    process.env.ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL || 'test-user@example.com';
    process.env.ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN || 'ATATT-test-token-12345';
  });

  after(() => {
    if (originalEmail) process.env.ATLASSIAN_EMAIL = originalEmail; else delete process.env.ATLASSIAN_EMAIL;
    if (originalToken) process.env.ATLASSIAN_API_TOKEN = originalToken; else delete process.env.ATLASSIAN_API_TOKEN;
  });

  describe('getJiraAuth & textToAdf', () => {
    it('deve obter credenciais do Jira do ambiente ou arquivo local', () => {
      const auth = getJiraAuth();
      assert.ok(auth);
      assert.ok(auth.email);
      assert.ok(auth.token);
      assert.ok(auth.authHeader.startsWith('Basic '));
    });

    it('deve converter texto simples em formato Atlassian Document Format (ADF) válido', () => {
      const adf = textToAdf('Primeiro parágrafo.\n\nSegundo parágrafo.');
      assert.strictEqual(adf.type, 'doc');
      assert.strictEqual(adf.version, 1);
      assert.strictEqual(adf.content.length, 2);
      assert.strictEqual(adf.content[0].content[0].text, 'Primeiro parágrafo.');
      assert.strictEqual(adf.content[1].content[0].text, 'Segundo parágrafo.');
    });

    it('deve tratar texto nulo ou vazio no textToAdf com segurança', () => {
      const emptyAdf = textToAdf(null);
      assert.strictEqual(emptyAdf.type, 'doc');
      assert.strictEqual(emptyAdf.content.length, 1);
    });
  });

  describe('createJiraIssue', () => {
    it('deve rejeitar criação quando título/summary for vazio', async () => {
      const res = await createJiraIssue({ summary: '' });
      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes('obrigatório'));
    });

    it('deve formatar payload e processar resposta de sucesso da API REST v3', async () => {
      const mockFetch = async (url, options) => {
        assert.ok(url.includes('/rest/api/3/issue'));
        assert.strictEqual(options.method, 'POST');
        const body = JSON.parse(options.body);
        assert.strictEqual(body.fields.project.key, 'SCRUM');
        assert.strictEqual(body.fields.summary, 'Deploy do novo serviço de autenticação');
        assert.strictEqual(body.fields.issuetype.name, 'Task');

        return {
          ok: true,
          status: 201,
          json: async () => ({ id: '10200', key: 'SCRUM-999', self: 'https://test/rest/api/3/issue/10200' })
        };
      };

      const result = await createJiraIssue(
        { summary: 'Deploy do novo serviço de autenticação', projectKey: 'SCRUM', description: 'Requisito levantado em reunião.' },
        { fetchFn: mockFetch }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.key, 'SCRUM-999');
      assert.ok(result.url.includes('/browse/SCRUM-999'));
    });

    it('deve retornar erro amigável se a API do Jira retornar falha HTTP', async () => {
      const mockFetchFail = async () => ({
        ok: false,
        status: 400,
        text: async () => 'Field "summary" is invalid.'
      });

      const result = await createJiraIssue(
        { summary: 'Teste com erro' },
        { fetchFn: mockFetchFail }
      );

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('HTTP 400'));
    });
  });

  describe('extractActionItemsFromAta', () => {
    it('deve extrair tarefas da seção de Decisões e Próximos Passos', () => {
      const mockAta = `
1. 📌 Visão Geral: Alinhamento semanal.
2. ⏱️ Linha do Tempo: Conversas de início ao fim.
6. ✅ Decisões, Combinados e Próximos Passos:
• **Alice**: Realizar o upgrade do cluster Kubernetes para versão 1.30.
• Configurar pipeline de observabilidade do Grafana (Responsável: Bob)
• **Carlos**: Revisar Pull Requests abertos no repositório TranscriBR.
`;

      const items = extractActionItemsFromAta(mockAta);
      assert.strictEqual(items.length, 3);

      assert.strictEqual(items[0].assignee, 'Alice');
      assert.ok(items[0].title.includes('Realizar o upgrade do cluster'));

      assert.strictEqual(items[1].assignee, 'Bob');
      assert.ok(items[1].title.includes('Configurar pipeline de observabilidade'));

      assert.strictEqual(items[2].assignee, 'Carlos');
      assert.ok(items[2].title.includes('Revisar Pull Requests'));
    });

    it('deve retornar array vazio se não houver seção de ações ou texto for vazio', () => {
      assert.deepStrictEqual(extractActionItemsFromAta(''), []);
      assert.deepStrictEqual(extractActionItemsFromAta(null), []);
      assert.deepStrictEqual(extractActionItemsFromAta('Apenas conversa informal.'), []);
    });
  });

  describe('handleJira em bot.js', () => {
    it('deve responder à interação com link interativo da tarefa criada', async () => {
      let deferred = false;
      let replyContent = '';

      const mockInteraction = {
        deferReply: async () => { deferred = true; },
        editReply: async (msg) => { replyContent = typeof msg === 'string' ? msg : msg.content; },
        options: {
          getSubcommand: () => 'criar-tarefa',
          getString: (opt) => {
            if (opt === 'titulo') return 'Implementar cache de áudio';
            if (opt === 'descricao') return 'Melhorar a performance de exportação WAV';
            if (opt === 'projeto') return 'SCRUM';
            if (opt === 'tipo') return 'Task';
            return null;
          }
        },
        user: { username: 'dev-lead' }
      };

      // Mock temporário do fetch para não disparar card real em testes
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        status: 201,
        json: async () => ({ id: '10999', key: 'SCRUM-888' })
      });

      try {
        await handleJira(mockInteraction);
        assert.strictEqual(deferred, true);
        assert.ok(replyContent.includes('SCRUM-888'));
        assert.ok(replyContent.includes('Implementar cache de áudio'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
