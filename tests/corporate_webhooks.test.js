const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  formatSlackAtaPayload,
  formatTeamsAtaPayload,
  sendAtaToSlack,
  sendAtaToTeams,
  dispatchAtaToCorporateChannels
} = require('../src/corporate_webhooks');
const bot = require('../bot');

describe('Corporate Webhooks Module for Slack & Teams (SCRUM-59)', () => {
  describe('formatSlackAtaPayload', () => {
    it('deve formatar payload padrão Slack Block Kit com metadados e blocos', () => {
      const payload = formatSlackAtaPayload({
        title: 'Reunião de Arquitetura TranscriBR',
        summaryMarkdown: '## Decisões Técnicas\n- Adotar arquitetura de webhooks redundante.',
        timeWindow: '30 minutos',
        model: 'llama-3.3-70b-versatile',
        speakers: ['Alice', 'Bob'],
        confluenceUrl: 'https://wastercaliari.atlassian.net/wiki/spaces/TBR/pages/12345'
      });

      assert.ok(payload.blocks);
      assert.ok(Array.isArray(payload.blocks));
      assert.strictEqual(payload.blocks[0].type, 'header');
      assert.ok(payload.blocks[0].text.text.includes('Reunião de Arquitetura'));

      const fieldsBlock = payload.blocks.find(b => b.type === 'section' && b.fields);
      assert.ok(fieldsBlock, 'Bloco de campos deve existir');
      const fieldsText = fieldsBlock.fields.map(f => f.text).join(' ');
      assert.ok(fieldsText.includes('30 minutos'));
      assert.ok(fieldsText.includes('llama-3.3-70b-versatile'));
      assert.ok(fieldsText.includes('Alice, Bob'));

      const contextBlock = payload.blocks.find(b => b.type === 'context');
      assert.ok(contextBlock, 'Bloco de contexto com link do Confluence deve existir');
      assert.ok(contextBlock.elements[0].text.includes('https://wastercaliari.atlassian.net/wiki/spaces/TBR/pages/12345'));
    });

    it('deve dividir textos longos em múltiplos blocos respeitando limite de 3000 caracteres', () => {
      const longText = 'Trecho de ata de reunião corporativa longa com diversas notas técnicas. '.repeat(60);
      const payload = formatSlackAtaPayload({
        title: 'Reunião Longa',
        summaryMarkdown: longText
      });

      const sectionBlocks = payload.blocks.filter(b => b.type === 'section' && b.text);
      assert.ok(sectionBlocks.length > 1, 'Deve fragmentar em mais de um bloco');
      for (const sb of sectionBlocks) {
        assert.ok(sb.text.text.length <= 3000, 'Nenhum bloco pode exceder 3000 caracteres');
      }
    });

    it('deve aplicar valores padrão caso campos estejam ausentes', () => {
      const payload = formatSlackAtaPayload({});
      assert.ok(payload.blocks.length >= 2);
      assert.ok(payload.blocks[0].text.text.includes('Ata Técnica'));
    });
  });

  describe('formatTeamsAtaPayload', () => {
    it('deve formatar payload no padrão MessageCard do Microsoft Teams', () => {
      const payload = formatTeamsAtaPayload({
        title: 'Alinhamento Semanal de Engenharia',
        summaryMarkdown: '• Ponto 1\n• Ponto 2',
        timeWindow: '45 minutos',
        model: 'groq/whisper-large-v3',
        speakers: ['Dev A', 'Dev B'],
        confluenceUrl: 'https://confluence.example.com/pages/view'
      });

      assert.strictEqual(payload['@type'], 'MessageCard');
      assert.strictEqual(payload.themeColor, '0078D7');
      assert.ok(payload.title.includes('Alinhamento Semanal'));
      assert.ok(Array.isArray(payload.sections));
      assert.strictEqual(payload.sections[0].facts.length, 3);
      assert.ok(payload.potentialAction);
      assert.strictEqual(payload.potentialAction[0].targets[0].uri, 'https://confluence.example.com/pages/view');
    });

    it('deve omitir potentialAction se confluenceUrl não for fornecido', () => {
      const payload = formatTeamsAtaPayload({
        title: 'Ata Sem Confluence',
        summaryMarkdown: 'Sem link'
      });

      assert.strictEqual(payload.potentialAction, undefined);
    });
  });

  describe('sendAtaToSlack & sendAtaToTeams', () => {
    it('sendAtaToSlack deve falhar graciosamente se webhookUrl estiver ausente', async () => {
      const res = await sendAtaToSlack('', { title: 'Teste' });
      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes('não informada'));
    });

    it('sendAtaToSlack deve enviar payload e retornar sucesso se HTTP 200', async () => {
      const mockFetch = async (url, opts) => {
        assert.strictEqual(url, 'https://hooks.slack.com/services/T00/B00/X00');
        assert.strictEqual(opts.method, 'POST');
        const body = JSON.parse(opts.body);
        assert.ok(body.blocks);
        return { ok: true, status: 200 };
      };

      const res = await sendAtaToSlack('https://hooks.slack.com/services/T00/B00/X00', {
        title: 'Sucesso Slack',
        summaryMarkdown: 'Ok'
      }, { fetchFn: mockFetch });

      assert.strictEqual(res.success, true);
    });

    it('sendAtaToSlack deve retornar erro caso HTTP seja != 200', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 404,
        text: async () => 'channel_not_found'
      });

      const res = await sendAtaToSlack('https://hooks.slack.com/invalid', {
        title: 'Erro Slack'
      }, { fetchFn: mockFetch });

      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes('404'));
    });

    it('sendAtaToTeams deve enviar payload e retornar sucesso se HTTP 200', async () => {
      const mockFetch = async (url, opts) => {
        assert.strictEqual(url, 'https://outlook.office.com/webhook/xxx');
        assert.strictEqual(opts.method, 'POST');
        const body = JSON.parse(opts.body);
        assert.strictEqual(body['@type'], 'MessageCard');
        return { ok: true, status: 200 };
      };

      const res = await sendAtaToTeams('https://outlook.office.com/webhook/xxx', {
        title: 'Sucesso Teams',
        summaryMarkdown: 'Ok Teams'
      }, { fetchFn: mockFetch });

      assert.strictEqual(res.success, true);
    });
  });

  describe('dispatchAtaToCorporateChannels', () => {
    it('deve despachar para ambos os canais quando ambos os webhooks estiverem configurados', async () => {
      let slackCalled = false;
      let teamsCalled = false;

      const mockFetch = async (url) => {
        if (url.includes('slack')) slackCalled = true;
        if (url.includes('office')) teamsCalled = true;
        return { ok: true, status: 200 };
      };

      const res = await dispatchAtaToCorporateChannels(
        { title: 'Ata Conjunta', summaryMarkdown: 'Conteúdo' },
        {
          slackWebhookUrl: 'https://hooks.slack.com/test',
          teamsWebhookUrl: 'https://outlook.office.com/webhook/test'
        },
        { fetchFn: mockFetch }
      );

      assert.strictEqual(slackCalled, true);
      assert.strictEqual(teamsCalled, true);
      assert.strictEqual(res.slack.success, true);
      assert.strictEqual(res.teams.success, true);
    });

    it('não deve disparar para canais não configurados', async () => {
      const res = await dispatchAtaToCorporateChannels(
        { title: 'Sem Canais' },
        { slackWebhookUrl: null, teamsWebhookUrl: null }
      );

      assert.strictEqual(res.slack, undefined);
      assert.strictEqual(res.teams, undefined);
    });
  });

  describe('bot.js exports integration', () => {
    it('deve exportar as funções de webhook corporativo a partir de bot.js', () => {
      assert.strictEqual(typeof bot.dispatchAtaToCorporateChannels, 'function');
      assert.strictEqual(typeof bot.formatSlackAtaPayload, 'function');
      assert.strictEqual(typeof bot.formatTeamsAtaPayload, 'function');
    });
  });
});
