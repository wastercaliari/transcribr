# RULES 16.4 SETUP (para humanos; o modelo não precisa ler)

Esta é a versão final. Arquivos: `RULES 16.4.md` (as regras), `revisor.md` (o agente revisor) e este guia. Chaves do Claude Code conferidas na documentação entre 26 e 30/09/2026. A 16.4 traz de volta cinco regras da antiga DEV RULES 6.0.

## Decisão final: RULES ou AGENT?

**RULES.** Ela precisa estar presente em toda resposta, e só um arquivo de regras garante isso. A única exceção é a revisão, que funciona melhor como agente.

| Critério | Como RULES (carregada em toda sessão) | Como AGENT (subagente) |
| --- | --- | --- |
| Quando age | Em toda resposta, sem ninguém pedir | Só quando alguém o chama |
| Sabe o motivo das decisões | Sim, vê a conversa inteira | Não, começa do zero |
| Funciona em qualquer IA | Sim | Só onde há subagentes (Claude Code, por exemplo) |
| Custo | Cerca de 5.100 tokens por sessão | Cada chamada relê tudo; uma rodada do cronista antigo gastou cerca de 550 mil tokens |
| Melhor uso | Mentor, cronista, regras de honestidade | **Revisão**: começar do zero é justamente o que a torna independente |

## Como começar

Faça os comandos no Git Bash (vem com o Git for Windows), dentro da pasta do projeto.

| Passo | Projeto novo | Projeto que já existe |
| --- | --- | --- |
| 1. Copiar as regras | Copie `RULES 16.4.md` para a pasta com o nome `RULES.md` | Igual |
| 2. Ligar as regras | `printf '\n@RULES.md\n' >> CLAUDE.md` | Igual. O que já está no `CLAUDE.md` continua lá |
| 3. Instalar o revisor | Copie `revisor.md` para `.claude/agents/revisor.md` | Igual |
| 4. Travas (opcional) | `git init` e depois as seções 6 e 7 | Antes, rode `git config --get core.hooksPath`. Se aparecer algo, junte o script da seção 6 ao hook que já existe |
| 5. Primeiro pedido | Peça o que quer, por exemplo "Crie um app de calculadora". A IA sugere a linguagem e o comando de teste e espera o seu ok | "Leia o projeto e proponha os blocos Stack & Versions e Commands do README. Não mude código." |
| 6. Conferir | Feche e abra o Claude Code. A primeira resposta começa com `#1 · modelo: ...` | Igual |

Três cuidados no projeto que já existe:

- **Já tem um `CHANGELOG.md` de versões**, com o mais novo no topo? Renomeie o antigo, ou a trava vai bloquear quem escreve no topo.
- **Já tem outras regras** (no `CLAUDE.md`, no `~/.claude/CLAUDE.md`, nas preferências do app, por exemplo a DEV RULES 6.0)? Deixe só a RULES 16.4.
- **O código antigo fica como está.** A RULES mexe só no que você pede e sugere melhorias como ideias.

Prefere que a IA faça os passos 1 a 4? Coloque `RULES 16.4.md`, `revisor.md` e este guia na pasta do projeto, abra a sua ferramenta nela e cole o pedido abaixo. Ele serve para qualquer ferramenta com acesso aos arquivos. Foi testado no Claude Code com o Sonnet, num projeto limpo e num projeto com armadilhas; em Codex e Cursor ainda não foi testado.

