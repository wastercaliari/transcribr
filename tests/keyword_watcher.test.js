const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  KeywordWatcher,
  DEFAULT_CRITICAL_PATTERNS,
  normalizeText,
  formatAlertEmbed,
  dispatchProactiveAlert
} = require('../src/keyword_watcher');
const bot = require('../bot');

describe('Proactive Engineering Keyword Vigilance Module (SCRUM-60)', () => {
  describe('normalizeText', () => {
    it('deve remover acentos e converter para minúsculas', () => {
      assert.strictEqual(normalizeText('Incidente de Segurança Crítica'), 'incidente de seguranca critica');
      assert.strictEqual(normalizeText('Queda em Produção'), 'queda em producao');
      assert.strictEqual(normalizeText('BANCO FORA DO AR'), 'banco fora do ar');
    });

    it('deve lidar com entradas nulas ou inválidas retornando string vazia', () => {
      assert.strictEqual(normalizeText(null), '');
      assert.strictEqual(normalizeText(undefined), '');
      assert.strictEqual(normalizeText(12345), '');
    });
  });

  describe('KeywordWatcher.scan', () => {
    let watcher;

    beforeEach(() => {
      watcher = new KeywordWatcher({ cooldownMs: 1000 });
    });

    it('deve detectar palavras-chave críticas de SEGURANÇA', () => {
      const res = watcher.scan('Pessoal, tivemos um vazamento de credencial no repositório.', {
        guildId: 'guild-1',
        author: 'Alice'
      });

      assert.strictEqual(res.triggered, true);
      assert.strictEqual(res.alerts.length, 1);
      assert.strictEqual(res.alerts[0].category, 'SECURITY');
      assert.strictEqual(res.alerts[0].severity, 'CRITICAL');
      assert.strictEqual(res.alerts[0].term, 'vazamento de credencial');
    });

    it('deve detectar palavras-chave críticas de INFRAESTRUTURA', () => {
      const res = watcher.scan('O banco fora do ar está afetando todos os usuários agora.', {
        guildId: 'guild-1',
        author: 'Bob'
      });

      assert.strictEqual(res.triggered, true);
      assert.strictEqual(res.alerts[0].category, 'INFRASTRUCTURE');
      assert.strictEqual(res.alerts[0].severity, 'HIGH');
      assert.strictEqual(res.alerts[0].term, 'banco fora do ar');
    });

    it('deve detectar palavras-chave de DECISÕES DE OPERAÇÃO CRÍTICA', () => {
      const res = watcher.scan('Precisamos dar rollback urgente no deploy da versão 2.4.', {
        guildId: 'guild-1',
        author: 'Carol'
      });

      assert.strictEqual(res.triggered, true);
      assert.strictEqual(res.alerts[0].category, 'OPERATIONAL_CRITICAL');
      assert.strictEqual(res.alerts[0].severity, 'MEDIUM');
      assert.strictEqual(res.alerts[0].term, 'rollback urgente');
    });

    it('não deve disparar alertas para conversas rotineiras de engenharia', () => {
      const res = watcher.scan('Vamos revisar o pull request e rodar a suíte de testes unitários.', {
        guildId: 'guild-1',
        author: 'Dave'
      });

      assert.strictEqual(res.triggered, false);
      assert.strictEqual(res.alerts.length, 0);
    });

    it('deve respeitar a janela de cooldown anti-tempestade (anti-alert-storm)', () => {
      // Primeiro disparo deve alertar
      const res1 = watcher.scan('vazamento de senha detectado', { guildId: 'guild-1' });
      assert.strictEqual(res1.triggered, true);

      // Segundo disparo imediato do mesmo termo deve ser suprimido pelo cooldown
      const res2 = watcher.scan('repetindo: vazamento de senha detectado', { guildId: 'guild-1' });
      assert.strictEqual(res2.triggered, false);

      // Disparo em guilda diferente deve funcionar normalmente
      const res3 = watcher.scan('vazamento de senha detectado', { guildId: 'guild-2' });
      assert.strictEqual(res3.triggered, true);

      // Disparo com ignoreCooldown deve passar
      const res4 = watcher.scan('vazamento de senha detectado', { guildId: 'guild-1', ignoreCooldown: true });
      assert.strictEqual(res4.triggered, true);
    });

    it('deve tratar entradas nulas ou vazias sem erro', () => {
      const res1 = watcher.scan('');
      assert.strictEqual(res1.triggered, false);
      const res2 = watcher.scan(null);
      assert.strictEqual(res2.triggered, false);
    });
  });

  describe('formatAlertEmbed', () => {
    it('deve montar estrutura rica de Embed com campos informativos', () => {
      const embed = formatAlertEmbed({
        author: 'Engenheiro SRE',
        text: 'Atenção, o servidor caiu e a aplicação está fora do ar.',
        alerts: [
          { category: 'INFRASTRUCTURE', severity: 'HIGH', color: 0xE67E22, term: 'servidor caiu' }
        ],
        channelName: 'Incident War Room',
        guildName: 'TranscriBR Enterprise'
      });

      assert.strictEqual(embed.color, 0xE67E22);
      assert.ok(embed.title.includes('[HIGH]'));
      assert.strictEqual(embed.fields.length, 5);
      assert.strictEqual(embed.fields[0].value, 'Engenheiro SRE');
      assert.strictEqual(embed.fields[1].value, 'Incident War Room');
      assert.strictEqual(embed.fields[2].value, 'TranscriBR Enterprise');
      assert.ok(embed.fields[3].value.includes('`servidor caiu`'));
      assert.ok(embed.fields[4].value.includes('servidor caiu'));
    });

    it('deve truncar falas longas para respeitar os limites de mensagem do Discord', () => {
      const longText = 'texto de fala muito longo '.repeat(100);
      const embed = formatAlertEmbed({
        author: 'Locutor',
        text: longText,
        alerts: [{ category: 'SECURITY', severity: 'CRITICAL', color: 0xED4245, term: 'chave vazou' }]
      });

      assert.ok(embed.fields[4].value.length <= 1000);
      assert.ok(embed.fields[4].value.endsWith('...'));
    });
  });

  describe('dispatchProactiveAlert', () => {
    it('deve falhar graciosamente quando webhook não estiver configurado', async () => {
      const res = await dispatchProactiveAlert({ text: 'alerta' }, { webhookUrl: '' });
      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes('não configurado'));
    });

    it('deve enviar payload para webhook e retornar sucesso em HTTP 200', async () => {
      const mockFetch = async (url, opts) => {
        assert.strictEqual(url, 'https://discord.com/api/webhooks/test-sre');
        assert.strictEqual(opts.method, 'POST');
        const body = JSON.parse(opts.body);
        assert.ok(body.embeds);
        assert.ok(body.content.includes('Plantão SRE'));
        return { ok: true, status: 200 };
      };

      const res = await dispatchProactiveAlert(
        {
          author: 'DevOps',
          text: 'banco fora do ar',
          alerts: [{ category: 'INFRASTRUCTURE', severity: 'HIGH', color: 0xE67E22, term: 'banco fora do ar' }]
        },
        {
          webhookUrl: 'https://discord.com/api/webhooks/test-sre',
          fetchFn: mockFetch
        }
      );

      assert.strictEqual(res.success, true);
    });

    it('deve retornar erro em caso de status HTTP != 200', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const res = await dispatchProactiveAlert(
        { text: 'erro' },
        {
          webhookUrl: 'https://discord.com/api/webhooks/fail',
          fetchFn: mockFetch
        }
      );

      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes('500'));
    });
  });

  describe('bot.js integration', () => {
    it('deve exportar KeywordWatcher e helpers em bot.js', () => {
      assert.strictEqual(typeof bot.KeywordWatcher, 'function');
      assert.ok(bot.globalKeywordWatcher instanceof bot.KeywordWatcher);
      assert.strictEqual(typeof bot.formatAlertEmbed, 'function');
      assert.strictEqual(typeof bot.dispatchProactiveAlert, 'function');
      assert.ok(Array.isArray(bot.DEFAULT_CRITICAL_PATTERNS));
    });
  });
});
