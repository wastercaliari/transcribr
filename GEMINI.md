Antes de qualquer tarefa, leia o RULES.md e o AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md inteiros e siga-os rigorosamente.

# Diretrizes de Governança e Documentação Contínua: TranscriBR

Este documento estabelece o padrão OBRIGATÓRIO de fluxo de trabalho, registro de engenharia e governança contínua do projeto TranscriBR.

## Tríplice Registro Obrigatório (Git, Jira e Confluence)

A partir de agora, **TODA e QUALQUER** alteração de código, nova funcionalidade, refatoração, correção de bug ou evolução arquitetural DEVE ser obrigatoriamente refletida a cada passo nos 3 pilares do ecossistema:

---

### 1. Versionamento no Git / GitHub
- **Commits Semânticos & Rastreáveis**: Utilize o padrão *Conventional Commits* (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, etc.) incluindo obrigatoriamente a chave do ticket (ex.: `feat: gravar áudio consolidado (SCRUM-53)`).
- **Estratégia de Branches por Card do Jira**: Desenvolva funcionalidades em branches dedicadas isolando o escopo de cada ticket: `<tipo>/<TICKET-KEY>-<descricao>` (ex.: `feat/SCRUM-53-audio-wav-export`).
- **Vinculação Automática no Jira**: O hook post-commit (`scripts/link_jira_github.js`) anexa automaticamente os links interativos da branch e do commit diretamente no card do Jira.
- **Abertura Obrigatória de Pull Request & Esteira CI/CD**: Após `git push origin <branch>`, crie obrigatoriamente um Pull Request formal no GitHub via `gh pr create --title "<tipo>: <descricao> (<TICKET-KEY>)" --body "..."` para acionar a esteira de CI do GitHub Actions (`.github/workflows/ci.yml`) e vincular o PR no painel nativo de Desenvolvimento do Jira. O merge em `main` deve ser concluído via `gh pr merge` após os testes da esteira passarem.
- **Segurança Absoluta**: NUNCA commite arquivos `.env`, tokens privados (`Atlassian*.txt`, `Railway*.txt`) ou pastas de configuração local (`.agents/`). O `.gitignore` deve ser estritamente preservado.

---

### 2. Governança e Rastreabilidade no Jira
- **Projeto Oficial**: `SCRUM` (*Project DOC - TranscriBR* em `https://wastercaliari.atlassian.net`).
- **Epics de Referência**:
  - `SCRUM-5`: Pipeline de Áudio, Criptografia DAVE (E2EE) e DSP.
  - `SCRUM-12`: Motores de Transcrição de Voz (STT) & Inteligência Artificial.
  - `SCRUM-19`: Motor de Ata Técnica & Resumo Inteligente (`/resumo`).
  - `SCRUM-26`: Discord Bot Core, Ciclo de Vida e Comandos Slash.
  - `SCRUM-33`: Infraestrutura, DevOps & Deploy 24/7 (Railway).
  - `SCRUM-38`: Integrações Enterprise & Ecossistema Atlassian (Confluence & Jira).
- **Procedimento Obrigatório a Cada Passo**:
  - **Transição Imediata para 'Em andamento':** Sempre que pegar ou selecionar qualquer tarefa do Kanban ('A fazer') para executar, transicione-a OBRIGATORIAMENTE para 'Em andamento' no Jira antes de iniciar a escrita de código ou testes.
  - Toda tarefa tocada deve ter seu status atualizado no Kanban (colunas 'A fazer', 'Em andamento' ou 'Concluído').
  - Mantenha a alocação obrigatória na Sprint ativa (ex.: 'SCRUM Sprint 0') para exibição contínua no Quadro.
  - Toda nova tarefa, ideia ou débito técnico descoberto deve ser cadastrado e vinculado ao Epic correspondente.

---

### 3. Documentação Centralizada no Confluence ("A Bíblia do Projeto")
- **Espaço Oficial**: `TBR` (*TranscriBR - Bíblia do Projeto* em `https://wastercaliari.atlassian.net/wiki/spaces/TBR`).
- **Páginas Canônicas**:
  - `01. Arquitetura do Sistema & Visão Geral de Engenharia` (ID: 491521)
  - `02. Engenharia de Áudio, DSP & Criptografia Discord DAVE` (ID: 163989)
  - `03. Motores de Inteligência Artificial & Transcrição (STT)` (ID: 98313)
  - `04. Motor de Ata Técnica & Resumo Inteligente (/resumo)` (ID: 327687)
  - `05. Comandos Slash, Interações & Ciclo de Vida do Bot` (ID: 98330)
  - `06. Infraestrutura, Deploy & DevOps (Railway & Local)` (ID: 524289)
  - `07. Histórico de Versões & Decisões de Engenharia (ADRs)` (ID: 360453)
- **Procedimento para Cada Modificação**:
  - Se houver nova decisão técnica ou mudança arquitetural, registre-a imediatamente como um novo **ADR** na página `07. Histórico de Versões & Decisões de Engenharia (ADRs)`.
  - Se um módulo, comando ou parâmetro for alterado, atualize a respectiva página temática no Confluence para mantê-la 100% fiel ao código em produção.
  - Nenhuma documentação deve ficar desatualizada ou defasada em relação ao repositório.

---

### 4. Vigilância Contínua & Correção Automática de Code Scanning (DevSecOps)
- **Inspeção e Correção Automática Obrigatória**: Sempre que qualquer alerta de segurança (GitHub CodeQL Code Scanning, TruffleHog Secrets ou npm audit) for identificado no repositório ou na esteira de CI, o agente DEVE agir imediatamente e de forma proativa sem intervenção manual do usuário.
- **Fluxo Padrão de Remediação (Analyze, Learn & Fix)**:
  1. *Obtenção de Metadados*: Inspecionar os detalhes completos da vulnerabilidade (Regra, severidade, CWE, AST e linha afetada) via API (`gh api repos/:owner/:repo/code-scanning/alerts/:id`).
  2. *Aplicação da Solução Segura*: Aprender a recomendação oficial do scanner de segurança e aplicar o fix estrutural definitivo (ex.: sanitização recursiva contra reintrodução de caracteres/tags em CWE-116/CWE-20).
  3. *Testes de Regressão*: Adicionar casos de teste unitário cobrindo o vetor de ataque específico.
  4. *Ciclo Git-Jira-Confluence*: Criar card no Jira com transição para 'Em andamento', branch dedicada `fix/<TICKET>-<desc>`, Pull Request formal no GitHub, aprovação de 100% dos checks de CI e merge em `main`.