```text
Instale a RULES 16.4 neste projeto. Os arquivos RULES 16.4.md, RULES 16.4 SETUP.md e revisor.md estão nesta pasta. Leia o SETUP antes de começar e não mexa em nenhum código do projeto.

1. Antes de mudar qualquer coisa, verifique e me diga em uma lista curta:
   - a pasta é um repositório git? (se não for, rode git init)
   - o que "git config --get core.hooksPath" mostra
   - quais destes já existem: RULES.md, CLAUDE.md, AGENTS.md, .cursor/, .claude/settings.json, CHANGELOG.md
   Pare e me pergunte, sem instalar a parte afetada, se: já existir um RULES.md diferente; o core.hooksPath já tiver valor; o .claude/settings.json já existir; ou o CHANGELOG.md já existir com linhas fora do formato "AAAA-MM-DD [TIPO] @onde ...". O resto pode seguir.

2. Regras: renomeie RULES 16.4.md para RULES.md.

3. Faça a sua ferramenta carregar as regras sozinha, sem apagar nada que já exista nesses arquivos:
   - CLAUDE.md: acrescente uma linha só com @RULES.md
   - AGENTS.md: acrescente a linha "Antes de qualquer tarefa, leia o RULES.md inteiro e siga-o."
   - se existir a pasta .cursor/, crie .cursor/rules/rules.mdc com "alwaysApply: true" no cabeçalho e essa mesma linha
   Se achar outras regras de formato de resposta ou de memória nesses arquivos, não apague: só me avise.

4. Só se você for o Claude Code ou se o projeto já tiver a pasta .claude/: mova revisor.md para .claude/agents/revisor.md e crie .claude/settings.json e .claude/hooks/memory-gate.sh com os blocos da seção 7 do SETUP. Em outra ferramenta, pule este passo e diga que pulou.

5. Trava do git: crie .githooks/pre-commit com o bloco da seção 6 do SETUP e rode os três comandos "Ative uma vez por clone" dessa seção.

6. Nos passos 4 e 5, copie os blocos do SETUP por comando, sem redigitar, grave com fim de linha LF e confira que o arquivo criado é idêntico ao bloco.

7. Faça o commit "setup: RULES 16.4" e me mostre a saída.

8. Termine com uma lista curta: o que foi instalado, o que foi pulado e por quê, e o que eu preciso fazer. Lembre-me de abrir uma sessão nova: a primeira resposta deve começar com "#1 · modelo:".
```

## Dá para só pedir no chat?

Dá, mas só vale naquela conversa. Para valer sempre, a regra precisa ficar num lugar que a ferramenta carrega sozinha.

| Onde você usa | Só pedir ou colar no chat | Para valer sempre |
| --- | --- | --- |
| Claude Code, Codex, Cursor | Funciona com "Leia RULES.md e siga". Some depois de `/clear`, de um RESET ou quando a conversa é resumida | Passo 2 da tabela acima (a IA faz com o pedido de instalação) |
| ChatGPT ou Claude.ai no navegador | Funciona colando o arquivo. Vale só naquela conversa | Cole nas instruções do projeto |
| Modelo local (Ollama) | Funciona colando | Coloque no system prompt (seção 2) |

## No dia a dia

| Quando você vê | O que fazer |
| --- | --- |
| `RESET: memória salva...` | Digite `/clear` e diga "continue" |
| Uma ideia, como `I-2 · ...` | "faça a I-2" aceita, "não quero a I-3" descarta de vez, "sem ideias" silencia |
| Uma funcionalidade terminada | "faça a revisão": a IA chama o revisor, que procura defeitos e não mexe no código |
| "Próximo passo: salvar com a mensagem ..." | Faça o commit com essa mensagem; a trava roda os testes antes |
| Uma resposta confusa ou técnica demais | Diga "explique mais simples": a regra manda escrever para iniciante |

## Os hooks são obrigatórios?

Não. As regras funcionam sozinhas em qualquer ferramenta, inclusive sem git e sem GitHub (os hooks daqui são do git local, não do GitHub). Cada hook só troca "o modelo deveria" por "o sistema garante":

| Hook | Onde roda | O que passa a ser garantido |
| --- | --- | --- |
| pre-commit (seção 6) | git, com qualquer ferramenta ou pessoa | histórico do log intocável; nada entra no commit sem passar no `check` |
| SessionStart (seção 7) | Claude Code | estado, ideias, regras e últimas falhas carregados em toda sessão |
| Stop, portão de memória (seção 7) | Claude Code | se o código mudou e o log não, o modelo é lembrado uma vez antes de encerrar |

