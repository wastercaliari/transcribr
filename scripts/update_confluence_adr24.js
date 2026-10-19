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

  const adr24Html = `
<h3>ADR-024: Parametrização Agnóstica Universal e Protocolo de Portabilidade de Agentes para Múltiplos Projetos (SCRUM-70)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> Diante da demanda de compartilhar o poder cognitivo e os rigorosos fluxos operacionais dos agentes do TranscriBR com desenvolvedores parceiros em qualquer ecossistema tecnológico (fintechs, e-commerce, mobile, APIs, microserviços), tornou-se imperativo certificar e formalizar a independência dos contratos em relação ao domínio de voz/Discord, garantindo portabilidade cross-stack 100% agnóstica.</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li><strong>Independência Arquitetural Total:</strong> Os contratos de IA foram formalizados em Markdown canônico puro, sem dependências de frameworks proprietários de orquestração (LangChain, CrewAI, AutoGen), tornando-os universalmente compatíveis com qualquer LLM (OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, DeepSeek-V3/R1, Llama 3.3, Cursor, Windsurf, Ollama).</li>
  <li><strong>Instituição da Matriz de Severidade &amp; Tolerância Zero:</strong> Formalização no agente mestre de critérios objetivos para classificação de incidentes (Crítica, Alta, Média, Baixa) com bloqueio sumário de releases diante de vazamento de segredos, falhas OWASP e vulnerabilidades a ReDoS.</li>
  <li><strong>Criação do Prompt de Inicialização Universal (Zero-Drift):</strong> Desenvolvimento de template parametrizável contendo variáveis de injeção (<code>{{NOME_DO_PROJETO}}</code>, <code>{{STACK_TECNICA}}</code>, <code>{{SISTEMA_DE_TICKETS}}</code>, <code>{{BASE_DOCUMENTACAO}}</code>) para garantir que qualquer IA externa adote instantaneamente a persona de Staff Engineer e a disciplina das 15 seções de resposta.</li>
</ul>
<p><strong>Consequências:</strong> Replicação idêntica dos padrões de engenharia de alta maturidade em qualquer novo projeto em menos de 30 segundos, com zero lock-in tecnológico e total interoperabilidade com o ecossistema Atlassian e Git.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr24Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr24Html;
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
