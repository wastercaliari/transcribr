const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

async function updateAdr002() {
  const pageRes = await fetch('https://wastercaliari.atlassian.net/wiki/rest/api/content/1048584?expand=body.storage,version', {
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
  });
  if (!pageRes.ok) throw new Error('Fetch page 1048584 failed: ' + pageRes.status);
  const data = await pageRes.json();
  let html = data.body.storage.value;
  const currentVersion = data.version.number;

  const adr002Html = `
<h3>ADR-002: Implementa&ccedil;&atilde;o da Auto-Evolu&ccedil;&atilde;o Reflexiva e Revisor Advers&aacute;rio Recursivo (AGDEV-10)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-19</p>
<p><strong>Contexto:</strong> Para posicionar o <code>agent-master-devsecops</code> como o melhor agente DevSecOps universal do mundo, a intelig&ecirc;ncia n&atilde;o pode ser est&aacute;tica nem restrita a auditar c&oacute;digo de terceiros. Os agentes devem possuir capacidade reflexiva de avaliar, criticar e auto-aprimorar suas pr&oacute;prias diretrizes, personas, prompts e or&ccedil;amentos de contexto.</p>
<p><strong>Decis&atilde;o:</strong></p>
<ul>
  <li><strong>Extens&atilde;o do Revisor Cr&iacute;tico (<code>revisor.md</code>):</strong> Equipado com a Dimens&atilde;o B de Auto-Auditoria Reflexiva para ca&ccedil;ar ambiguidades em prompts, desperd&iacute;cio de tokens, alucina&ccedil;&otilde;es e riscos de quebra de interoperabilidade multi-LLM.</li>
  <li><strong>Ideador Recursivo em <code>AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md</code>:</strong> Capacidade de propor melhorias para a aplica&ccedil;&atilde;o e para o pr&oacute;prio Agent, alimentando o backlog <code>docs/IDEAS.md</code> sob a categoria reflexiva (<code>REFLEXIVE-AGENT-EVOLUTION</code>).</li>
  <li><strong>O 6º Loop Aut&ocirc;nomo em <code>docs/ARCHITECTURE.md</code>:</strong> Institucionalizado o <em>Loop de Auto-Evolu&ccedil;&atilde;o Reflexiva</em> e o gatilho <code>EVENT_AGENT_SELF_IMPROVE</code>.</li>
  <li><strong>Evolu&ccedil;&atilde;o do Agent Master (v3.1):</strong> Prompt can&ocirc;nico atualizado com obrigatoriedade de auto-avalia&ccedil;&atilde;o a cada entrega e preserva&ccedil;&atilde;o das 13 Regras.</li>
</ul>
<p><strong>Consequ&ecirc;ncias:</strong> O Agent Master torna-se auto-adaptativo, mantendo sua pr&oacute;pria excel&ecirc;ncia de ponta, auditabilidade c&eacute;tica e evolu&ccedil;&atilde;o cont&iacute;nua em qualquer projeto e em qualquer LLM.</p>
`;

  html += adr002Html;

  const putRes = await fetch('https://wastercaliari.atlassian.net/wiki/rest/api/content/1048584', {
    method: 'PUT',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: '1048584',
      type: 'page',
      title: data.title,
      version: { number: currentVersion + 1 },
      body: { storage: { value: html, representation: 'storage' } }
    })
  });

  if (!putRes.ok) throw new Error('Update failed: ' + putRes.status + ' ' + (await putRes.text()));
  const resData = await putRes.json();
  console.log('ADR-002 registrado com sucesso na Bíblia AGDEV (Página 1048584). Nova Versão:', resData.version?.number);
}

updateAdr002().catch(console.error);