Sem hooks, tudo isso depende de o modelo seguir o texto.

## 1. Onde carregar as regras

- **Claude Code:** salve como `RULES.md` e escreva `@RULES.md` no `CLAUDE.md`, ou salve dentro de `.claude/rules/`. Um `RULES.md` solto na raiz não é carregado sozinho.
- **Codex e ferramentas que leem `AGENTS.md`:** cole o conteúdo (ou referencie) no `AGENTS.md`.
- **Cursor:** `.cursor/rules/rules.mdc` com `alwaysApply: true` no front matter.
- **Apps de chat (ChatGPT, Claude.ai):** instruções do projeto ou personalizadas. Nesses apps elas ficam abaixo do system prompt da própria plataforma.
- **Modelos locais:** coloque no system prompt. Com janela de 8K tokens ou menos, use só a Parte A.

## 2. Modelo local: ajuste a janela antes de tudo

O Ollama usa janela de 4K tokens por padrão em máquinas com menos de 24 GiB de VRAM (caso de uma RX 6600 de 8 GB). Nessa janela, nem a Parte A da RULES 16.4 (cerca de 2.400 tokens) cabe junto com uma troca de pergunta e resposta; a completa tem cerca de 5.100. Aumente a janela com `OLLAMA_CONTEXT_LENGTH=16384 ollama serve`, pelo controle deslizante do app ou pelo parâmetro `num_ctx`, até onde a VRAM permitir: janela maior consome mais memória.

Pela regra do modelo mais fraco, não use o menor tamanho de uma família local (por exemplo 0.5B ou 1.5B). E os modelos que cabem em 8 GB provavelmente ficam abaixo do Haiku em programação: para programar com esta RULES, prefira Sonnet ou Opus.

`session_limit` sugerido (supondo cerca de 1.000 tokens por pergunta e resposta e 1.024 reservados para a saída):

| Janela | Parte A | Completa |
| --- | --- | --- |
| 4K | não cabe | não cabe |
| 8K | 4 | 2 |
| 16K | 12 | 10 |
| 32K ou mais | 20 | 20 |

## 3. README: blocos que as regras leem

```markdown
## Stack & Versions
- python@3.12, fastapi@0.115, postgres@16

## Commands
check: pyright && ruff check . && pytest -q
session_limit: 20

## Models
search: sonnet
code: sonnet
plan: opus
```

Troque pelos comandos e versões reais do projeto. O importante é existir uma linha começando com `check:`. O bloco `## Models` é opcional: sem ele, o modelo trabalha sozinho (seção 8).

## 4. Arquivos de memória

`CHANGELOG.md` (só acrescenta; uma linha por evento):

```markdown
# CHANGELOG
2026-09-26 [RULE] @global Money is stored as integer cents, never float | why: product spec
2026-09-26 [DECISION] @src/modules/ledger One DB transaction per posting | why: partial postings break the balance
2026-09-26 [FAIL] @src/modules/ledger/post.py#post_entry Tried SELECT ... FOR UPDATE on sqlite | why: sqlite3.OperationalError: near "FOR": syntax error
2026-09-26 [DONE] @src/modules/pricing/discount.ts applyDiscount rejects percent outside 0..100 | why: fail fast
```

`STATE.md` (sobrescrito; no máximo 30 linhas):

```markdown
# STATE
Goal:
Done:
Next:
Blockers:
Failed (what was tried, error type and message): see CHANGELOG.md
Rules (business rules the user gave): see CHANGELOG.md
Ideas (open, best first): see IDEAS.md
```

`IDEAS.md` (sobrescrito; só ideias abertas, melhor primeiro, no máximo 10):

```markdown
# IDEAS (open, best first, max 10)
- I-1 [RISK] Stop typing after 15 digits | evidence: engine.ts:65 appends digits with no limit | value: no silently wrong results | cost: S
```

