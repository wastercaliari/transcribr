const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

async function updateAdr003() {
  const pageRes = await fetch('https://wastercaliari.atlassian.net/wiki/rest/api/content/1048584?expand=body.storage,version', {
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
  });
  if (!pageRes.ok) throw new Error('Fetch page failed: ' + pageRes.status);
  const data = await pageRes.json();
  let html = data.body.storage.value;
  const currentVersion = data.version.number;

  const adr003Html = `
<h3>ADR-003: Transfer&ecirc;ncia da Hospedagem Oficial do Reposit&oacute;rio para a Organiza&ccedil;&atilde;o ContalApps (AGDEV-11)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-19</p>
<p><strong>Contexto:</strong> Para consolidar a governan&ccedil;a institucional e unificar o controle de acesso de toda a equipe de engenharia sob um mesmo dom&iacute;nio corporativo no GitHub, foi solicitada a migra&ccedil;&atilde;o do reposit&oacute;rio da conta pessoal para a organiza&ccedil;&atilde;o oficial <code>ContalApps</code>.</p>
<p><strong>Decis&atilde;o:</strong></p>
<ul>
  <li><strong>Transfer&ecirc;ncia de Propriedade:</strong> Executada a transfer&ecirc;ncia segura de <code>wastercaliari/agent-master-devsecops</code> para <code>ContalApps/agent-master-devsecops</code> via API REST do GitHub (<code>POST /repos/:owner/:repo/transfer</code>).</li>
  <li><strong>Acesso Unificado da Equipe:</strong> Todos os 4 engenheiros membros da organiza&ccedil;&atilde;o (Guilherme Trevizani, Vitor Sarter, Hudson e Waster Caliari) herdam permiss&otilde;es imediatas de colabora&ccedil;&atilde;o institucional.</li>
  <li><strong>Preserva&ccedil;&atilde;o de Hist&oacute;rico e Redirecionamento:</strong> Hist&oacute;rico de commits, branches, issues, esteiras de CI e URLs de clone preservados com redirecionamento autom&aacute;tico transparente.</li>
  <li><strong>Atualiza&ccedil;&atilde;o de Remotes:</strong> Reposit&oacute;rios locais sincronizados para <code>https://github.com/ContalApps/agent-master-devsecops.git</code>.</li>
</ul>
<p><strong>Consequ&ecirc;ncias:</strong> O Agent Master DevSecOps passa a ser um ativo tecnol&oacute;gico institucional da ContalApps, sob gest&atilde;o de organiza&ccedil;&atilde;o e governan&ccedil;a enterprise.</p>
`;

  html += adr003Html;

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

  if (!putRes.ok) throw new Error('Update failed: ' + putRes.status);
  const resData = await putRes.json();
  console.log('ADR-003 registrado com sucesso na Bíblia AGDEV. Nova Versão:', resData.version?.number);
}

updateAdr003().catch(console.error);
