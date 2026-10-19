const fs = require('fs');
const path = require('path');

const readmePath = path.resolve('d:/IA Projects/Antigravity Projects/agent-master-devsecops/README.md');
let content = fs.readFileSync(readmePath, 'utf8');

// Atualizar a versão e descrição da suíte
content = content.replace(
  '> **Versão:** 3.0 Enterprise Universal | **Status:** Produção / Alta Maturidade',
  '> **Versão:** 3.1 Enterprise Universal Reflexivo | **Status:** Produção / Alta Maturidade & Auto-Evolução Contínua'
);

// Atualizar tabela de agentes para incluir capacidade reflexiva do revisor e melhoria contínua
content = content.replace(
  '| **🔍 Revisor Crítico Independente** | [`agents/revisor.md`](./agents/revisor.md) | **Auditor Adversário Cego.** Revisa Pull Requests e diffs friamente. Caça bugs, race conditions e falhas de teste. **Nunca aprova o próprio código.** | `modo: revisor` |',
  '| **🔍 Revisor Crítico & Auditor Reflexivo** | [`agents/revisor.md`](./agents/revisor.md) | **Auditor Adversário & Auto-Auditoria.** Revisa Pull Requests e diffs friamente E audita as próprias personas, regras e prompts contra ambiguidades e desperdício de tokens. **Nunca aprova o próprio código.** | `modo: revisor` |'
);

content = content.replace(
  '| **📈 Agente de Melhoria Contínua** | [`agents/AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md`](./agents/AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md) | **Auditoria de Qualidade & Otimização.** Aplica PDCA/Ishikawa, benchmarking, profiling de CPU/RAM, redução de complexidade ciclomática e débitos técnicos. | `modo: melhoria` |',
  '| **📈 Agente de Melhoria Contínua & Ideias** | [`agents/AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md`](./agents/AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md) | **Auditoria de Qualidade, Otimização & Ideação Recursiva.** Aplica PDCA/Ishikawa, benchmarking, profiling de CPU/RAM, redução de complexidade ciclomática e **alimenta ativamente o docs/IDEAS.md com inovações para o próprio Agent**. | `modo: melhoria` |'
);

// Adicionar a seção de Auto-Evolução Reflexiva antes da seção 4
const reflexiveSection = `
### 🧬 3.3. O Ciclo de Auto-Evolução Reflexiva (Recursividade da Inteligência)

Diferente de agentes estáticos que apenas processam código alheio, o **Agent Master DevSecOps** aplica sua inteligência sobre **si mesmo**:
1. **Ideação Recursiva Contínua**: O Agente de Melhoria Contínua monitora cada resposta técnica e detecta oportunidades de enxugar prompts, refinar regras e criar novas ferramentas, registrando-as formalmente no backlog [\`docs/IDEAS.md\`](./docs/IDEAS.md).
2. **Auto-Auditoria Cética dos Agentes**: O Revisor Crítico (\`revisor.md\`) audita qualquer alteração nos arquivos das pastas \`/agents\` e \`/docs\`, exigindo testes de portabilidade e eliminando ambiguidades sintáticas.
3. **Ciclo Fechado de Entrega**: Toda evolução no próprio agente é commitada no repositório oficial, rastreada no Jira \`AGDEV\` e documentada no Confluence \`AGDEV\`.
`;

if (!content.includes('### 🧬 3.3. O Ciclo de Auto-Evolução Reflexiva')) {
  content = content.replace('## 📜 4. As 13 Regras Fundamentais de Engenharia', reflexiveSection + '\n---\n\n## 📜 4. As 13 Regras Fundamentais de Engenharia');
}

// Atualizar o Prompt Canônico na Seção 6 para incluir a auto-evolução reflexiva
const oldPromptDirectives = `DIRETRIZES DE ATIVAÇÃO E OPERAÇÃO:
1. Absorva as 13 Regras Fundamentais de Engenharia de \`docs/RULES.md\` e a arquitetura multi-agente de \`docs/ARCHITECTURE.md\`.
2. Mantenha os 5 Agentes Especializados ativos e comute dinamicamente entre eles:
   - \`modo: devsecops\`: Arquitetura, features, segurança Shift-Left e CI/CD.
   - \`modo: revisor\`: Auditoria independente, cética e adversária de código e PRs (revisor.md).
   - \`modo: melhoria\`: Otimização de performance, redução de complexidade e débitos técnicos.
   - \`modo: observabilidade\`: SRE, métricas Prometheus (/metrics), probes (/health) e auto-remediação.
3. Obedeça à regra de NÃO-AUTO-APROVAÇÃO: Todo código gerado pelo DevSecOps deve passar pela verificação fria do Revisor antes de ser considerado pronto.
4. Aplique a Matriz de Severidade (Crítica, Alta, Média, Baixa) com política Zero-Tolerance para segredos expostos, falhas de injeção e quebra de testes.
5. Estruture TODA resposta técnica relevante obrigatoriamente no PROTOCOLO CANÔNICO DE 15 SEÇÕES NUMERADAS (de 1. Resumo Executivo a 15. Melhorias Futuras).
6. Garanta o Tríplice Registro Contínuo (Git com commits semânticos/PRs, Issue Tracker com status de Kanban e Wiki com novos ADRs).`;

const newPromptDirectives = `DIRETRIZES DE ATIVAÇÃO E OPERAÇÃO:
1. Absorva as 13 Regras Fundamentais de Engenharia de \`docs/RULES.md\`, a arquitetura multi-agente de \`docs/ARCHITECTURE.md\` e o backlog de inovação em \`docs/IDEAS.md\`.
2. Mantenha os 5 Agentes Especializados ativos e comute dinamicamente entre eles:
   - \`modo: devsecops\`: Arquitetura, features, segurança Shift-Left e esteiras CI/CD.
   - \`modo: revisor\`: Auditoria independente, cética e adversária de código, PRs E dos próprios prompts/agentes (revisor.md).
   - \`modo: melhoria\`: Otimização de performance, redução de complexidade, débitos técnicos e ideação reflexiva contínua.
   - \`modo: observabilidade\`: SRE, métricas Prometheus (/metrics), probes (/health) e auto-remediação.
3. Obedeça à regra de NÃO-AUTO-APROVAÇÃO: Todo código ou prompt gerado pelo DevSecOps deve passar pela verificação fria do Revisor antes de ser considerado pronto.
4. Aplique o CICLO DE AUTO-EVOLUÇÃO REFLEXIVA: A cada entrega, avalie e registre melhorias para o próprio Agent Master em \`docs/IDEAS.md\`.
5. Aplique a Matriz de Severidade (Crítica, Alta, Média, Baixa) com política Zero-Tolerance para segredos expostos, falhas de injeção e quebra de testes.
6. Estruture TODA resposta técnica relevante obrigatoriamente no PROTOCOLO CANÔNICO DE 15 SEÇÕES NUMERADAS (de 1. Resumo Executivo a 15. Melhorias Futuras).
7. Garanta o Tríplice Registro Contínuo (Git com commits semânticos/PRs, Issue Tracker no Jira AGDEV/SCRUM e Wiki no Confluence AGDEV/TBR).`;

if (content.includes(oldPromptDirectives)) {
  content = content.replace(oldPromptDirectives, newPromptDirectives);
}

fs.writeFileSync(readmePath, content, 'utf8');
console.log('README.md updated with reflexive evolution.');
