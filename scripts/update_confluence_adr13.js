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

  const adr13Html = `
<h3>ADR-013: Esteira Contínua de CI/CD (GitHub Actions) e Governança de Pull Requests Obrigatórios</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> A governança anterior realizava merges diretos via CLI na branch principal, o que contornava gatilhos de Pull Request (<code>on: pull_request</code>) e deixava o painel nativo de Pull Requests do Jira vazio. Para estabelecer maturidade corporativa e esteira automatizada de testes, foi instituído o fluxo obrigatório de PRs com validação contínua.</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li>Criação da esteira oficial do GitHub Actions em <code>.github/workflows/ci.yml</code>, executando matriz de testes com Node.js 20.x e 22.x, verificação estática de sintaxe e suíte de 41 testes unitários.</li>
  <li>Alteração das diretrizes de governança (<code>AGENTS.md</code>, <code>GEMINI.md</code> e <code>RULES.md</code>): nenhuma alteração deve ser mergeada diretamente em <code>main</code>. Toda entrega requer criação de branch dedicada, push remoto, abertura formal de Pull Request via <code>gh pr create</code> com chave do Jira no título/descrição e merge via <code>gh pr merge</code> somente após aprovação da esteira.</li>
  <li>Integração nativa com Jira Software: exibição do status de Pull Requests (OPEN / MERGED) e checks de CI diretamente nos cards de trabalho.</li>
</ul>
<p><strong>Consequências:</strong> Quality Gate rigoroso contra quebra de build em produção, rastreabilidade completa em nível de Pull Request e conformidade com os mais altos padrões de engenharia de software.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr13Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr13Html;
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
