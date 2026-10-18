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

  const adr12Html = `
<h3>ADR-012: Gravação e Exportação de Áudio Consolidado WAV Pós-Chamada</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-18</p>
<p><strong>Contexto:</strong> O pipeline de áudio transcrevia as falas de forma volátil, descartando o buffer PCM logo após o envio ao Whisper. Reuniões corporativas de arquitetura e decisões críticas exigem possibilidade de auditoria e escuta direta para dirimir dúvidas em termos técnicos ou nomes próprios.</p>
<p><strong>Decisão:</strong></p>
<ul>
  <li>Criação do módulo autônomo <code>src/audio_recorder.js</code>, que gerencia buffers de PCM 16kHz mono com teto de 25 MB por guild para proteção de memória e conformidade com limites de anexo do Discord.</li>
  <li>Inserção de intervalos suaves de 250ms de silêncio (8.000 bytes) entre falas de participantes diferentes para audição natural.</li>
  <li>Disponibilização do comando Slash <code>/audio [minutos]</code> para download direto sob demanda e anexo automático do arquivo <code>audio-consolidado-*.wav</code> no fluxo do <code>/resumo</code>.</li>
  <li>Limpeza atômica do buffer de áudio ao acionar o comando <code>/limpar</code>.</li>
</ul>
<p><strong>Consequências:</strong> Rastreabilidade sonora completa, auditoria acessível com 1 clique e garantia de zero vazamento de memória validada por testes unitários dedicados.</p>
`;

  if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
    html = html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr12Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
  } else {
    html += adr12Html;
  }

  // Atualiza status de SCRUM-53 para Concluído na tabela do Confluence
  html = html.replace(
    '<tr><td><strong>SCRUM-53</strong></td><td>SCRUM-5 (Áudio/DAVE)</td><td>I-9: Gravação e exportação do arquivo de áudio WAV consolidado pós-chamada</td><td>High</td><td>A fazer</td></tr>',
    '<tr><td><strong>SCRUM-53</strong></td><td>SCRUM-5 (Áudio/DAVE)</td><td>I-9: Gravação e exportação do arquivo de áudio WAV consolidado pós-chamada</td><td>High</td><td><span style="color: #00875a;"><strong>Concluído</strong></span></td></tr>'
  );

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