`CALCULATIONS.md` (só acrescenta):

```markdown
# CALCULATIONS
## C-1 | 2026-09-26 | context
Inputs:
Code run:
Output:
```

Linha `PURPOSE` no arquivo principal de cada módulo (é o mapa do projeto, sem arquivo à parte):

```ts
// PURPOSE: discount rules applied to cart totals
```

```python
# PURPOSE: double-entry postings; debits must equal credits
```

## 5. Pacote inicial para trade e banking

Linhas `@global` para colar no `CHANGELOG.md` de um projeto financeiro. São pontos de partida: confirme cada uma com os requisitos do produto e com o compliance da sua jurisdição antes de usar.

```markdown
2026-09-26 [RULE] @global Money uses integer minor units (cents) or a decimal type, never binary float | why: floats cannot represent 0.10 exactly
2026-09-26 [RULE] @global Every rounding names its mode (for example ROUND_HALF_EVEN) and where it happens | why: implicit rounding breaks reconciliation
2026-09-26 [RULE] @global Timestamps are stored in UTC with timezone; convert only at the edges | why: DST and market-hours bugs
2026-09-26 [RULE] @global Every write endpoint (orders, transfers, payments) takes an idempotency key | why: a retry must not duplicate a trade
2026-09-26 [RULE] @global Financial records are append-only; corrections are new reversing entries | why: audit trail
2026-09-26 [RULE] @global Every posting balances: total debits equal total credits | why: double-entry invariant
2026-09-26 [RULE] @global Each instrument declares its price tick and quantity step | why: venues reject invalid orders
2026-09-26 [RULE] @global Prices and FX rates are validated and have a maximum age | why: stale prices cause bad trades
2026-09-26 [RULE] @global Secrets never go in code or logs; personal data is masked in logs | why: security and privacy
2026-09-26 [RULE] @global API contracts are versioned; a breaking change needs a new version | why: clients break silently
```

Para regras assim, testes baseados em propriedades pegam o que exemplos soltos não pegam: Hypothesis (Python) ou fast-check (TypeScript), por exemplo "toda posição fecha com débito igual a crédito".

## 6. Hook de pre-commit (vale para qualquer modelo e qualquer ferramenta)

Faz duas coisas: impede editar ou apagar linhas antigas do `CHANGELOG.md` e do `CALCULATIONS.md`, e bloqueia o commit quando o `check` do README falha. Não depende de o modelo obedecer.

Salve como `.githooks/pre-commit`:

```sh
#!/bin/sh
# 1) CHANGELOG.md and CALCULATIONS.md are append-only.  2) The README "check:" command must pass.
# Works for any agent and any human that commits. Reads the staged files, not the working tree.
for f in CHANGELOG.md CALCULATIONS.md; do
  old=$(git show "HEAD:$f" 2>/dev/null) || continue
  if ! new=$(git show ":$f" 2>/dev/null); then
    echo "pre-commit: $f is append-only and cannot be deleted" >&2; exit 1
  fi
  case "$new" in
    "$old"*) ;;
    *) echo "pre-commit: $f is append-only; add new lines instead of editing or deleting old ones" >&2; exit 1 ;;
  esac
done
if ! git cat-file -e :README.md 2>/dev/null; then
  if git cat-file -e HEAD:README.md 2>/dev/null; then
    echo "pre-commit: README.md holds the check command and cannot be deleted" >&2; exit 1
  fi
  echo "pre-commit: no README.md yet, check skipped. Add README.md with a 'check:' line to turn it on." >&2
  exit 0
fi
cmd=$(git show :README.md | sed -n 's/^[-*[:space:]]*check:[[:space:]]*//p' | head -n 1 | tr -d '`')
if [ -z "$cmd" ]; then
  echo "pre-commit: add a 'check: <command>' line under ## Commands in README.md" >&2
  exit 1
