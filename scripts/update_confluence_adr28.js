const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

async function updateAdr28() {
  const pageRes = await fetch('https://wastercaliari.atlassian.net/wiki/rest/api/content/360453?expand=body.storage,version', {
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
  });
  if (!pageRes.ok) throw new Error('Fetch page failed: ' + pageRes.status);
  const data = await pageRes.json();
  let html = data.body.storage.value;
  const currentVersion = data.version.number;

  const adr28Html = `
<h3>ADR-028: Concess&atilde;o de Acesso de Colabora&ccedil;&atilde;o Multi-Engenharia no Reposit&oacute;rio agent-master-devsecops (SCRUM-75)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-19</p>
<p><strong>Contexto:</strong> Para viabilizar a colabora&ccedil;&atilde;o cont&iacute;nua e o compartilhamento de agentes com a equipe de engenharia, foi solicitada a inclus&atilde;o formal de colaboradores no reposit&oacute;rio GitHub privado <code>agent-master-devsecops</code>.</p>
<p><strong>Decis&atilde;o:</strong></p>
<ul>
  <li><strong>Emiss&atilde;o de Convites de Colaborador com Permiss&atilde;o de Escrita (push):</strong>
    <ul>
      <li><strong>Guilherme Trevizani (<code>gtrevizani</code>)</strong>: Convite <code>#338524705</code> despachado com permiss&atilde;o <code>write</code>.</li>
      <li><strong>Vitor Sarter (<code>sartervitor</code>)</strong>: Convite <code>#338524730</code> despachado com permiss&atilde;o <code>write</code>.</li>
      <li><strong>Hudson (<code>hudsongf123</code> / hudsongf@hotmail.com)</strong>: Convite <code>#338524838</code> despachado com permiss&atilde;o <code>write</code>.</li>
    </ul>
  </li>
  <li><strong>Rastreabilidade de Seguran&ccedil;a e Acesso:</strong> Todos os convites foram emitidos pela API REST do GitHub com permiss&otilde;es segregadas e auditoria no painel de seguran&ccedil;a.</li>
</ul>
<p><strong>Consequ&ecirc;ncias:</strong> Acesso assegurado para os tr&ecirc;s engenheiros com capacidade de clonar, contribuir e evoluir os agentes preservando a integridade e privacidade do reposit&oacute;rio.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr28Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr28Html;
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

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error('Update failed: ' + putRes.status + ' - ' + err);
  }
  const result = await putRes.json();
  console.log('ADR-028 successfully added to Confluence page 360453. New Version:', result.version?.number);
}

updateAdr28().catch(console.error);
