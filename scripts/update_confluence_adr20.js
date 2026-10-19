const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

async function updateAdr() {
  const pageRes = await fetch('https://wastercaliari.atlassian.net/wiki/rest/api/content/360453?expand=body.storage,version', {
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
  });
  const data = await pageRes.json();
  let html = data.body.storage.value;
  const currentVersion = data.version.number;

  const adr20Html = `
<h3>ADR-020: Elevação de Privilégios de Guilherme Trevizani para Administrador/Dono no Jira e Confluence (SCRUM-66)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> A liderança técnica determinou que o colaborador Guilherme Iglesias Trevizani (<code>guilhermetrevz@outlook.com</code>) atue como co-proprietário e administrador pleno da infraestrutura de governança e documentação técnica no Atlassian Cloud.</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li><strong>Jira Software (Projeto SCRUM):</strong> Atribuição do papel <strong>Administrator</strong> (ID: 10004) no projeto SCRUM e inclusão no grupo global <code>jira-admins-wastercaliari</code>. Guilherme passa a ter plenos poderes para configurar esquemas de permissão, campos personalizados, fluxos de trabalho (workflows), gerenciar componentes, versões e sprints.</li>
  <li><strong>Confluence Cloud (Espaço TBR):</strong> Concessão da Space Role <strong>Administrador</strong> (ID: <code>6820786b-b8db-4102-b789-dcb45cba7c83</code>) no espaço canônico TBR (ID: 196826) e inclusão no grupo global <code>confluence-admins-wastercaliari</code>. Guilherme obtém autoridade máxima para gerenciar configurações do espaço, permissões RBAC de terceiros, templates, integrações e exclusão/arquivamento de páginas.</li>
</ul>
<p><strong>Consequências:</strong> Paridade administrativa e técnica estabelecida entre os dois responsáveis pelo projeto, permitindo decisões arquiteturais e operacionais imediatas sem gargalos de aprovação.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr20Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr20Html;
  }

  const putRes = await fetch('https://wastercaliari.atlassian.net/wiki/rest/api/content/360453', {
    method: 'PUT',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: '360453',
      type: 'page',
      title: data.title,
      version: { number: currentVersion + 1 },
      body: { storage: { value: html, representation: 'storage' } }
    })
  });

  console.log('Update ADR page status:', putRes.status);
  const result = await putRes.json();
  console.log('New ADR version:', result.version?.number);
}

updateAdr().catch(console.error);
