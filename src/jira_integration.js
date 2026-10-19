/**
 * TranscriBR - Módulo de Integração Bidirecional com o Jira Cloud
 * Ticket: SCRUM-58 (I-14)
 *
 * Funcionalidades:
 * - Criação de tarefas/issues via comando slash (/jira criar-tarefa).
 * - Extração inteligente de compromissos e tarefas (Action Items) a partir de atas técnicas.
 * - Despacho direto para o Jira Cloud REST API v3 com formatação em Atlassian Document Format (ADF).
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Obtém as credenciais e domínio de autenticação do Jira.
 * Prioriza variáveis de ambiente e faz fallback seguro para 'Atlassian Account.txt'.
 */
function getJiraAuth() {
  const envEmail = process.env.ATLASSIAN_EMAIL || process.env.JIRA_EMAIL;
  const envToken = process.env.ATLASSIAN_API_TOKEN || process.env.JIRA_API_TOKEN;
  const envDomain = process.env.ATLASSIAN_DOMAIN || 'wastercaliari.atlassian.net';

  if (envEmail && envToken) {
    return {
      email: envEmail,
      token: envToken,
      domain: envDomain,
      authHeader: 'Basic ' + Buffer.from(`${envEmail}:${envToken}`).toString('base64')
    };
  }

  const accountFilePath = path.resolve(__dirname, '..', 'Atlassian Account.txt');
  if (fs.existsSync(accountFilePath)) {
    try {
      const content = fs.readFileSync(accountFilePath, 'utf8');
      const tokenMatch = content.match(/ATATT[A-Za-z0-9_\-=]+/);
      const emailMatch = content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

      const email = emailMatch ? emailMatch[1] : 'wasterlucas@gmail.com';
      const token = tokenMatch ? tokenMatch[0] : null;

      if (token) {
        return {
          email,
          token,
          domain: envDomain,
          authHeader: 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64')
        };
      }
    } catch {
      /* ignora erro de leitura */
    }
  }

  return null;
}

/**
 * Converte texto simples ou markdown para Atlassian Document Format (ADF) v1.
 * @param {string} text
 * @returns {object}
 */
function textToAdf(text) {
  if (!text) {
    return {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
    };
  }

  const paragraphs = text.split('\n\n').filter(Boolean);
  const content = paragraphs.map(p => ({
    type: 'paragraph',
    content: [{ type: 'text', text: p.replace(/\r/g, '').trim() }]
  }));

  return {
    type: 'doc',
    version: 1,
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [{ type: 'text', text }] }]
  };
}

/**
 * Cria uma issue/tarefa no Jira Cloud via REST API v3.
 * @param {object} params
 * @param {string} params.summary Título da tarefa
 * @param {string} [params.description] Detalhes ou contexto
 * @param {string} [params.projectKey='SCRUM'] Chave do projeto
 * @param {string} [params.issueType='Task'] Tipo do item
 * @param {string[]} [params.labels] Etiquetas
 * @param {object} [options] Opções de execução (ex.: mockFetch para testes)
 * @returns {Promise<{ success: boolean, key?: string, url?: string, error?: string }>}
 */
async function createJiraIssue(params, options = {}) {
  const {
    summary,
    description = '',
    projectKey = 'SCRUM',
    issueType = 'Task',
    labels = ['transcribr', 'discord-voice']
  } = params;

  if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
    return { success: false, error: 'O título (summary) da tarefa é obrigatório.' };
  }

  const auth = options.auth || getJiraAuth();
  if (!auth) {
    return { success: false, error: 'Credenciais do Atlassian/Jira não configuradas no servidor.' };
  }

  const cleanProjectKey = (projectKey || 'SCRUM').trim().toUpperCase();
  const cleanSummary = summary.trim();

  const payload = {
    fields: {
      project: { key: cleanProjectKey },
      summary: cleanSummary,
      description: textToAdf(description),
      issuetype: { name: issueType },
      labels: Array.isArray(labels) ? labels : ['transcribr']
    }
  };

  const fetchFn = options.fetchFn || globalThis.fetch;
  const url = `https://${auth.domain}/rest/api/3/issue`;

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Authorization': auth.authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Erro Jira HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    const issueKey = data.key;
    const issueUrl = `https://${auth.domain}/browse/${issueKey}`;

    return {
      success: true,
      key: issueKey,
      url: issueUrl
    };
  } catch (err) {
    return { success: false, error: `Falha na requisição ao Jira: ${err.message}` };
  }
}

/**
 * Extrai compromissos, tarefas e combinados (Action Items) a partir do texto de uma ata técnica.
 * Procura principalmente na seção 6 "Decisões, Combinados e Próximos Passos" ou tópicos de ação.
 * @param {string} ataMarkdown
 * @returns {Array<{ title: string, description: string, assignee: string|null }>}
 */
function extractActionItemsFromAta(ataMarkdown) {
  if (!ataMarkdown || typeof ataMarkdown !== 'string') return [];

  const items = [];
  const lines = ataMarkdown.split('\n');
  let insideActionSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detecta início da seção de decisões / próximos passos
    if (/(?:decisões|combinados|próximos passos|action items|acuerdos)/i.test(line)) {
      insideActionSection = true;
      continue;
    }

    // Se encontrar outro título de seção numerado (ex.: "7.", "##"), sai da seção
    if (insideActionSection && /^(?:[1-57-9]\.|\#{1,3}\s)/.test(line)) {
      insideActionSection = false;
    }

    if (insideActionSection) {
      // Linhas com bullet point ("•", "-", "*")
      const bulletMatch = line.match(/^[ \t]*[•\-\*]\s+(.+)$/);
      if (bulletMatch) {
        const rawItem = bulletMatch[1].trim();
        if (rawItem.length > 5) {
          // Extrai provável responsável caso formatado como "**Nome**: tarefa" ou "(Responsável: Nome)"
          let assignee = null;
          let title = rawItem;

          const responsibleMatch = rawItem.match(/\((?:responsável|assigned|dono):\s*([^\)]+)\)/i);
          if (responsibleMatch) {
            assignee = responsibleMatch[1].trim();
            title = rawItem.replace(responsibleMatch[0], '').trim();
          } else {
            const prefixMatch = rawItem.match(/^\*\*([^\*:]+)\*\*:\s*(.+)$/);
            if (prefixMatch) {
              assignee = prefixMatch[1].trim();
              title = prefixMatch[2].trim();
            }
          }

          items.push({
            title: title.replace(/^[\s:–—-]+/, '').trim(),
            description: `Ação acordada na ata técnica da reunião.\nContexto: ${rawItem}`,
            assignee
          });
        }
      }
    }
  }

  return items;
}

module.exports = {
  getJiraAuth,
  textToAdf,
  createJiraIssue,
  extractActionItemsFromAta
};
