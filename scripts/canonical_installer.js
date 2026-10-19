/**
 * TranscriBR - Instalador e Verificador Modular Canônico de Agentes Enterprise
 * Ticket: SCRUM-71
 *
 * Funcionalidades:
 * - Validação da integridade estrutural das pastas /agents e /docs (14 arquivos canônicos).
 * - Geração de templates de configuração rápida para Cursor (.cursorrules), Claude (CLAUDE.md) e Antigravity.
 * - Renderização parametrizada do Prompt Canônico Master com metadados do projeto.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CANONICAL_FILES = [
  'agents/AGENTE_MESTRE_UNIVERSAL.md',
  'agents/AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md',
  'agents/AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md',
  'agents/revisor.md',
  'agents/PROMPT_INSTALACAO_ENTERPRISE.md',
  'agents/README.md',
  'docs/ARCHITECTURE.md',
  'docs/RULES.md',
  'docs/RULES 16.4 SETUP.md',
  'docs/STATE.md',
  'docs/CHANGELOG.md',
  'docs/IDEAS.md',
  'docs/CALCULATIONS.md',
  'docs/CANONICAL_MODULAR_ENTERPRISE_PROMPT.md',
  'docs/README.md'
];

/**
 * Valida a integridade da estrutura modular de agentes e documentos em um diretório.
 * @param {string} baseDir Diretório raiz do projeto
 * @returns {{ valid: boolean, total: number, present: string[], missing: string[] }}
 */
function validateModularStructure(baseDir) {
  const missing = [];
  const present = [];

  for (const relPath of CANONICAL_FILES) {
    const fullPath = path.join(baseDir, relPath);
    if (fs.existsSync(fullPath)) {
      present.push(relPath);
    } else {
      missing.push(relPath);
    }
  }

  return {
    valid: missing.length === 0,
    total: CANONICAL_FILES.length,
    present,
    missing
  };
}

/**
 * Renderiza o prompt canônico customizado com metadados do projeto.
 * @param {object} meta
 * @param {string} meta.projectName Nome do projeto
 * @param {string} [meta.techStack] Stack tecnológica principal
 * @param {string} [meta.ticketSystem] Sistema de tickets (ex.: Jira SCRUM)
 * @returns {string} Prompt renderizado
 */
function renderCanonicalPrompt(meta = {}) {
  const projectName = meta.projectName || 'TranscriBR Enterprise';
  const techStack = meta.techStack || 'Node.js, Discord.js, Groq Cloud, SQLite, Docker, GitHub Actions';
  const ticketSystem = meta.ticketSystem || 'Jira Cloud / GitHub Issues';

  return `Você é o AGENTE MESTRE UNIVERSAL DE ENGENHARIA DE SOFTWARE, ARQUITETURA, DEVSECOPS E GOVERNANÇA do projeto "${projectName}".
Stack Tecnológica: ${techStack}
Sistema de Governança & Rastreabilidade: ${ticketSystem}

Você opera sob a estrutura modular soberana das pastas /agents e /docs com 14 contratos de engenharia catalogados:
- agents/AGENTE_MESTRE_UNIVERSAL.md (Orquestrador multi-persona)
- agents/AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md (Staff Engineer & DevSecOps Lead)
- agents/AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md (Auditor de qualidade contínua)
- agents/revisor.md (Revisor cético e adversário)
- docs/RULES.md (13 Regras Fundamentais de Engenharia)
- docs/CANONICAL_MODULAR_ENTERPRISE_PROMPT.md (Manual mestre e MCP)
- docs/ARCHITECTURE.md (Topologia cooperativa e matriz de handovers)

Modos de Operação Disponíveis:
- modo: devsecops
- modo: revisor
- modo: melhoria
- modo: observabilidade
- modo: full-developer (loop ininterrupto de implementação autônoma)

Protocolo Obrigatório: Protocolo de Resposta em Duas Camadas (relatórios densos de 15 seções externalizados no Jira/Confluence/PRs e respostas curtas com links e dupla quebra de linha (\n\n) no chat). Declare prontidão para atuar.`;
}

/**
 * Instala arquivos de integração (.cursorrules e CLAUDE.md) no diretório alvo.
 * @param {string} targetDir
 * @param {object} [meta]
 * @returns {{ cursorRulesPath: string, claudeMdPath: string }}
 */
function installIdeConfigs(targetDir, meta = {}) {
  const projectName = meta.projectName || 'TranscriBR Enterprise';

  const cursorContent = `# Regras de Engenharia & Governança Enterprise — ${projectName}
Antes de qualquer alteração, consulte obrigatoriamente:
- agents/AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md
- docs/RULES.md (As 13 Regras de Ouro)
- docs/CANONICAL_MODULAR_ENTERPRISE_PROMPT.md

Diretrizes Estritas:
1. Cultura de testes obrigatória (Node test runner) com 100% de aprovação.
2. Imunidade a ReDoS (CWE-1333) e sanitização recursiva anti-CWE-116/CWE-20.
3. Commits semânticos vinculados a cards do Jira em branches dedicadas.
4. Respostas organizadas com dupla quebra de linha entre os tópicos.
`;

  const claudeContent = `# Diretrizes de Orquestração Enterprise — ${projectName}
Este projeto utiliza a estrutura modular soberana de agentes em \`/agents\` e governança em \`/docs\`.
Siga o contrato universal de Staff Engineer e o protocolo de resposta em duas camadas.
`;

  const cursorRulesPath = path.join(targetDir, '.cursorrules');
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');

  fs.writeFileSync(cursorRulesPath, cursorContent, 'utf8');
  fs.writeFileSync(claudeMdPath, claudeContent, 'utf8');

  return { cursorRulesPath, claudeMdPath };
}

if (require.main === module) {
  const rootDir = path.resolve(__dirname, '..');
  console.log('🏛️ Validando estrutura modular enterprise...');
  const result = validateModularStructure(rootDir);

  if (result.valid) {
    console.log(`✅ Estrutura 100% íntegra: todos os ${result.total} arquivos canônicos foram localizados.`);
  } else {
    console.warn(`⚠️ Arquivos ausentes (${result.missing.length}):`, result.missing);
  }
}

module.exports = {
  CANONICAL_FILES,
  validateModularStructure,
  renderCanonicalPrompt,
  installIdeConfigs
};
