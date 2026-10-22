# 📡 PLAYBOOK DE SRE: TRACING DISTRIBUÍDO COM OPENTELEMETRY & ANÁLISE DE FLAMEGRAPHS

---
playbook: sre-opentelemetry-tracing
versao: 1.0.0
proprietario: Agente SRE & Observabilidade (AGENT_SRE.md)
referencia: AGDEV-24 (I-8) / RFC W3C TraceContext
---

## 🎯 1. OBJETIVO & ESCOPO
Este playbook estabelece o procedimento operacional padrão (SOP) para instrumentação, propagação de contexto de rastreamento distribuído e diagnóstico de latência crítica em requisições lentas (P95/P99) utilizando a especificação **OpenTelemetry (OTel)** e **W3C TraceContext**.

---

## 🌐 2. PADRÃO W3C TRACECONTEXT (`traceparent`)
Toda requisição externa, chamada entre microserviços ou handover entre agentes DEVE propagar o cabeçalho canônico:

```http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              │  └───────────────┬────────────────┘ └───────┬──────┘ └─┬┘
           Versão             Trace ID                   Span ID      Flags (01 = Sampled)
```

1. **Trace ID (16 bytes / 32 hex chars)**: Identificador único global da transação.
2. **Span ID (8 bytes / 16 hex chars)**: Identificador da operação específica em execução.
3. **Parent Span ID**: Vincula a sub-operação à operação chamadora para montagem do DAG de execução.

---

## 🔥 3. ANÁLISE DE FLAMEGRAPHS & GARGALOS (CRITICAL PATH)
A visualização em Flamegraph permite identificar visualmente onde o tempo da requisição foi consumido:

```text
=== FLAMEGRAPH DISTRIBUÍDO [Trace: 6be1fab9a7fb6cef75cb1eb13e532b47] (105ms) ===
[01] █████████ architect_plan (25ms)
[02] ██████████████████████ devsecops_implementation (60ms) [GARGALO: 57%]
[03] █████ revisor_audit (15ms)
[04] ████████████████████████████████████████ user_goal_execution (105ms)
```

### Regras de Classificação de Gargalo:
- **CRÍTICA**: Span individual consome $\ge 70\%$ do tempo total da transação.
- **ALTA**: Span individual consome entre $40\%$ e $69\%$ do tempo total.
- **MÉDIA**: Span individual excede 50ms em chamadas de I/O de banco de dados ou RPCs.

---

## 🛠️ 4. FLUXO OPERACIONAL DE AUTO-REMEDIAÇÃO SRE
Quando o alerta de latência P99 (`LatencyDegradedP99 > 500ms`) for disparado no Prometheus:

1. **Localização do Trace**: Consultar os spans com `status.code === 'ERROR'` ou maior duração no Tempo/Jaeger via `traceId`.
2. **Isolamento de Causa-Raiz (RCA)**:
   - Se o span for de banco de dados (`db.system === 'sqlite' | 'postgres'`): inspecionar queries sem índice ou contenção de lock.
   - Se o span for de LLM (`model.provider === 'openai' | 'groq'`): verificar latência de rede e acionar Circuit Breaker (I-10).
   - Se o span for de compilação ou build: escalonar recursos de CPU/RAM.
3. **Ação Automatizada**:
   - Purgar caches intermediários ou conexões travadas.
   - Registrar incidente rastreável no Jira com o flamegraph ASCII anexado.
