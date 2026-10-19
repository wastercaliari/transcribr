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

  const adr17Html = `
<h3>ADR-017: Institucionalização do Agente Universal de Engenharia, DevSecOps e Governança de Software (SCRUM-63)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> Para garantir sustentabilidade arquitetural, segurança contínua (DevSecOps), conformidade ágil e excelência operacional de nível enterprise, identificou-se a necessidade de codificar um agente universal com competências unificadas de Staff Engineer, Arquiteto de Soluções, Engenheiro de Segurança, Arquiteto DevOps, Agile Coach e Technical Product Owner, com portabilidade total para execução em qualquer modelo fundacional (LLM).</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li><strong>Criação do AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md:</strong> Especificação canônica contendo o contrato universal de engenharia, 10 princípios orientadores (Security First, Automation First, Shift-Left, Root Cause Analysis), 5 loops autônomos (Segurança, Qualidade, Arquitetura, DevOps, Produtividade) e o framework de resposta estruturada em 15 seções obrigatórias.</li>
  <li><strong>Reforço na Governança Contínua (RULES.md, AGENTS.md, GEMINI.md):</strong> Vinculação do Agente Universal aos preâmbulos normativos do projeto, assegurando execução sem desvios, rastreabilidade tríplice (Git, Jira, Confluence) e vigilância ativa sobre scanners de vulnerabilidade.</li>
  <li><strong>Homologação do Modelo de Ameaças &amp; Métricas DORA:</strong> Incorporação formal das diretrizes OWASP Top 10, proteção contra ReDoS/Injeções e rastreamento de métricas ágeis (Lead Time, MTTR, Change Failure Rate, Cobertura de Testes).</li>
</ul>
<p><strong>Consequências:</strong> Unificação das práticas de engenharia de software e DevSecOps no ecossistema TranscriBR, garantindo entregas consistentes, seguras, auditáveis e com rastreabilidade total de ponta a ponta.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr17Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr17Html;
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
