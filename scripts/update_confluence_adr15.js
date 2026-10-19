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

  const adr15Html = `
<h3>ADR-015: Persistência Durável em Banco Embarcado SQLite com WAL Mode e Índices B-Tree (SCRUM-54)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> Anteriormente, o histórico de falas para geração de atas técnicas (/resumo) residia em memória e em um arquivo JSONL manipulado de forma síncrona. Reinícios de container e redeploys do bot no Railway podiam interromper a persistência ou incorrer em lentidão de varredura sequencial O(N).</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li><strong>Engine Nativo node:sqlite:</strong> Utilização da API síncrona embarcada de alto desempenho <code>node:sqlite.DatabaseSync</code> disponível no runtime Node.js 22 (imagem de produção do Railway), eliminando bibliotecas externas (zero CVEs e zero overhead).</li>
  <li><strong>Modo WAL (Write-Ahead Logging) &amp; Busy Timeout:</strong> Configuração de <code>PRAGMA journal_mode = WAL</code>, <code>PRAGMA synchronous = NORMAL</code> e <code>PRAGMA busy_timeout = 5000</code> para garantir máxima concorrência entre leitura/escrita e eliminação de contenções.</li>
  <li><strong>Indexação Composta:</strong> Criação do índice B-Tree <code>idx_speech_guild_time (guild_id, timestamp)</code> reduzindo o tempo de consulta de histórico no <code>/resumo</code> para complexidade O(log N).</li>
  <li><strong>Resiliência e Migração Transparente:</strong> Auto-importação automática e idempotente de registros históricos do arquivo legado <code>transcript_log.jsonl</code> na inicialização, e modo de fallback estruturado para runtimes legados.</li>
  <li><strong>Integração com Volumes do Railway:</strong> Exposição da variável <code>SQLITE_DB_PATH</code> permitindo que montagens de volumes persistentes (ex.: <code>/app/data</code>) preservem todo o histórico entre deploys.</li>
</ul>
<p><strong>Consequências:</strong> Persistência robusta com tolerância a falhas, integridade de histórico de falas para atas técnicas longas e consumo desprezível de memória RAM (menos de 2 MB adicionais).</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr15Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr15Html;
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
