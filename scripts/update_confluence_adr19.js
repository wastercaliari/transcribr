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

  const adr19Html = `
<h3>ADR-019: Admissão e Concessão de Acesso a Colaborador de Engenharia (Guilherme Trevizani) no GitHub, Jira e Confluence (SCRUM-65)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> O usuário solicitou a integração formal de <code>guilhermetrevz@outlook.com</code> como colaborador em todas as frentes de engenharia do projeto TranscriBR (GitHub, Jira e Confluence).</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li><strong>GitHub (wastercaliari/transcribr):</strong> Identificação da conta GitHub oficial associada ao email (usuário <code>gtrevizani</code>, ID 99826402) através de inspeção de commits públicos e emissão de convite formal com permissão de escrita (<code>write/push</code>) via GitHub API (Convite ID: 338414616).</li>
  <li><strong>Jira Software (Project SCRUM):</strong> Provisionamento do usuário Atlassian (accountId: <code>6338ecc59b32cfef93284801</code>), concessão de licença <code>jira-software</code> e atribuição ao papel <strong>Member</strong> (ID: 10005) no projeto SCRUM, habilitando criação, edição e movimentação de cards em sprints.</li>
  <li><strong>Confluence Cloud (Espaço TBR):</strong> Inclusão do usuário no grupo <code>confluence-users-wastercaliari</code> e atribuição de permissão RBAC direta de <strong>Colaborador</strong> (Role ID: <code>0c103ff5-44d0-4b2a-b80d-8690442c95f0</code>) no espaço TBR (ID: 196826), autorizando leitura e edição das páginas canônicas da Bíblia do Projeto.</li>
</ul>
<p><strong>Consequências:</strong> Colaborador plenamente habilitado a interagir com os repositórios de código, esteiras de CI/CD, gestão de backlog no Jira e documentação viva no Confluence sob governança e rastreabilidade total.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr19Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr19Html;
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
