const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

const tasks = [
  {
    summary: 'Estruturação do Hub de Agentes e Governança Multi-LLM no Repositório Dedicado',
    description: 'Consolidação da suite de agentes autônomos, segregação modular em /agents e /docs, testes de integridade e esteira de CI no GitHub Actions.',
    parentKey: 'AGDEV-1',
    status: 'Done' // Será transicionado após criação
  },
  {
    summary: 'Implementação de Suíte de Avaliação Automática de Agentes (Evaluation Harness)',
    description: 'Desenvolver harness automatizado para testar se qualquer modelo de IA aderiu estritamente às 13 regras e ao protocolo de 15 seções de resposta.',
    parentKey: 'AGDEV-3',
    status: 'Selected for Development'
  },
  {
    summary: 'Desenvolvimento de Servidor MCP Nativo (Model Context Protocol) para o Agent Master',
    description: 'Criar servidor MCP para expor os modos operacionais e ferramentas diretamente para IDEs modernas (Cursor, Claude Desktop, Antigravity).',
    parentKey: 'AGDEV-5',
    status: 'Backlog'
  },
  {
    summary: 'Playbooks Automatizados de Auto-Cura SRE e Circuit Breaker para LLMs',
    description: 'Implementar playbooks com circuit breaker em caso de rate limit (HTTP 429) ou instabilidade de inferência com fallback gracioso.',
    parentKey: 'AGDEV-4',
    status: 'Backlog'
  }
];

async function createInitialTasks() {
  for (const t of tasks) {
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
          issuetype: { id: '10005' }, // Tarefa
          summary: t.summary,
          parent: { key: t.parentKey },
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: t.description }]
            }]
          }
        }
      })
    });
    const data = await res.json();
    console.log(`Tarefa criada: ${data.key} (Epic: ${t.parentKey}) - ${t.summary}`);

    // Obter transições
    const transRes = await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${data.key}/transitions`, {
      headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
    });
    const transData = await transRes.json();
    const targetTrans = transData.transitions?.find(tr => tr.name.toLowerCase() === t.status.toLowerCase() || tr.to?.name?.toLowerCase() === t.status.toLowerCase());
    if (targetTrans) {
      await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${data.key}/transitions`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + auth,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transition: { id: targetTrans.id } })
      });
      console.log(`Tarefa ${data.key} transicionada para: ${t.status}`);
    }
  }
}

createInitialTasks().catch(console.error);
