# 🤖 Diretório de Agentes do TranscriBR (`/agents`)

Este diretório centraliza todas as personas, contratos operacionais, diretrizes de governança e especificações de inteligência artificial autônoma do ecossistema **TranscriBR**.

---

## 📂 Catálogo de Agentes

| Arquivo | Papel / Especialidade | Uso Recomendado |
|---|---|---|
| [`AGENTE_MESTRE_UNIVERSAL.md`](./AGENTE_MESTRE_UNIVERSAL.md) | **Master All-in-One (Plug & Play)** | Arquivo único consolidado pronto para enviar a amigos, colar no chat de qualquer LLM ou importar em Custom GPTs / Claude Projects. |
| [`AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md`](./AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md) | **Staff Engineer & DevSecOps** | Persona completa de engenharia, arquitetura, segurança CodeQL/OWASP, observabilidade e governança com 15 seções de resposta. |
| [`AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md`](./AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md) | **Melhoria Contínua & Auditoria** | Agente focado em refinamento de arquitetura, identificação de débitos técnicos, otimização de testes e excelência de código. |
| [`PROMPT_INSTALACAO_ENTERPRISE.md`](./PROMPT_INSTALACAO_ENTERPRISE.md) | **Prompt Canônico de Instalação (Opção B)** | Prompt exaustivo para ser colado em qualquer LLM, citando cada arquivo e instalando os 4 modos operacionais. |
| [`revisor.md`](./revisor.md) | **Revisor de Código Independente** | Auditor cego e imparcial para revisão estrita de Pull Requests, conformidade de sintaxe e validação de regras. |

---

## 🚀 Como Utilizar em Outras LLMs

### 1. OpenAI ChatGPT / Custom GPTs
1. Abra o ChatGPT e crie um **Custom GPT** ou inicie uma nova conversa.
2. Em **Instructions / System Prompt**, copie e cole o conteúdo integral de [`AGENTE_MESTRE_UNIVERSAL.md`](./AGENTE_MESTRE_UNIVERSAL.md) ou use o prompt de [`PROMPT_INSTALACAO_ENTERPRISE.md`](./PROMPT_INSTALACAO_ENTERPRISE.md).

### 2. Anthropic Claude Projects
1. No **Claude.ai**, crie um novo **Project** chamado `TranscriBR Agent`.
2. Em **Project Instructions**, cole o conteúdo de [`PROMPT_INSTALACAO_ENTERPRISE.md`](./PROMPT_INSTALACAO_ENTERPRISE.md).
3. Em **Project Files**, você pode anexar todos os arquivos deste diretório.

### 3. Cursor & Windsurf
1. Adicione a referência ao agente mestre no seu arquivo `.cursorrules`:
   ```bash
   cat agents/AGENTE_MESTRE_UNIVERSAL.md >> .cursorrules
   ```

### 4. Ollama / DeepSeek Local
1. Crie um `Modelfile`:
   ```dockerfile
   FROM deepseek-r1:32b
   SYSTEM """
   (Cole aqui o conteúdo de agents/AGENTE_MESTRE_UNIVERSAL.md)
   """
   ```
2. Crie e execute o modelo:
   ```bash
   ollama create transcribr-agent -f Modelfile
   ollama run transcribr-agent
   ```

---

## 📦 Geradores de Pacotes Distribuíveis

1. **Pacote ZIP Enterprise (`/agents` + `/docs`):**
   Gera `dist/TRANSCRIBR_ENTERPRISE_AGENTS_PACK.zip` contendo todos os agentes e documentos:
   ```bash
   node scripts/create_enterprise_agents_pack.js
   ```

2. **Bundle Consolidado em 1 Arquivo Markdown:**
   Gera `dist/UNIVERSAL_AGENTS_BUNDLE.md`:
   ```bash
   node scripts/export_agents_bundle.js
   ```

