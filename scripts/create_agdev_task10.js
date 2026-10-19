const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

async function createAndStartIssue() {
  const createRes = await fetch('https://wastercaliari.atlassian.net/rest/api/3/issue', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        project: { key: 'AGDEV' },
        issuetype: { id: '10005' },
        summary: 'Auto-Evolução Reflexiva: Gerador de Ideias e Revisor Recursivo para o próprio Agent Master',
        parent: { key: 'AGDEV-1' },
        description: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Reanalisar a suíte do Agent Master para dotá-la de capacidade de auto-evolução reflexiva: garantir que o gerador de ideias (docs/IDEAS.md), o revisor adversário (revisor.md) e a melhoria contínua operem recursivamente sobre as próprias especificações de agentes, prompts, regras e automações, gerando o melhor agent DevSecOps universal do mundo.'
            }]
          }]
        }
      }
    })
  });
  const data = await createRes.json();
  console.log('Ticket criado no AGDEV:', data.key);

  const transRes = await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${data.key}/transitions`, {
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
  });
  const transData = await transRes.json();
  const inProgress = transData.transitions?.find(t => t.id === '31' || t.name?.toLowerCase().includes('progress') || t.to?.name?.toLowerCase().includes('andamento'));
  if (inProgress) {
    await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${data.key}/transitions`, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: inProgress.id } })
    });
    console.log(`Ticket ${data.key} transicionado para Em andamento!`);
  }
}

createAndStartIssue().catch(console.error);
