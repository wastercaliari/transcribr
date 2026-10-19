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

  const adr22Html = `
<h3>ADR-022: Consolidação do AGENTE_MESTRE_UNIVERSAL.md como Arquivo Único Plug-and-Play para Compartilhamento (SCRUM-68)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> Para viabilizar o compartilhamento simples, amigável e sem fricção com outros desenvolvedores e amigos, identificou-se que enviar múltiplos arquivos de governança gerava atrito de configuração. O ideal de mercado é a distribuição de um único arquivo <code>.md</code> autossuficiente.</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li><strong>Criação do AGENTE_MESTRE_UNIVERSAL.md:</strong> Documento mestre na raiz do projeto contendo um preâmbulo auto-instrucional de ativação imediata para qualquer LLM.</li>
  <li><strong>Sistema Multi-Modos em 1 Prompt:</strong> Inclusão dos 4 modos de operação acionáveis por simples comandos no chat (<code>modo: devsecops</code>, <code>modo: revisor</code>, <code>modo: melhoria</code>, <code>modo: observabilidade</code>).</li>
  <li><strong>Fusão das 13 Regras de Governança &amp; Protocolo de 15 Seções:</strong> Garantia de que qualquer amigo que arraste o arquivo para o ChatGPT, Claude ou Cursor terá exatamente o mesmo comportamento e rigor de engenharia de nível enterprise.</li>
</ul>
<p><strong>Consequências:</strong> Experiência de compartilhamento "zero-setup" (apenas enviar 1 arquivo <code>.md</code> pelo WhatsApp, Discord ou GitHub) sem perda de funcionalidades ou poder analítico.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr22Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr22Html;
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