fi
echo "pre-commit: running: $cmd" >&2
sh -c "$cmd" || { echo "pre-commit: check failed, commit blocked" >&2; exit 1; }
```

Ative uma vez por clone:

```sh
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
printf '%s\n' '' '.githooks/* text eol=lf' '*.sh text eol=lf' >> .gitattributes
```

A última linha mantém os hooks com fim de linha LF. Com CRLF, comum no Windows, o hook quebra: num teste, o commit falhou com `cannot exec '.githooks/pre-commit': No such file or directory`.

- Testado em repositório temporário, 13 casos: projeto novo ainda sem README (commit feito, check pulado com aviso), README sem linha `check:` (bloqueado), log novo (feito), linha acrescentada (feito), linha antiga editada (bloqueado), linha antiga apagada (bloqueado), acréscimo depois de arquivo sem quebra de linha final (feito), log inteiro apagado (bloqueado), `CALCULATIONS.md` novo (feito), entrada de cálculo editada (bloqueado), `check` falhando (bloqueado), README apagado para fugir do check (bloqueado), `check` em item de lista com crases (feito).
- `git commit --no-verify` pula o hook. A RULES 16.4 proíbe o modelo de usar isso, e o CI (seção 9) cobre quem pular.
- Windows: o Git for Windows roda hooks no próprio `sh`. O `.gitattributes` acima garante o fim de linha LF.

## 7. Claude Code: `.claude/settings.json`

```json
{
  "autoCompactEnabled": false,
  "autoMemoryEnabled": true,
  "availableModels": [
    "sonnet",
    "opus",
    "fable"
  ],
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" 2>/dev/null || exit 0; [ -f STATE.md ] && { echo '## STATE.md (auto-loaded)'; cat STATE.md; }; [ -f IDEAS.md ] && { echo '## IDEAS.md (open ideas, auto-loaded)'; head -n 12 IDEAS.md; }; [ -f CHANGELOG.md ] && { echo '## @global lines (CHANGELOG.md)'; grep -F '@global' CHANGELOG.md; echo '## Last 5 [FAIL] lines (CHANGELOG.md)'; grep -F '[FAIL]' CHANGELOG.md | tail -n 5; }; c=$(git log --since=24.hours --oneline 2>/dev/null | head -n 10); [ -n \"$c\" ] && { echo '## Commits of the last 24h (git log)'; echo \"$c\"; }; exit 0"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "sh \"$CLAUDE_PROJECT_DIR/.claude/hooks/memory-gate.sh\""
          }
        ]
      }
    ]
  }
}
```

Para o portão de memória (opcional), salve também `.claude/hooks/memory-gate.sh`. Ele olha a pasta `src`; troque se o seu código mora em outra:

```sh
#!/bin/sh
# Optional Stop hook: if code in src/ changed but CHANGELOG.md did not, ask Claude once to
# write the memory before it stops. It never loops: it steps aside when stop_hook_active is
# true, and it blocks each set of changes only once.
input=$(cat)
printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
changed=$(git status --porcelain -- src 2>/dev/null)
[ -z "$changed" ] && exit 0
[ -n "$(git status --porcelain -- CHANGELOG.md)" ] && exit 0
key=$(printf '%s' "$changed" | cksum | cut -d' ' -f1)
mark="$(git rev-parse --git-dir)/memory-gate-$key"
[ -f "$mark" ] && exit 0
: > "$mark"
echo "Memory gate: code in src/ changed but CHANGELOG.md did not. Do the Record step (log line, STATE.md, IDEAS.md) before you stop." >&2
exit 2
```

- **O que faz:** desliga o auto-compact, deixa a memória automática ligada e, ao iniciar, retomar, depois de `/clear` e depois de `/compact`, coloca no contexto o `STATE.md`, as ideias abertas do `IDEAS.md`, as regras `@global`, as 5 últimas falhas e os commits das últimas 24 horas (tirados do git, então nunca ficam errados). O modelo começa cada sessão lembrando o que não pode repetir, sem precisar obedecer a nada.
- **Portão de memória:** quando o modelo tenta encerrar com código alterado em `src` e o `CHANGELOG.md` intocado, o hook o lembra uma vez de registrar. Nunca entra em loop: respeita o `stop_hook_active` do Claude Code e só bloqueia cada conjunto de mudanças uma vez. Testado em 8 casos (pasta sem git, nada mudou, código mudou, segunda tentativa, código e log mudaram, novo conjunto de mudanças, pasta inexistente).
- **Memória automática (auto memory):** fica ligada porque trabalha junto com o cronista e cobre o que ele não cobre: suas preferências e correções, como "use pnpm" ou "explique com mais calma". Custa pouco: a cada sessão carrega só o índice `MEMORY.md` (no máximo 200 linhas ou 25 KB), e pela documentação ela pula o que já está no código, no git ou no `CLAUDE.md`. Ela fica só no seu computador e fora do git; por isso a RULES 16.4 manda regras de negócio, decisões, falhas e ideias só para o `CHANGELOG.md` e o `IDEAS.md`. Para ver o que ela guardou, use `/memory`. Para desligar neste projeto, troque para `"autoMemoryEnabled": false`.
- **Nunca o modelo mais fraco:** o `availableModels` deixa escolher só Sonnet, Opus e Fable (o `opusplan` usa Opus e Sonnet). Se algo pedir o Haiku, como um subagente com `model: haiku` ou o ajudante interno `claude-code-guide`, o Claude Code troca por um modelo permitido e avisa. Duas pegadinhas: a lista se soma à do seu `~/.claude/settings.json` (se lá houver `haiku`, ele continua liberado), e ela não muda o modelo Padrão da conta, então confira com `/model` que você está em Sonnet ou Opus. Não dá para deixar isso por conta do próprio modelo: num teste, o Haiku leu a regra, escreveu que era o Haiku e seguiu trabalhando. Por isso a trava é esta configuração.
- **Fluxo de reset:** quando o modelo imprimir `RESET: ...`, rode `/clear` e diga "continue".
- **Com o auto-compact desligado,** dê `/clear` antes de a janela encher. O `/clear` não custa nada; o `/compact` relê a conversa inteira para resumir.
- **Windows:** hooks do Claude Code rodam no Git Bash. Sem Git Bash, rodam no PowerShell e este comando precisa ser adaptado.
- **Conferir:** `/hooks` deve listar o hook em SessionStart; `/config` deve mostrar o auto-compact desligado.
- JSON validado e comandos testados em shell (projeto completo, projeto vazio, log sem linhas globais nem falhas, pasta inexistente; e os 8 casos do portão). Não executado dentro do Claude Code.

Não mexa nestes:

- **Thinking:** melhora tarefas complexas. Para economizar em tarefas simples, use `/effort low`. No Opus 5.5 e nos modelos Fable ele nem pode ser desligado.
- **Checkpoints:** são snapshots locais de arquivo que alimentam o `/rewind`, sua rede de segurança.
- **`CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000`:** não desliga a compactação; só empurra o gatilho para o limite da janela.
- **Workflows:** só rodam quando pedidos (palavra `ultracode`, "use a workflow" ou `/effort ultracode`) e disparam vários subagentes, com bem mais tokens. Para impedir de vez: `"disableWorkflows": true`, o que também desativa o `ultracode`.

## 8. Um modelo para cada função

Um modelo não consegue trocar o próprio motor no meio da conversa, nem se avaliar de forma confiável: quem escolhe o modelo é a ferramenta. Por isso a RULES 16.4 só pede que ele diga o que sabe de si na primeira resposta (`Env:`) e siga a tabela que você define. No Claude Code há quatro caminhos, conferidos na documentação:

- **`/model opusplan`:** Opus quando está planejando, Sonnet quando está executando. Divide por função sem subagentes, então sem o custo de começar do zero.
- **Bloco `## Models` no README:** a RULES 16.4 passa a delegar buscas longas, código e planejamento a subagentes com o modelo que você indicou. O Claude Code aceita um modelo em cada chamada de subagente.
- **`CLAUDE_CODE_SUBAGENT_MODEL`:** define o modelo dos subagentes que não escolhem um. Os internos Explore e Plan seguem o modelo da conversa; para forçar o mesmo modelo em todos, use também `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`.
- **Arquivos de subagente** em `.claude/agents/` com `model:` no cabeçalho (`sonnet`, `opus`, `fable` ou `inherit`; o `haiku` existe, mas a RULES 16.4 não usa).

