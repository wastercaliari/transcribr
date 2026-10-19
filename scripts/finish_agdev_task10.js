const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

async function finishTask10() {
  const transRes = await fetch('https://wastercaliari.atlassian.net/rest/api/3/issue/AGDEV-10/transitions', {
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
  });
  const transData = await transRes.json();
  const doneTrans = transData.transitions?.find(t => t.id === '41' || t.name?.toLowerCase().includes('conclu') || t.to?.name?.toLowerCase().includes('conclu') || t.to?.name?.toLowerCase().includes('done'));
  
  if (doneTrans) {
    await fetch('https://wastercaliari.atlassian.net/rest/api/3/issue/AGDEV-10/transitions', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transition: { id: doneTrans.id }
      })
    });
    console.log('AGDEV-10 transicionado para Concluído!');
  }

  const commentText = `h3. Auto-Evolução Reflexiva Homologada com Sucesso (AGDEV-10)

h4. 1. Entregas Técnicas Realizadas:
* *revisor.md Reflexivo*: Equipado com a Dimensão B de Auto-Auditoria para inspecionar os próprios arquivos em /agents e /docs contra ambiguidades, desperdício de tokens e alucinações.
* *docs/IDEAS.md Reflexivo*: Backlog enriquecido com a Categoria A de Auto-Evolução do Agent (MCP nativo, harness de auto-avaliação, compactador de contexto).
* *docs/ARCHITECTURE.md*: Topologia atualizada com o 6º Loop Autônomo (Loop de Auto-Evolução Reflexiva) e o gatilho EVENT_AGENT_SELF_IMPROVE.
* *AGENTE_MESTRE_UNIVERSAL.md (v3.1)* e *README.md*: Prompt canônico atualizado com obrigatoriedade de auto-otimização a cada entrega.
* *Esteira CI/CD*: Workflow GitHub Actions aprovado com 100% dos checks verdes no commit 626507b.
* *Confluence AGDEV*: ADR-002 registrado na Página 1048584 (v2).`;

  await fetch('https://wastercaliari.atlassian.net/rest/api/3/issue/AGDEV-10/comment', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: commentText }]
        }]
      }
    })
  });
  console.log('Comentário técnico adicionado ao AGDEV-10.');
}

finishTask10().catch(console.error);
