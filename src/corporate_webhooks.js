/**
 * TranscriBR - Módulo de Transmissão Corporativa de Atas para Slack e Microsoft Teams
 * Ticket: SCRUM-59 (I-15)
 *
 * Funcionalidades:
 * - Despacho de atas técnicas para canais do Slack via Webhooks com formato Block Kit.
 * - Despacho de atas técnicas para canais do Microsoft Teams via Webhooks com formato MessageCard / Adaptive Card.
 * - Suporte a divisão inteligente de blocos para limites de caracteres (Slack 3000 chars / Teams).
 * - Orquestração unificada de canais corporativos (dispatchAtaToCorporateChannels).
 */

'use strict';

/**
 * Converte e formata os dados da ata técnica no padrão Block Kit do Slack.
 * @param {object} ataData
 * @param {string} ataData.title Título da ata/reunião
 * @param {string} ataData.summaryMarkdown Conteúdo resumido em Markdown
 * @param {string} [ataData.timeWindow] Duração analisada (ex.: "30 minutos")
 * @param {string} [ataData.model] Modelo de IA gerador
 * @param {string[]} [ataData.speakers] Participantes da reunião
 * @param {string} [ataData.confluenceUrl] Link da ata no Confluence
 * @returns {object} Payload JSON para Slack
 */
function formatSlackAtaPayload(ataData) {
  const {
    title = 'Ata Técnica de Reunião — TranscriBR',
    summaryMarkdown = '',
    timeWindow = 'Recente',
    model = 'Groq Cloud',
    speakers = [],
    confluenceUrl = ''
  } = ataData;

  const speakersStr = Array.isArray(speakers) && speakers.length > 0 ? speakers.join(', ') : 'Participantes da chamada';

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📋 ${title.slice(0, 140)}`,
        emoji: true
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*⏱️ Janela Analisada:*\n${timeWindow}`
        },
        {
          type: 'mrkdwn',
          text: `*🤖 Modelo LLM:*\n${model}`
        },
        {
          type: 'mrkdwn',
          text: `*👥 Participantes:*\n${speakersStr}`
        },
        {
          type: 'mrkdwn',
          text: `*📅 Data:*\n${new Date().toLocaleDateString('pt-BR')}`
        }
      ]
    },
    {
      type: 'divider'
    }
  ];

  // Divide o conteúdo do resumo em blocos de até 2800 caracteres para respeitar o teto do Slack (3000 chars)
  const maxBlockLen = 2800;
  let remaining = summaryMarkdown.trim();

  while (remaining.length > 0) {
    let chunk = remaining.slice(0, maxBlockLen);
    if (remaining.length > maxBlockLen) {
      const lastNewline = chunk.lastIndexOf('\n');
      if (lastNewline > maxBlockLen * 0.6) {
        chunk = remaining.slice(0, lastNewline);
      }
    }
    remaining = remaining.slice(chunk.length).trim();

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: chunk
      }
    });
  }

  // Se houver link no Confluence, anexa bloco de ação/botão
  if (confluenceUrl) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🌐 *Confluence:* <${confluenceUrl}|Abrir Ata Técnica Completa>`
        }
      ]
    });
  }

  return { blocks };
}

/**
 * Converte e formata os dados da ata técnica no padrão MessageCard do Microsoft Teams.
 * @param {object} ataData
 * @returns {object} Payload JSON para Microsoft Teams
 */
function formatTeamsAtaPayload(ataData) {
  const {
    title = 'Ata Técnica de Reunião — TranscriBR',
    summaryMarkdown = '',
    timeWindow = 'Recente',
    model = 'Groq Cloud',
    speakers = [],
    confluenceUrl = ''
  } = ataData;

  const speakersStr = Array.isArray(speakers) && speakers.length > 0 ? speakers.join(', ') : 'Participantes';

  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: title,
    themeColor: '0078D7', // Azul Teams
    title: `📋 ${title}`,
    sections: [
      {
        activityTitle: 'TranscriBR — Síntese Automatizada de Reunião de Voz',
        activitySubtitle: `Data: ${new Date().toLocaleString('pt-BR')}`,
        facts: [
          { name: 'Janela Analisada', value: timeWindow },
          { name: 'Motor de IA', value: model },
          { name: 'Participantes', value: speakersStr }
        ],
        text: summaryMarkdown.replace(/•/g, '*').trim()
      }
    ]
  };

  if (confluenceUrl) {
    payload.potentialAction = [
      {
        '@type': 'OpenUri',
        name: 'Abrir no Confluence',
        targets: [{ os: 'default', uri: confluenceUrl }]
      }
    ];
  }

  return payload;
}

/**
 * Despacha a ata técnica para o webhook do Slack.
 * @param {string} webhookUrl URL do Webhook do Slack
 * @param {object} ataData
 * @param {object} [options]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendAtaToSlack(webhookUrl, ataData, options = {}) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return { success: false, error: 'URL do webhook do Slack não informada.' };
  }

  const payload = formatSlackAtaPayload(ataData);
  const fetchFn = options.fetchFn || globalThis.fetch;

  try {
    const res = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Slack HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `Falha ao enviar webhook Slack: ${err.message}` };
  }
}

/**
 * Despacha a ata técnica para o webhook do Microsoft Teams.
 * @param {string} webhookUrl URL do Webhook do Teams
 * @param {object} ataData
 * @param {object} [options]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendAtaToTeams(webhookUrl, ataData, options = {}) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return { success: false, error: 'URL do webhook do Microsoft Teams não informada.' };
  }

  const payload = formatTeamsAtaPayload(ataData);
  const fetchFn = options.fetchFn || globalThis.fetch;

  try {
    const res = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Teams HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `Falha ao enviar webhook Teams: ${err.message}` };
  }
}

/**
 * Despacha a ata para todos os canais corporativos configurados (Slack e Teams).
 * @param {object} ataData
 * @param {object} [config]
 * @param {object} [options]
 * @returns {Promise<{ slack?: { success: boolean, error?: string }, teams?: { success: boolean, error?: string } }>}
 */
async function dispatchAtaToCorporateChannels(ataData, config = {}, options = {}) {
  const slackUrl = config.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL;
  const teamsUrl = config.teamsWebhookUrl || process.env.TEAMS_WEBHOOK_URL;

  const results = {};

  if (slackUrl) {
    results.slack = await sendAtaToSlack(slackUrl, ataData, options);
  }

  if (teamsUrl) {
    results.teams = await sendAtaToTeams(teamsUrl, ataData, options);
  }

  return results;
}

module.exports = {
  formatSlackAtaPayload,
  formatTeamsAtaPayload,
  sendAtaToSlack,
  sendAtaToTeams,
  dispatchAtaToCorporateChannels
};
