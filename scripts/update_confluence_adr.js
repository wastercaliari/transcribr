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

  const adr11Html = `
<h3>ADR-011: Rastreabilidade Nativa e Branches Dedicadas por Ticket (GitHub-Jira)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> A governança do projeto exige rastreabilidade completa entre o código-fonte e o gerenciador de tarefas Atlassian Jira. Com a homologação do aplicativo oficial GitHub for Atlassian, o ecossistema agora suporta indexação automática de branches, commits e pull requests diretamente no painel de Desenvolvimento de cada item do Jira.</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li>Todas as 48 entregas históricas do projeto (SCRUM-5 a SCRUM-52) receberam branches dedicadas no padrão <code>&lt;tipo&gt;/&lt;TICKET-KEY&gt;-&lt;descricao&gt;</code> e foram sincronizadas no repositório remoto GitHub.</li>
  <li>Todos os cards do Jira foram enriquecidos com Remote Links interativos apontando diretamente para as branches e commits no GitHub.</li>
  <li>O fluxo contínuo passa a exigir que qualquer nova funcionalidade seja iniciada em sua respectiva branch isolada, transicionando o card imediatamente para "Em andamento".</li>
</ul>
<p><strong>Consequências:</strong> Visibilidade granular por funcionalidade, auditoria instantânea de diffs por card, eliminação de ambiguidades de desenvolvimento e atendimento pleno ao Tríplice Registro Contínuo.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr11Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr11Html;
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
  console.log('New version:', result.version?.number);
}

updateAdr().catch(console.error);
