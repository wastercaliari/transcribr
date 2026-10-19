/**
 * TranscriBR - Sistema de Vigilância e Alertas Proativos por Palavras-Chave Críticas de Engenharia
 * Ticket: SCRUM-60 (I-16)
 *
 * Funcionalidades:
 * - Monitoramento em tempo real de termos críticos de segurança, infraestrutura e estabilidade operacional.
 * - Normalização fonético-sintática sem diferenciação de acentos e maiúsculas/minúsculas.
 * - Categorização por severidade (SECURITY, INFRASTRUCTURE, OPERATIONAL_CRITICAL).
 * - Mecanismo de Cooldown anti-tempestade (anti-alert-storm) por guilda e categoria.
 * - Formatação rica de alertas para canais de plantão / webhooks de DevOps e SRE.
 */

'use strict';

const DEFAULT_CRITICAL_PATTERNS = [
  // Categoria de Segurança da Informação (SECURITY)
  {
    category: 'SECURITY',
    severity: 'CRITICAL',
    color: 0xED4245, // Vermelho Discord
    terms: [
      'vazamento de credencial',
      'vazamento de senha',
      'token exposto',
      'chave privada exposta',
      'incidente de seguranca',
      'ataque ddos',
      'invasao hacker',
      'sql injection',
      'cve critica',
      'chave vazou',
      'credencial vazou',
      'senha vazou',
      'token vazou'
    ]
  },
  // Categoria de Infraestrutura e Confiabilidade (INFRASTRUCTURE)
  {
    category: 'INFRASTRUCTURE',
    severity: 'HIGH',
    color: 0xE67E22, // Laranja
    terms: [
      'banco fora do ar',
      'queda em producao',
      'sistema caiu',
      'servidor caiu',
      'database down',
      'cluster down',
      '502 bad gateway',
      '500 internal server error',
      'railway caiu',
      'disco cheio',
      'estouro de memoria',
      'out of memory',
      'servico indisponivel'
    ]
  },
  // Categoria Operacional e Decisões de Emergência (OPERATIONAL_CRITICAL)
  {
    category: 'OPERATIONAL_CRITICAL',
    severity: 'MEDIUM',
    color: 0xF1C40F, // Amarelo
    terms: [
      'rollback urgente',
      'interromper deploy',
      'parar producao',
      'perda de dados',
      'corrupcao de dados',
      'abortar lancamento'
    ]
  }
];

/**
 * Remove acentuação e converte para minúsculas para matching resiliente.
 * @param {string} str
 * @returns {string}
 */
function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

class KeywordWatcher {
  /**
   * @param {object} [options]
   * @param {Array<{ category: string, severity: string, color: number, terms: string[] }>} [options.patterns]
   * @param {number} [options.cooldownMs] Tempo de cooldown por guilda/categoria (padrão: 60s)
   */
  constructor(options = {}) {
    this.patterns = options.patterns || DEFAULT_CRITICAL_PATTERNS;
    this.cooldownMs = options.cooldownMs || 60_000;
    // Map chave -> timestamp: `${guildId}:${category}:${term}`
    this.cooldowns = new Map();
  }

  /**
   * Escaneia o texto da transcrição em busca de termos críticos.
   * @param {string} text Texto transcrito da fala
   * @param {object} [context] Metadados da fala
   * @param {string} [context.guildId]
   * @param {string} [context.author]
   * @param {boolean} [context.ignoreCooldown]
   * @returns {{ triggered: boolean, alerts: Array<{ category: string, severity: string, color: number, term: string }> }}
   */
  scan(text, context = {}) {
    if (!text || typeof text !== 'string') {
      return { triggered: false, alerts: [] };
    }

    const normText = normalizeText(text);
    const now = Date.now();
    const guildId = context.guildId || 'global';
    const alerts = [];

    for (const pattern of this.patterns) {
      for (const term of pattern.terms) {
        const normTerm = normalizeText(term);
        if (normText.includes(normTerm)) {
          const cooldownKey = `${guildId}:${pattern.category}:${normTerm}`;
          const lastAlert = this.cooldowns.get(cooldownKey) || 0;

          if (context.ignoreCooldown || now - lastAlert >= this.cooldownMs) {
            this.cooldowns.set(cooldownKey, now);
            alerts.push({
              category: pattern.category,
              severity: pattern.severity,
              color: pattern.color,
              term
            });
          }
        }
      }
    }

    // Limpeza de cooldowns expirados para evitar crescimento indefinido da memória
    if (this.cooldowns.size > 200) {
      for (const [key, timestamp] of this.cooldowns.entries()) {
        if (now - timestamp > this.cooldownMs * 2) {
          this.cooldowns.delete(key);
        }
      }
    }

    return {
      triggered: alerts.length > 0,
      alerts
    };
  }