Cuidado com o custo: cada subagente começa com o contexto vazio, relê o que precisa e conta no mesmo limite de uso da conversa principal. Vale para buscas grandes, logs longos e revisões, não para tudo. Em apps de chat não existe essa escolha.

A RULES 16.4 nunca usa o modelo mais fraco de uma família (no Claude, o Haiku). Na medição, o Haiku acertou o código e não inventou nada, mas errou idioma e formato em todas as rodadas, não parou certo no limite de sessão e, numa rodada, errou um caso do %. A trava mecânica é o `availableModels` da seção 7.

**O revisor** (`.claude/agents/revisor.md`) é o único agente do pacote. Ele roda com o mesmo modelo da conversa (`model: inherit`), nunca vê a conversa de quem programou, procura defeitos, escreve testes que os mostram e um relatório curto, e não mexe no código. Peça "faça a revisão" quando uma funcionalidade terminar. Em ferramentas sem subagentes, abra uma conversa nova e diga "atue como o revisor de revisor.md".

## 9. Outras travas mecânicas

- **Tamanho de arquivo:** ESLint `max-lines` com erro acima de 500; pylint `max-module-lines=500`.
- **Fronteiras, dependências circulares e "dumps":** dependency-cruiser (TS) ou import-linter (Python), rodando dentro do `check`.
- **CI:** rode o mesmo `check` a cada push. Pega quem pulou o hook local.

