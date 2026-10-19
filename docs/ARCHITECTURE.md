# 🏗️ ARQUITETURA MULTI-AGENTE & GOVERNANÇA UNIVERSAL

> **Visão Geral:** Este documento detalha a topologia de cooperação, barramento de eventos lógicos, handovers automáticos, o ciclo de auto-evolução reflexiva e os 6 loops autônomos que regem a suíte de agentes do **agent-master-devsecops**.

---

## 1. Topologia da Rede Multi-Agente & Auto-Evolução Reflexiva

A suíte opera sob uma arquitetura hierárquica e cooperativa (Mesh-Hierarchical), onde o **Agente Mestre Universal** atua como coordenador e despachante central, orquestrando quatro agentes operacionais especializados:

```mermaid
graph TD
    User["Desenvolvedor / Liderança Técnica / CI"] -->|Instrução / Comando| Master["⚡ Agente Mestre Universal (Orquestrador)"]
    
    Master -->|modo: devsecops| DevSecOps["🛡️ Agente DevSecOps & Engenharia"]
    Master -->|modo: revisor| Reviewer["🔍 Agente Revisor Crítico Adversário"]
    Master -->|modo: melhoria| Improvement["📈 Agente de Melhoria Contínua & Ideias"]
    Master -->|modo: observabilidade| SRE["📡 Agente SRE & Observabilidade"]
    Master -->|modo: full-dev (Opcional)| FullDev["⚡ Modo Full Developer (Auto-Loop Contínuo de Ideias)"]
    
    DevSecOps -->|Entrega Código / PR| Reviewer
    Reviewer -->|Reprovado: Aponta Falhas/Testes| DevSecOps
    Reviewer -->|Aprovado: Libera Merge| Master
    
    SRE -->|Detecta Gargalo / Alerta| Improvement
    Improvement -->|Plano de Otimização| DevSecOps
    
    subgraph Reflexive_Evolution["🔄 Ciclo de Auto-Evolução Reflexiva do Próprio Agent"]
        Improvement -.->|Audita Eficiência de Prompt & Inovações| IdeasBacklog[("💡 docs/IDEAS.md (Backlog Reflexivo)")]
        IdeasBacklog -.->|Gera Especificação de Melhoria do Agente| DevSecOps
        Reviewer -.->|Audita Contratos, Prompts & Regras| DevSecOps
    end

    DevSecOps & Reviewer & Improvement & SRE -->|Atualiza Livros-Razão| Ledgers[("📚 Memória Imutável: STATE.md, CHANGELOG.md, IDEAS.md, RULES.md")]
```

---

## 2. Como os Agentes Conversam e Acionam Uns aos Outros

A comunicação e transição entre agentes é regida por **Gatilhos de Handover (Passagem de Bastão)** determinísticos:

### 2.1. Handover DevSecOps ➡️ Revisor (Gatilho: `EVENT_CODE_COMPLETE`)
* **Momento:** Assim que o Agente DevSecOps conclui a escrita de código, criação de testes locais e validação de segurança.
* **Ação Automática:** O DevSecOps não aprova a própria entrega. Ele aciona o **Agente Revisor Independente** (`revisor.md`), passando o diff gerado e o contexto do ticket.
* **Comportamento do Revisor:** Assume postura de auditor cego e adversário, caçando ativamente vulnerabilidades, casos de borda não testados, problemas de concorrência ou quebras das 13 Regras.

### 2.2. Handover Revisor ➡️ DevSecOps (Gatilho: `EVENT_REVIEW_FAILED`)
* **Momento:** O Revisor encontra qualquer falha (teste que quebra, vulnerabilidade CWE, ausência de tratamento de erro, ou ambiguidade em prompt).
* **Ação Automática:** O Revisor emite um parecer técnico estrito, escreve um teste unitário negativo que reproduz o problema e devolve a responsabilidade para o Agente DevSecOps corrigir antes de qualquer aprovação.

### 2.3. Handover SRE / Observabilidade ➡️ Melhoria Contínua (Gatilho: `EVENT_METRIC_ANOMALY`)
* **Momento:** O Agente de Observabilidade detecta aumento de latência média (p95/p99), vazamento de memória ou aumento no descarte de dados.
* **Ação Automática:** Executa o playbook imediato de auto-remediação (ex.: purga de buffer) e despacha um alerta com métricas numéricas para o **Agente de Melhoria Contínua**.
* **Comportamento da Melhoria Contínua:** Abre investigação Ishikawa/PDCA, analisa complexidade ciclomática e desenha uma proposta de refatoração para o DevSecOps implementar.