  /**
   * Reseta o histórico de cooldowns (útil para testes).
   */
  clearCooldowns() {
    this.cooldowns.clear();
  }
}

/**
 * Formata um payload de alerta no padrão de Embed para Discord.
 * @param {object} alertData
 * @param {string} alertData.author Nome do locutor
 * @param {string} alertData.text Trecho transcrito
 * @param {Array<{ category: string, severity: string, color: number, term: string }>} alertData.alerts
 * @param {string} [alertData.channelName] Canal de voz
 * @param {string} [alertData.guildName] Servidor
 * @returns {object} Embed structure
 */
function formatAlertEmbed(alertData) {
  const {
    author = 'Desconhecido',
    text = '',
    alerts = [],
    channelName = 'Canal de Voz',
    guildName = 'Servidor'
  } = alertData;

  const topSeverity = alerts.some(a => a.severity === 'CRITICAL')
    ? 'CRITICAL'
    : alerts.some(a => a.severity === 'HIGH')
      ? 'HIGH'
      : 'MEDIUM';

  const primaryColor = alerts[0]?.color || 0xED4245;
  const matchedTerms = alerts.map(a => `\`${a.term}\` (${a.category})`).join(', ');

  return {
    color: primaryColor,
    title: `🚨 Alerta Proativo de Engenharia [${topSeverity}]`,
    description: `Detectado termo de criticidade na fala ao vivo durante reunião de voz.`,
    fields: [
      {
        name: '👤 Locutor',
        value: author,
        inline: true
      },
      {
        name: '🔊 Canal de Voz',
        value: channelName,
        inline: true
      },
      {
        name: '🏢 Servidor',
        value: guildName,
        inline: true
      },
      {
        name: '⚠️ Termos Identificados',
        value: matchedTerms || 'Termo crítico detectado',
        inline: false
      },
      {
        name: '💬 Trecho da Fala Transcrita',
        value: text.length > 1000 ? `${text.slice(0, 997)}...` : `"${text}"`,
        inline: false
      }
    ],
    footer: {
      text: 'TranscriBR — Vigilância Ativa de Engenharia & SRE'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Despacha o alerta para webhook configurado ou canal de texto dedicado.
 * @param {object} alertData
 * @param {object} [options]
 * @param {string} [options.webhookUrl]
 * @param {Function} [options.fetchFn]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function dispatchProactiveAlert(alertData, options = {}) {
  const webhookUrl = options.webhookUrl || process.env.CRITICAL_ALERTS_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, error: 'Webhook de alertas proativos não configurado.' };
  }

  const embed = formatAlertEmbed(alertData);
  const payload = {
    content: `🚨 **Atenção Plantão SRE/DevOps:** Alerta de criticidade detectado em chamada de voz!`,
    embeds: [embed]
  };

  const fetchFn = options.fetchFn || globalThis.fetch;

  try {
    const res = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Alerta HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `Falha ao despachar alerta: ${err.message}` };
  }
}

module.exports = {
  KeywordWatcher,
  DEFAULT_CRITICAL_PATTERNS,
  normalizeText,
  formatAlertEmbed,
  dispatchProactiveAlert
};
