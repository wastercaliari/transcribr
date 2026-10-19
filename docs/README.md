# 📚 Diretório de Documentação Técnica e Governança (`/docs`)

Este diretório centraliza a documentação operacional, normas de engenharia, livros-razão imutáveis e especificações técnicas do projeto **TranscriBR**.

---

## 📂 Arquivos de Governança Local

| Arquivo | Finalidade | Regra Operacional |
|---|---|---|
| [`RULES.md`](./RULES.md) | **13 Regras Fundamentais de Engenharia** | Contrato normativo contínuo (Tríplice Registro, Code Scanning, Observabilidade, Sanitização). |
| [`CHANGELOG.md`](./CHANGELOG.md) | **Histórico Imutável de Entregas** | **Append-only**. Toda alteração concluída é registrada ao final com data, tipo, ticket e justificativa. |
| [`STATE.md`](./STATE.md) | **Estado Operacional do Projeto** | Visão do ciclo de vida ativo, tarefas concluídas, Sprint ativa e próximas prioridades. |
| [`IDEAS.md`](./IDEAS.md) | **Estacionamento de Ideias e Backlog** | Ideias de novas funcionalidades e otimizações arquiteturais antes da conversão em cards Jira. |
| [`CALCULATIONS.md`](./CALCULATIONS.md) | **Cálculos de Engenharia** | **Append-only**. Métricas de dimensionamento de áudio, budgets de latência e consumo de memória. |
| [`RULES 16.4 SETUP.md`](./RULES%2016.4%20SETUP.md) | **Setup do Framework DEV RULES 16.4** | Instruções de integração com ferramentas de IA, hooks de commit e diretrizes de mentoria. |

---

## 🏛️ A Bíblia do Projeto no Confluence (Espaço `TBR`)

A documentação detalhada e arquitetural do sistema reside no Atlassian Confluence Cloud:
- **Espaço:** `TBR` (*TranscriBR - Bíblia do Projeto*)
- **URL Base:** `https://wastercaliari.atlassian.net/wiki/spaces/TBR`

### Páginas Canônicas:
1. **01. Arquitetura do Sistema & Visão Geral de Engenharia** (ID: 491521)
2. **02. Engenharia de Áudio, DSP & Criptografia Discord DAVE** (ID: 163989)
3. **03. Motores de Inteligência Artificial & Transcrição (STT)** (ID: 98313)
4. **04. Motor de Ata Técnica & Resumo Inteligente (/resumo)** (ID: 327687)
5. **05. Comandos Slash, Interações & Ciclo de Vida do Bot** (ID: 98330)
6. **06. Infraestrutura, Deploy & DevOps (Railway & Local)** (ID: 524289)
7. **07. Histórico de Versões & Decisões de Engenharia (ADRs)** (ID: 360453)

---

## 🔗 Rastreabilidade e Governança Tríplice

Toda modificação relevante no código-fonte deve ser obrigatoriamente refletida de forma síncrona:
1. **Git / GitHub:** Branches dedicadas (`feat/`, `fix/`, `refactor/`, `docs/`) e Pull Requests com checks de CI/CD.
2. **Jira Software:** Card correspondente no projeto `SCRUM`, alocado na Sprint ativa e transicionado para `Concluído`.
3. **Confluence:** Registro de nova Decisão Arquitetural (ADR) na página 360453.
