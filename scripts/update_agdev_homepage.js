const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

const homeHtml = `
<h2>🏛️ Bem-vindo à Bíblia do Agent DevSecOps Universal</h2>
<p>Este espaço é a <strong>única fonte da verdade corporativa</strong> para o desenvolvimento, arquitetura, segurança, auditoria e interoperabilidade da suíte de agentes autônomos <strong>agent-master-devsecops</strong>.</p>
<p>Projetado para operar com autonomia e rigor em qualquer stack de tecnologia, repositório de software e provedor de Large Language Model (LLM).</p>
<hr/>
<h3>📑 Páginas Canônicas da Bíblia:</h3>
<ul>
  <li><a href="/wiki/spaces/AGDEV/pages/1146881">01. Visão Geral, Identidade &amp; Contrato Canônico</a></li>
  <li><a href="/wiki/spaces/AGDEV/pages/1179649">02. Topologia Multi-Agente, Handovers &amp; Barramento de Eventos</a></li>
  <li><a href="/wiki/spaces/AGDEV/pages/1212417">03. As 13 Regras Fundamentais de Engenharia (RULES.md)</a></li>
  <li><a href="/wiki/spaces/AGDEV/pages/1245185">04. SRE, Observabilidade Ativa &amp; Playbooks de Auto-Cura</a></li>
  <li><a href="/wiki/spaces/AGDEV/pages/1277953">05. Guia de Interoperabilidade Multi-LLM &amp; Prompt Universal</a></li>
  <li><a href="/wiki/spaces/AGDEV/pages/1048584">06. Decisões de Arquitetura de Agentes (ADRs)</a></li>
</ul>
<hr/>
<h3>🔗 Links Rápidos do Ecossistema:</h3>
<ul>
  <li><strong>Repositório GitHub:</strong> <a href="https://github.com/wastercaliari/agent-master-devsecops">wastercaliari/agent-master-devsecops</a></li>
  <li><strong>Quadro Kanban Jira:</strong> <a href="https://wastercaliari.atlassian.net/jira/software/projects/AGDEV/boards/3">AGDEV Board (Jira Software)</a></li>
</ul>
`;

async function updateHome() {
  const res = await fetch('https://wastercaliari.atlassian.net/wiki/rest/api/content/1114291?expand=version', {
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
  });
  const d = await res.json();
  const v = d.version?.number;
  const putRes = await fetch('https://wastercaliari.atlassian.net/wiki/rest/api/content/1114291', {
    method: 'PUT',
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: '1114291',
      type: 'page',
      title: 'Agent DevSecOps - A Bíblia do Agente Universal',
      version: { number: v + 1 },
      body: { storage: { value: homeHtml, representation: 'storage' } }
    })
  });
  console.log('Homepage AGDEV atualizada com sucesso. Status:', putRes.status);
}

updateHome().catch(console.error);
