Antes de qualquer tarefa, leia o RULES.md inteiro e siga-o.

# Diretrizes de Governança e Documentação Contínua: TranscriBR

Este documento estabelece o padrão OBRIGATÓRIO de fluxo de trabalho, registro de engenharia e governança contínua do projeto TranscriBR.

## Tríplice Registro Obrigatório (Git, Jira e Confluence)

A partir de agora, **TODA e QUALQUER** alteração de código, nova funcionalidade, refatoração, correção de bug ou evolução arquitetural DEVE ser obrigatoriamente refletida a cada passo nos 3 pilares do ecossistema:

---

### 1. Versionamento no Git / GitHub
- **Commits Semânticos**: Utilize o padrão *Conventional Commits* (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, etc.).
- **Mensagens Claras**: Descreva o que mudou e o motivo técnico da alteração.
- **Sincronização a Cada Passo**: Realize o `git push origin main` imediatamente a cada passo concluído.
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
