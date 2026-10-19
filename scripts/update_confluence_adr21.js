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

  const adr21Html = `
<h3>ADR-021: Estratégia de Empacotamento e Portabilidade Universal de Agentes para Múltiplas LLMs (SCRUM-67)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> O ecossistema TranscriBR consolidou múltiplos agentes especializados (Agente Universal DevSecOps, Agente de Melhoria Contínua, Agente Revisor e Regras 16.4). Surgiu a necessidade de garantir portabilidade total para execução em qualquer provedor de IA (OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, DeepSeek-V3/R1, Ollama local, Cursor e frameworks multi-agente) sem lock-in proprietário.</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li><strong>Arquitetura Agnóstica em Markdown Canônico:</strong> Todas as personas, restrições operacionais e loops autônomos foram projetados em formato Markdown autossuficiente, sem dependências de SDKs proprietários de agentes.</li>
  <li><strong>Script Gerador de Bundle (scripts/export_agents_bundle.js):</strong> Desenvolvimento de ferramenta que consolida todos os contratos em um único manifesto executivo (<code>dist/UNIVERSAL_AGENTS_BUNDLE.md</code>).</li>
  <li><strong>Guia de Portabilidade por Plataforma:</strong> Padronização das formas de injeção: Custom GPTs / System Prompt (OpenAI), Claude Projects (Anthropic), <code>.cursorrules</code> (Cursor/Windsurf), <code>Modelfile</code> (Ollama) e orquestração multi-agente (CrewAI / AutoGen).</li>
</ul>
<p><strong>Consequências:</strong> Independência total de fornecedor de IA, imunidade a obsolescência de modelos e capacidade de rodar a inteligência do TranscriBR localmente ou na nuvem com rigor técnico idêntico.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr21Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr21Html;
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
