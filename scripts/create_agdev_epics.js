const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

const epics = [
  {
    summary: 'Arquitetura Multi-Agente & Orquestração Central',
    description: 'Evolução do Agente Mestre Universal, topologia multi-agente, barramento de eventos, handovers autônomos e compatibilidade agnóstica entre LLMs.'
  },
  {
    summary: 'DevSecOps, Segurança Shift-Left & SAST/DAST',
    description: 'Blindagem de código, prevenção a vulnerabilidades OWASP Top 10, CWE-116, CWE-1333 (ReDoS), integração com scanners (CodeQL, TruffleHog, Snyk) e zero-tolerance a segredos.'
  },
  {
    summary: 'Auditoria Crítica Independente & Qualidade de Código',
    description: 'Evolução do revisor.md e do Agente de Melhoria Contínua: inspeção cética, caça a bugs, testes de quebra obrigatórios, profiling de CPU/RAM e redução de complexidade ciclomática.'
  },
  {
    summary: 'SRE, Observabilidade Ativa & Auto-Remediação',
    description: 'Monitoramento contínuo com Prometheus (/metrics), Grafana como código (IaC), healthchecks, detecção preditiva de saturação e playbooks de auto-cura.'
  },
  {
    summary: 'Interoperabilidade Multi-Plataforma & Tooling (MCP / IDEs)',
    description: 'Integração e empacotamento universal para Cursor IDE (.cursorrules), Windsurf, Claude Projects, ChatGPT Custom GPTs, Ollama local e Model Context Protocol (MCP).'
  }
];

async function createEpics() {
  const createdEpics = [];
  for (const epic of epics) {
    const res = await fetch('https://wastercaliari.atlassian.net/rest/api/3/issue', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          project: { key: 'AGDEV' },
          issuetype: { id: '10000' }, // Epic
          summary: epic.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: epic.description }]
            }]
          }
        }
      })
    });
    const data = await res.json();
    console.log(`Epic criado: ${data.key} - ${epic.summary}`);
    createdEpics.push({ key: data.key, summary: epic.summary });
  }
  return createdEpics;
}

createEpics().catch(console.error);
