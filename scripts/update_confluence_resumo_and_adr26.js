const fs = require('fs');
const path = require('path');

const token = fs.readFileSync(path.resolve(__dirname, '..', 'Atlassian Account.txt'), 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/)[0];
const auth = Buffer.from('wasterlucas@gmail.com:' + token).toString('base64');

async function updatePage(pageId, transformFn) {
  const getRes = await fetch(`https://wastercaliari.atlassian.net/wiki/rest/api/content/${pageId}?expand=body.storage,version`, {
    headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
  });
  if (!getRes.ok) {
    throw new Error(`Failed to fetch page ${pageId}: ${getRes.status} ${getRes.statusText}`);
  }
  const data = await getRes.json();
  const currentVersion = data.version.number;
  const currentHtml = data.body.storage.value;
  const newHtml = transformFn(currentHtml);

  const putRes = await fetch(`https://wastercaliari.atlassian.net/wiki/rest/api/content/${pageId}`, {
    method: 'PUT',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: pageId,
      type: 'page',
      title: data.title,
      version: { number: currentVersion + 1 },
      body: { storage: { value: newHtml, representation: 'storage' } }
    })
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`Failed to update page ${pageId}: ${putRes.status} - ${errText}`);
  }

  const result = await putRes.json();
  console.log(`Page ${pageId} (${data.title}) updated successfully to version ${result.version?.number}`);
}

