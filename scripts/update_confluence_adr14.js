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

  const adr14Html = `
<h3>ADR-014: Esteira Enterprise DevSecOps (CodeQL, TruffleHog e npm audit)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> A governança e a segurança da informação do TranscriBR exigem proteção rigorosa de credenciais corporativas (tokens Discord, Groq, Atlassian e Railway), análise estática semântica de vulnerabilidades de código (SAST) e controle contínuo de CVEs em dependências de terceiros (SCA).</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li>Implementação da esteira DevSecOps integrada no GitHub Actions (<code>.github/workflows/ci.yml</code>) com 5 jobs paralelos em cada Pull Request e push para <code>main</code>.</li>
  <li><strong>SAST Semântico com GitHub CodeQL:</strong> Varredura profunda do AST em JavaScript/TypeScript para detecção de injeções e falhas de segurança.</li>
  <li><strong>Detecção de Segredos com TruffleHog:</strong> Bloqueio preventivo de commits ou PRs que contenham chaves privadas ou tokens verificados.</li>
  <li><strong>Análise de Composição de Software (SCA) com npm audit:</strong> Bloqueio de pacotes com vulnerabilidades conhecidas em nível High ou Critical.</li>
  <li><strong>Varredura Periódica Agendada:</strong> Cron job semanal executando toda segunda-feira às 04:00 UTC para auditoria contínua de novas CVEs descobertas.</li>
</ul>
<p><strong>Consequências:</strong> Postura de segurança defensiva em profundidade (Shift-Left Security), proteção total contra vazamento de chaves e conformidade com os mais altos padrões de engenharia de software.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr14Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr14Html;
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
