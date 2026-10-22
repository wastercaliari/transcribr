# ⚡ PLAYBOOK DE SRE: CIRCUIT BREAKER INTELIGENTE MULTI-PROVEDOR PARA LLMS

---
playbook: sre-circuit-breaker-llm
versao: 1.0.0
proprietario: Agente SRE & Observabilidade (AGENT_SRE.md)
referencia: AGDEV-9 (I-10) / Padrão de Engenharia de Resiliência Michael Nygard
---

## 🎯 1. OBJETIVO & ESCOPO
Este playbook estabelece a estratégia de continuidade de negócio e tolerância a falhas para agentes de inteligência artificial diante de instabilidades de provedores de LLM externos (erros HTTP 429 - Rate Limit, 503 - Service Unavailable, 504 - Gateway Timeout ou latência excessiva).

---

## 🔄 2. MÁQUINA DE ESTADOS DO CIRCUIT BREAKER (TRANSIÇÃO LINEAR DE FLUXO)

Cada provedor de IA possui seu próprio disjuntor com 3 estados canônicos, operando através de uma sequência linear determinística em texto:

1. **Estado Inicial: CLOSED (Fechado - Operação Normal)**
   - O tráfego de requisições flui normalmente para o provedor primário.
   - Cada chamada bem-sucedida mantém o circuito fechado e zera o contador de erros.
   - Chamadas com falha consecutiva (erros HTTP 429, 500, 502, 503, 504 ou timeout) incrementam o contador.
   - **Gatilho de Transição:** Ao atingir o limite de 3 falhas consecutivas (`failureThreshold >= 3`), o estado transita linearmente para **OPEN**.

2. **Estado de Proteção: OPEN (Aberto - Circuito Rompido)**
   - O tráfego para este provedor é bloqueado de forma imediata (Fail-Fast local), sem efetuar chamadas de rede externas.
   - Toda requisição é desviada instantaneamente para o próximo provedor da cadeia de fallback.
   - Um temporizador de recuperação (`recoveryTimeout`) de 30 segundos é iniciado.
   - **Gatilho de Transição:** Quando o tempo decorrido atinge ou supera 30 segundos (`tempo >= 30s`), o estado avança linearmente para **HALF_OPEN**.

3. **Estado de Sondagem: HALF_OPEN (Meio-Aberto - Teste de Recuperação)**
   - O circuito autoriza uma única requisição de teste para avaliar se o provedor remoto se recuperou da instabilidade.
   - **Bifurcação Linear de Retorno:**
     - **Caso de Sucesso:** Se a requisição de teste for concluída com êxito, o disjuntor é rearmado, o contador de falhas é resetado para zero e o estado retorna para **CLOSED**.
     - **Caso de Falha:** Se a requisição de teste falhar, o disjuntor desarma novamente, o temporizador de cooldown de 30 segundos é reiniciado e o estado retorna para **OPEN**.

---

## ⛓️ 3. CADEIA CANÔNICA DE FALLBACK MULTI-PROVEDOR
A ordem de comutação automática respeita a relação de capacidade, latência e custo:

1. **Primário (Fronteira Analítica)**: Anthropic (`claude-3-5-sonnet`) / OpenAI (`gpt-4o`)
   - Em caso de HTTP 429 ou 5xx após 3 tentativas:
2. **Secundário (Alta Velocidade / Fallback de Fronteira)**: Groq (`llama-3.3-70b-versatile` / `deepseek-r1-distill-llama-70b`)
   - Em caso de falha de conexão:
3. **Terciário (Resiliência Local / Offline)**: Ollama (`qwen2.5-coder:7b` / `llama3.1:8b`)
   - Execução local em hardware do desenvolvedor com o prompt compactado (`AGENT_ORCHESTRATOR_COMPACTO.md`).

---

## 📊 4. OBSERVABILIDADE & ALERTAS PROMETHEUS
O módulo expõe as seguintes métricas canônicas:
- `llm_circuit_breaker_state{provider="anthropic"}`: 0=CLOSED, 1=OPEN, 2=HALF_OPEN
- `llm_circuit_breaker_fallbacks_total{from="anthropic",to="groq"}`: contador acumulado de chaveamentos
- `llm_provider_latency_seconds{provider="groq"}`: histograma de latência

### Alerta SRE: `LLMAllCircuitsOpen`
Se todos os provedores da cadeia estiverem com circuito `OPEN`, o agente emite notificação de severidade CRÍTICA no Jira e ativa o modo local estrito.