async function main() {
  // 1. Update ADRs Page (360453)
  await updatePage('360453', (html) => {
    const adr26Html = `
<h3>ADR-026: Otimiza&ccedil;&atilde;o Estrutural do Motor de Atas (/resumo), Preserva&ccedil;&atilde;o de Contexto Temporal e Calibragem de Fidelidade do STT (SCRUM-73)</h3>
<p><strong>Status:</strong> <span style="color: #00875a;"><strong>APROVADO E HOMOLOGADO</strong></span> | <strong>Data:</strong> 2026-10-19</p>
<p><strong>Contexto:</strong> Usu&aacute;rios relataram degrada&ccedil;&atilde;o cr&iacute;tica no comando <code>/resumo</code>: atas excessivamente vazias, perda de contexto temporal (como se o modelo ignorasse o per&iacute;odo solicitado), omiss&atilde;o da primeira metade de reuni&otilde;es longas e troca frequente de palavras no STT Whisper.</p>
<p><strong>Causas-Raiz Diagnosticadas:</strong></p>
<ul>
  <li><strong>Truncamento Invertido do Hist&oacute;rico:</strong> O c&oacute;digo iterava as falas em ordem reversa at&eacute; 18.000 caracteres, descartando silenciosamente at&eacute; 80% do in&iacute;cio de chamadas longas.</li>
  <li><strong>Prompt Meta-Instrucional no Whisper:</strong> O par&acirc;metro <code>prompt</code> da API Groq Whisper era alimentado com instru&ccedil;&otilde;es descritivas em linguagem natural ("Transcria&ccedil;&atilde;o em portugu&ecirc;s..."), que eram interpretadas pelo decoder como contexto fon&eacute;tico pr&eacute;vio, provocando alucina&ccedil;&atilde;o de tokens e substitui&ccedil;&atilde;o de palavras faladas.</li>
  <li><strong>Threshold Agressivo de Rejei&ccedil;&atilde;o (avg_logprob &lt; -1.0):</strong> Portugu&ecirc;s coloquial e conversas espont&acirc;neas no Discord comumente atingem logprobs entre -1.1 e -1.3, fazendo com que o filtro descartasse arbitrariamente senten&ccedil;as inteiras leg&iacute;timas.</li>
  <li><strong>Or&ccedil;amento Reduzido e Prompt Restritivo:</strong> Limite de 1.500 tokens de sa&iacute;da e instru&ccedil;&otilde;es do tipo "resumo em 2 a 3 linhas" for&ccedil;avam o LLM a podar detalhes cruciais de neg&oacute;cio, planejamento e discuss&otilde;es n&atilde;o puramente t&eacute;cnicas.</li>
</ul>
<p><strong>Decis&otilde;es de Engenharia Implementadas:</strong></p>
<ul>
  <li><strong>Amostragem Cronol&oacute;gica Uniforme (<code>sampleTranscriptLines</code>):</strong> Quando o hist&oacute;rico ultrapassa o or&ccedil;amento de caracteres, o sistema preserva obrigatoriamente a abertura (10 primeiras linhas), o encerramento (10 &uacute;ltimas linhas) e realiza uma amostragem equidistante das falas intermedi&aacute;rias, inserindo marcadores expl&iacute;citos de condensa&ccedil;&atilde;o sem perder a no&ccedil;&atilde;o de tempo.</li>
  <li><strong>Enriquecimento Temporal no Prompt (<code>buildSummaryPrompt</code>):</strong> Inje&ccedil;&atilde;o de metadados exatos no cabe&ccedil;alho do prompt (janela solicitada, primeiro e &uacute;ltimo timestamp gravado, participantes) e inclus&atilde;o obrigat&oacute;ria da se&ccedil;&atilde;o can&ocirc;nica <em>"⏱️ Linha do Tempo / Cronologia dos Assuntos"</em> com hor&aacute;rios aproximados.</li>
  <li><strong>Limpeza do <code>stylePrompt</code> do Whisper:</strong> Removidas meta-instru&ccedil;&otilde;es; o prompt do Whisper agora &eacute; exclusivamente composto por uma lista limpa de termos t&eacute;cnicos e nomes pr&oacute;prios separados por v&iacute;rgula (limitado a 850 caracteres), eliminando a interfer&ecirc;ncia sint&aacute;tica do decoder.</li>
  <li><strong>Calibragem de Confian&ccedil;a (<code>parseWhisper</code>):</strong> Ajustado o crit&eacute;rio de descarte para <code>(no_speech_prob &gt; 0.7 &amp;&amp; avg_logprob &lt; -1.0) || avg_logprob &lt; -1.5 || compression_ratio &gt; 2.4</code>. Falas naturais com logprob moderado s&atilde;o preservadas integralmente.</li>
  <li><strong>Expans&atilde;o de Capacidade de Gera&ccedil;&atilde;o:</strong> Or&ccedil;amento <code>max_tokens</code> ampliado para 3.500 e timeout de chamada de 45 segundos nos modelos prim&aacute;rios (<code>openai/gpt-oss-120b</code>, <code>qwen/qwen3.8-27b</code>).</li>
</ul>
<p><strong>Consequ&ecirc;ncias:</strong> Atas t&eacute;cnicas ricas, cronologicamente precisas, sem exclus&atilde;o do in&iacute;cio das reuni&otilde;es e com fidelidade fon&eacute;tica drasticamente aumentada no STT.</p>
`;
    if (html.includes('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>')) {
      return html.replace('<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>', adr26Html + '<h3>Ideias &amp; Sugest&otilde;es Registradas no Backlog</h3>');
    }
    return html + adr26Html;
  });

  // 2. Update Resumo Page (327687)
  await updatePage('327687', (html) => {
    let updated = html;
    // Update section 3 canonical structure to 5 sections
    const oldSec3 = `<ol>
  <li><strong>📌 Vis&atilde;o Geral e Contexto:</strong> S&iacute;ntese de 2 a 3 linhas com o tema central e objetivo da call.</li>
  <li><strong>🛠️ Arquitetura, Tecnologias e Ferramentas:</strong> Tecnologias, APIs, ferramentas, argumentos e propostas levantadas por cada participante.</li>
  <li><strong>⚠️ Problemas, Impedimentos ou Gargalos:</strong> Bugs relatados, limita&ccedil;&otilde;es de arquitetura e pontos de aten&ccedil;&atilde;o.</li>
  <li><strong>✅ Decis&otilde;es T&eacute;cnicas e Pr&oacute;ximos Passos:</strong> Tarefas definidas, responsabilidades atribu&iacute;das e direcionamento acordado.</li>
</ol>`;

    const newSec3 = `<ol>
  <li><strong>📌 Vis&atilde;o Geral e Contexto:</strong> S&iacute;ntese anal&iacute;tica com o prop&oacute;sito principal da chamada, contexto e participantes.</li>
  <li><strong>⏱️ Linha do Tempo / Cronologia dos Assuntos:</strong> Linha do tempo sequencial relacionando os hor&aacute;rios (timestamps) com a evolu&ccedil;&atilde;o dos t&oacute;picos discutidos (in&iacute;cio, meio e fim).</li>
  <li><strong>🛠️ Arquitetura, Tecnologias e T&oacute;picos Discutidos:</strong> Detalhamento t&eacute;cnico dos assuntos, arquiteturas, ferramentas, ideias ou argumentos debatidos por cada pessoa.</li>
  <li><strong>⚠️ Problemas, Riscos ou Gargalos:</strong> Dificuldades relatadas, falhas, impedimentos ou pontos de aten&ccedil;&atilde;o levantados durante a sess&atilde;o.</li>
  <li><strong>✅ Decis&otilde;es, Acordos e Pr&oacute;ximos Passos:</strong> Delibera&ccedil;&otilde;es tomadas, planos definidos, responsabilidades atribu&iacute;das e pr&oacute;ximas a&ccedil;&otilde;es.</li>
</ol>`;

    if (updated.includes(oldSec3)) {
      updated = updated.replace(oldSec3, newSec3);
    }

    // Update section 6
    const oldSec6 = `<h2>6. Janela Segura de Amostragem (Max Chars 18.000)</h2>
<p>O plano gratuito da Groq possui um limite estrito de taxa de 8.000 Tokens Por Minuto (TPM). Para evitar que reuni&otilde;es de 4 ou 8 horas provoquem erros <code>HTTP 429 (Rate Limit)</code>, o algoritmo calcula o volume de caracteres do hist&oacute;rico:</p>
<p>Se o texto exceder 18.000 caracteres (~3.500 a 4.000 tokens), o sistema preserva integralmente as falas mais recentes da chamada e anexa um aviso informativo ao relat&oacute;rio final.</p>`;

    const newSec6 = `<h2>6. Amostragem Cronol&oacute;gica Uniforme e Ancoragem Temporal (SCRUM-73)</h2>
<p>Para reuni&otilde;es longas que ultrapassam a janela segura de 18.000 caracteres (~3.500 tokens de entrada), o TranscriBR adota o algoritmo <code>sampleTranscriptLines</code> de <strong>Amostragem Cronol&oacute;gica Uniforme</strong>:</p>
<ul>
  <li><strong>Preserva&ccedil;&atilde;o de Extremos:</strong> As 10 primeiras falas da reuni&atilde;o (abertura de contexto) e as 10 &uacute;ltimas falas (fechamentos e conclus&otilde;es) s&atilde;o integralmente retidas.</li>
  <li><strong>Distribui&ccedil;&atilde;o Equidistante:</strong> O espa&ccedil;o restante do or&ccedil;amento &eacute; preenchido com amostras cronologicamente espa&ccedil;adas de toda a sess&atilde;o intermedi&aacute;ria, sinalizadas com marcadores <code>[... trecho condensado para manter vis&atilde;o cronol&oacute;gica ...]</code>.</li>
  <li><strong>Metadados Temporais Expl&iacute;citos (<code>buildSummaryPrompt</code>):</strong> O prompt envia explicitamente ao LLM o per&iacute;odo solicitado em hor&aacute;rio de Bras&iacute;lia, o primeiro e &uacute;ltimo timestamp de fala gravada e a rela&ccedil;&atilde;o de falantes, ancorando a percep&ccedil;&atilde;o temporal do modelo.</li>
  <li><strong>Or&ccedil;amento de Sa&iacute;da Expandido:</strong> Respostas geradas com at&eacute; 3.500 tokens (<code>max_tokens: 3500</code>) garantindo atas completas e detalhadas.</li>
</ul>`;

    if (updated.includes(oldSec6)) {
      updated = updated.replace(oldSec6, newSec6);
    }

    return updated;
  });

  // 3. Update STT Page (98313)
  await updatePage('98313', (html) => {
    let updated = html;
    const oldPromptSection = `<pre>
const stylePrompt = (names) =&gt; {
    const terms = hintTerms(names).join(', ');
    return \`Transcri&ccedil;&atilde;o em portugu&ecirc;s do Brasil, pontua&ccedil;&atilde;o correta, mantendo g&iac`;

    const newPromptSection = `<h2>2. Inje&ccedil;&atilde;o Din&acirc;mica de Vocabul&aacute;rio e Nomes Limpos (SCRUM-73)</h2>
<p>O par&acirc;metro <code>prompt</code> da API Whisper &eacute; interpretado como contexto fon&eacute;tico pr&eacute;vio, e <strong>n&atilde;o como instru&ccedil;&atilde;o para LLM</strong>. Meta-instru&ccedil;&otilde;es em texto causavam troca de palavras e alucina&ccedil;&otilde;es fon&eacute;ticas.</p>
<p>A fun&ccedil;&atilde;o <code>stylePrompt</code> agora gera uma lista pura e limpa de termos t&eacute;cnicos e apelidos dos falantes separados por v&iacute;rgula (at&eacute; 850 caracteres):</p>
<pre>
const stylePrompt = (names) =&gt; {
    const terms = hintTerms(names);
    if (!terms.length) return '';
    return terms.join(', ').slice(0, 850);
};
</pre>
<h2>3. Calibragem de Fidelidade de Segmentos (parseWhisper)</h2>
<p>Para evitar que senten&ccedil;as coloquiais em portugu&ecirc;s fossem cortadas por logprobs intermedi&aacute;rios, a condi&ccedil;&atilde;o de descarte foi refinada para:</p>
<pre>
if ((seg.no_speech_prob &gt; 0.7 &amp;&amp; seg.avg_logprob &lt; -1.0) || seg.avg_logprob &lt; -1.5 || seg.compression_ratio &gt; 2.4) {
    // segmento alucinado ou sem voz v&aacute;lida descartado
}
</pre>`;

    // If the old snippet is there, replace the section up to the next h2 or insert cleanly
    if (updated.includes('const stylePrompt = (names) => {')) {
      const idx = updated.indexOf('<h2>2. Inje&ccedil;&atilde;o Din&acirc;mica de Vocabul&aacute;rio e Nomes</h2>');
      if (idx !== -1) {
        updated = updated.slice(0, idx) + newPromptSection;
      }
    } else {
      updated += newPromptSection;
    }

    return updated;
  });
}

main().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
