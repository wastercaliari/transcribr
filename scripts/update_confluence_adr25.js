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

  const adr25Html = `
<h3>ADR-025: Empacotamento Modular Enterprise (ZIP) e Protocolo Canônico de Orquestração Multi-Agente (SCRUM-72)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> Para a Opção B (Compartilhamento Modular Enterprise), desenvolvedores e parceiros demandam uma forma imediata de obter todos os arquivos das pastas <code>/agents</code> e <code>/docs</code> em um único download confiável, associado a um prompt formal de orquestração que cite explicitamente cada arquivo individual e instale as personas com estrita observância das severidades, loops autônomos e 15 seções de resposta.</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li><strong>Automação de Empacotamento ZIP:</strong> Criação de <code>scripts/create_enterprise_agents_pack.js</code>, gerando o artefato <code>dist/TRANSCRIBR_ENTERPRISE_AGENTS_PACK.zip</code> contendo a integridade dos 13 arquivos de agentes e documentos com validação SHA256.</li>
  <li><strong>Criação de PROMPT_INSTALACAO_ENTERPRISE.md:</strong> Documento mestre de instalação contendo catalogação exaustiva de cada arquivo <code>.md</code> das duas pastas, mapeamento de modos operacionais (<code>modo: devsecops</code>, <code>modo: revisor</code>, <code>modo: melhoria</code>, <code>modo: observabilidade</code>), matriz de severidade e protocolo de 15 seções.</li>
  <li><strong>Integração com Editores e LLMs de Mercado:</strong> Guias padronizados para injeção em Cursor IDE (<code>.cursorrules</code>), Anthropic Claude Projects, OpenAI Custom GPTs e Ollama local.</li>
</ul>
<p><strong>Consequências:</strong> Distribuição enterprise em 1 clique (~54 KB) com zero dependência de infraestrutura externa e 100% de reproducibilidade do comportamento de Staff Engineer.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr25Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr25Html;
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
