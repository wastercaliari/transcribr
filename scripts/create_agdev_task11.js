const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

async function createAndFinishAgdev11() {
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
        summary: 'Transferência e Hospedagem Oficial do Repositório na Organização ContalApps',
        parent: { key: 'AGDEV-1' },
        description: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Transferência da propriedade do repositório agent-master-devsecops da conta pessoal wastercaliari para a organização oficial ContalApps (https://github.com/ContalApps/agent-master-devsecops), garantindo acesso institucional a todos os engenheiros membros da organização.'
            }]
          }]
        }
      }
    })
  });
  const data = await createRes.json();
  console.log('Ticket criado no AGDEV:', data.key);

  await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${data.key}/transitions`, {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: { id: '41' } }) // Concluído
  });
  console.log(`Ticket ${data.key} transicionado para Concluído!`);

  const commentText = `h3. Transferência para Organização ContalApps Homologada com Sucesso (AGDEV-11)

h4. 1. Entregas Técnicas Realizadas:
* *Transferência de Propriedade*: Repositório transferido com sucesso para https://github.com/ContalApps/agent-master-devsecops
* *Acesso Institucional*: Todos os membros da organização ContalApps (Guilherme Trevizani, Vitor Sarter, Hudson e Waster Caliari) possuem acesso de colaborador institucional imediato.
* *Preservação de Histórico*: 100% dos commits, tags, branches e esteiras de CI preservados.
* *Remote Atualizado*: Origem remota local atualizada para git@github.com:ContalApps/agent-master-devsecops.git
* *Bíblia Confluence AGDEV*: ADR-003 registrado na Página 1048584 (v3).`;

  await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${data.key}/comment`, {
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
  console.log('Comentário técnico registrado em AGDEV-11.');
}

createAndFinishAgdev11().catch(console.error);
