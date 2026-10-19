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

  const adr23Html = `
<h3>ADR-023: Reestruturação Organizacional de Diretórios: Segregação Modular de Agents e Documentação (SCRUM-69)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> Com a evolução do projeto TranscriBR, o diretório raiz acumulou múltiplos contratos de agentes de IA, regras de governança, históricos imutáveis e especificações operacionais. Visando aderência aos padrões de Clean Architecture e engenharia de software de alta maturidade, estabeleceu-se a necessidade de segregar agentes em <code>/agents</code> e documentação técnica em <code>/docs</code>, preservando a raiz enxuta e 100% dos fluxos de CI/CD e testes íntegros.</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li><strong>Segregação do Diretório <code>/agents</code>:</strong> Centralização de todas as personas (<code>AGENTE_MESTRE_UNIVERSAL.md</code>, <code>AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md</code>, <code>AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md</code>, <code>revisor.md</code>) e criação de um catálogo informativo <code>README.md</code> com guias de injeção rápida para ChatGPT, Claude Projects, Cursor e Ollama.</li>
  <li><strong>Segregação do Diretório <code>/docs</code>:</strong> Centralização das normas e playbooks (<code>RULES.md</code>, <code>RULES 16.4 SETUP.md</code>), livro-razão append-only (<code>CHANGELOG.md</code>), controle de ciclo de vida (<code>STATE.md</code>), ideias (<code>IDEAS.md</code>) e métricas (<code>CALCULATIONS.md</code>), acompanhados de <code>README.md</code> com mapeamento para as 7 páginas da Bíblia no Confluence.</li>
  <li><strong>Resiliência de Tooling e Hooks de Governança:</strong> Atualização de <code>.githooks/pre-commit</code> e <code>.claude/hooks/memory-gate.sh</code> para verificação em <code>docs/</code>, adaptação do gerador <code>scripts/export_agents_bundle.js</code> e atualização de referências em <code>AGENTS.md</code>, <code>GEMINI.md</code>, <code>CLAUDE.md</code> e <code>README.md</code> raiz.</li>
</ul>
<p><strong>Consequências:</strong> Raiz do repositório limpa e focada em entrypoints de build/execução (bot.js, package.json, Dockerfile), máxima facilidade no compartilhamento e manutenção de agentes de IA, e zero regressão na esteira de CI/CD e testes (67 testes unitários passando).</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr23Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr23Html;
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
