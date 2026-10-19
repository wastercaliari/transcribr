const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

async function updateAdr27() {
  const pageRes = await fetch('https://wastercaliari.atlassian.net/wiki/rest/api/content/360453?expand=body.storage,version', {
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
  });
  if (!pageRes.ok) throw new Error('Fetch page failed: ' + pageRes.status);
  const data = await pageRes.json();
  let html = data.body.storage.value;
  const currentVersion = data.version.number;

  const adr27Html = `
<h3>ADR-027: Cria&ccedil;&atilde;o do Reposit&oacute;rio Central Privado agent-master-devsecops como Hub Universal de Agentes e Governan&ccedil;a Multi-LLM (SCRUM-74)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-19</p>
<p><strong>Contexto:</strong> A organiza&ccedil;&atilde;o demandava um reposit&oacute;rio privado dedicado (<code>agent-master-devsecops</code>) para atuar como &uacute;nica fonte da verdade e centro cont&iacute;nuo de atualiza&ccedil;&atilde;o da su&iacute;te de agentes de engenharia, arquitetura, DevSecOps, observabilidade e governan&ccedil;a, permitindo sua utiliza&ccedil;&atilde;o plug-and-play em qualquer outro projeto e em qualquer LLM (Claude, ChatGPT, DeepSeek, Cursor, Windsurf, Ollama).</p>
<p><strong>Decis&atilde;o:</strong></p>
<ul>
  <li><strong>Provisionamento do Reposit&oacute;rio:</strong> Cria&ccedil;&atilde;o do reposit&oacute;rio privado <code>https://github.com/wastercaliari/agent-master-devsecops</code> contendo a estrutura can&ocirc;nica segregada em <code>/agents</code> e <code>/docs</code>.</li>
  <li><strong>Composi&ccedil;&atilde;o dos 5 Agentes Especializados:</strong> Catalogados e homologados o Agente Mestre Universal (orquestrador geral), Staff Engineer &amp; DevSecOps Lead, Agente de Melhoria Cont&iacute;nua, Revisor Cr&iacute;tico Independente (revisor.md) e o nov&iacute;ssimo Agente de Observabilidade &amp; Auto-Remedia&ccedil;&atilde;o (SRE).</li>
  <li><strong>Documenta&ccedil;&atilde;o de Arquitetura Multi-Agente (<code>docs/ARCHITECTURE.md</code>):</strong> Especifica&ccedil;&atilde;o formal da topologia hier&aacute;rquico-cooperativa, matriz de gatilhos autom&aacute;ticos de handover (<code>EVENT_CODE_COMPLETE</code>, <code>EVENT_REVIEW_FAILED</code>, <code>EVENT_METRIC_ANOMALY</code>, <code>EVENT_REFACTOR_PROPOSAL</code>) e os 5 loops aut&ocirc;nomos.</li>
  <li><strong>README Mestre com Prompt Can&ocirc;nico:</strong> Manual executivo com diagrama de sequ&ecirc;ncia Mermaid, guias de conex&atilde;o (Git Submodule, Claude Projects, Custom GPTs, Cursor <code>.cursorrules</code>) e o prompt de ativa&ccedil;&atilde;o universal.</li>
  <li><strong>Esteira DevSecOps no GitHub Actions:</strong> Workflow <code>.github/workflows/ci.yml</code> com detec&ccedil;&atilde;o de segredos TruffleHog e valida&ccedil;&atilde;o estrita de integridade markdown.</li>
</ul>
<p><strong>Consequ&ecirc;ncias:</strong> Centraliza&ccedil;&atilde;o definitiva do ecossistema de agentes em reposit&oacute;rio dedicado, portabilidade universal entre projetos com zero atrito e conformidade enterprise comprovada por esteira de CI.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr27Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr27Html;
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
  console.log('ADR-027 successfully added to Confluence page 360453. New Version:', result.version?.number);
}

updateAdr27().catch(console.error);