## 10. O que ainda falta

- **Eval entre modelos:** feita em 28/09/2026 com Haiku 4.5, Sonnet 5.5 e Opus 5.5, uma rodada por modelo (Sonnet e Opus 42/42; Haiku 30/42, errou idioma e formato). Na 16.1, com a memória gravada em um comando só, o registro caiu de 21% para 10% dos tokens da tarefa no Sonnet e de 21% para 8% no Opus (no Haiku, de 9% para 8%), e a memória continuou completa. Na 16.3 (30/09/2026, Sonnet e Opus): código certo nos 6 testes escondidos, memória completa, respostas 55% a 68% mais curtas, jargão de 4 a 5 vezes menor e nenhum rótulo em inglês; o revisor achou um defeito real sem mexer no código. Na 16.4 (06/10/2026, Sonnet e Opus): mesma tarefa, de novo 6 de 6 nos testes escondidos e memória completa; nas duas perguntas novas, os dois pediram o erro e o código antes de consertar, e avisaram que o cálculo registrado não batia, propondo uma correção sem apagar o registro antigo. As regras de ler só o que o outro módulo expõe, da ordem de revisão e das partes pequenas de tela não tiveram teste próprio. O Haiku não foi medido na 16.3 nem na 16.4, porque a regra proíbe usá-lo. Falta medir modelos locais e de outras empresas, e repetir de 5 a 10 vezes.
- **Memória automática:** só existe dentro do Claude Code, então não deu para medir aqui. Depois de algumas sessões, confira com `/memory` se ela guardou só preferências suas; se aparecer regra de negócio lá, desligue.
- **Trava de modelo:** o `availableModels` segue a documentação do Claude Code, mas não deu para executar aqui. Confira com `/model` que o Haiku não aparece mais para escolher.