### 2.4. Handover Melhoria Contínua ➡️ DevSecOps (Gatilho: `EVENT_REFACTOR_PROPOSAL`)
* **Momento:** A Melhoria Contínua formula uma proposta validada de redução de débito técnico.
* **Ação Automática:** Cadastra a ideia no `docs/IDEAS.md` ou no backlog do sistema de tickets e solicita ao DevSecOps a abertura de uma branch dedicada para a refatoração.

### 2.5. Handover Reflexivo: Auto-Evolução do Próprio Agent (Gatilho: `EVENT_AGENT_SELF_IMPROVE`)
* **Momento:** A cada conclusão de tarefa relevante, o Agente de Melhoria Contínua avalia se a resposta, o gasto de tokens, a clareza das 15 seções ou a robustez das 13 regras poderiam ter sido superiores.
* **Ação Automática:** Registra uma nova hipótese de auto-evolução em `docs/IDEAS.md` (sob a categoria `REFLEXIVE-AGENT-EVOLUTION`), submetendo melhorias nos arquivos em `/agents` à revisão crítica adversária de `revisor.md`.

---

## 3. Os 6 Loops Autônomos de Governança

Cada agente opera dentro de um ou mais loops contínuos:

```text
1. LOOP SEGURANÇA (DevSecOps + Revisor):
   → detectar (SAST / SCA / CodeQL / TruffleHog)
   → priorizar (Matriz de Severidade)
   → corrigir na raiz (sanitização recursiva, sem ReDoS)
   → validar com testes de invasão negativos
   → documentar e atualizar ledgers

2. LOOP QUALIDADE (Melhoria Contínua + Revisor):
   → medir complexidade e cobertura de testes
   → identificar duplicações e code smells
   → refatorar mantendo compatibilidade
   → testar regressões
   → registrar ganhos em CALCULATIONS.md

3. LOOP ARQUITETURA (Staff Engineer + Mestre):
   → avaliar trade-offs técnicos
   → modularizar e desacoplar
   → redigir ADR (Architecture Decision Record)
   → sincronizar com a documentação corporativa

4. LOOP DEVOPS (SRE + DevSecOps):
   → monitorar probes de saúde (/health) e métricas (/metrics)
   → otimizar esteiras CI/CD e caching
   → automatizar verificações pré-commit e pré-push
   → aplicar auto-remediação de infraestrutura

5. LOOP PRODUTIVIDADE (Agile Coach + Mestre):
   → identificar gargalos de processo
   → sugerir automações de fluxo
   → garantir Tríplice Registro contínuo (Git, Tickets e Wiki)
   → erradicar retrabalho

6. LOOP AUTO-EVOLUÇÃO REFLEXIVA (Suíte Completa):
   → auto-avaliar clareza de prompts e consumo de tokens
   → testar portabilidade cruzada entre LLMs
   → gerar novas ideias de ferramentas em docs/IDEAS.md
   → auditar e refinar os próprios contratos operacionais

7. LOOP FULL DEVELOPER (Modo Opcional de Execução Contínua):
   → selecionar próxima ideia validada do backlog contextual (Regra 14)
   → estudar viabilidade, dependências e impacto arquitetural
   → planejar implementação com testes de regressão
   → codificar em branch dedicada (DevSecOps)
   → submeter a auditoria cega (Revisor Independente)
   → validar esteira CI/CD e scanner de segurança
   → efetuar Tríplice Registro (Git commit/PR, Jira Task, Confluence ADR)
   → encadear automaticamente para a próxima ideia sem interrupção do usuário
```

---

## 4. O Sistema de Memória Imutável

A suíte não depende de memória volátil da sessão. Toda a continuidade operacional é ancorada nos arquivos da pasta `/docs`:
* `STATE.md`: Quadro vivo de execução (Meta ativa, Sprint, Done, Next, Blockers).
* `CHANGELOG.md`: Livro-razão histórico imutável (estritamente append-only).
* `RULES.md`: Contrato normativo de regras inegociáveis.
* `IDEAS.md`: Backlog vivo de inovações da aplicação e de auto-evolução dos agentes.
* `CALCULATIONS.md`: Livro-razão de dimensionamento numérico e benchmarks de tokens/latência.
