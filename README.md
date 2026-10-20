<div align="center">

# TranscriBR 🎙️

**Bot corporativo para Discord de transcrição de voz em tempo real e geração de atas técnicas com IA.**  
Entra automaticamente nas chamadas de voz com suporte nativo à criptografia **Discord DAVE (E2EE)** e entrega atas detalhadas, áudios consolidados e métricas com custo zero de infraestrutura de inteligência artificial.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![Groq Cloud](https://img.shields.io/badge/Groq_Whisper-Large--v3-F55036?logo=fastapi&logoColor=white)](https://groq.com)
[![DAVE Protocol](https://img.shields.io/badge/Discord-DAVE_E2EE-blue)](https://discord.com)
[![DevSecOps CI](https://github.com/wastercaliari/transcribr/actions/workflows/ci.yml/badge.svg)](https://github.com/wastercaliari/transcribr/actions)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Recursos](#-principais-recursos) •
[Quickstart](#-quickstart-em-3-minutos) •
[Como Configurar](#-passo-a-passo-de-configura%C3%A7%C3%A3o) •
[Comandos](#-comandos-slash-do-discord) •
[Onde Hospedar](#-onde-e-como-hospedar) •
[Dashboard & Métricas](#-web-dashboard--observabilidade) •
[Troubleshooting](#-solu%C3%A7%C3%A3o-de-problemas-troubleshooting)

---

</div>

## ✨ Principais Recursos

- 🔒 **100% Compatível com Discord DAVE (E2EE)**: Suporte nativo ao protocolo de criptografia de ponta a ponta do Discord via `@snazzah/davey`.
- ⚡ **Voz para Texto Ultrarrápido (~500ms)**: Processamento pelo Whisper Large-v3 na infraestrutura LPU da Groq Cloud (100% gratuito, sem fila).
- 🧠 **Atas Técnicas Inteligentes (`/resumo`)**: Geração de atas ricas em markdown na sua DM, com ranking exato de participação, linha do tempo detalhada e compromissos acordados.
- 🛡️ **Anti-Alucinação Factual (SCRUM-76)**: Persistência de blocos de 50 falas no SQLite ancorando datas, horários e autores reais no prompt da LLM.
- 🎙️ **Exportação de Áudio Consolidado (`/audio`)**: Download de áudio unificado WAV PCM 16kHz mono pós-reunião para auditoria ou escuta.
- 🌐 **Dashboard Web Executivo**: Interface gráfica em tempo real em `http://localhost:8080/dashboard` para inspeção de falas e métricas.
- 📈 **Observabilidade Prometheus**: Endpoint `/metrics` no padrão canônico OpenMetrics para integração imediata com Grafana.
- 🎯 **Vocabulário Personalizado & Filtro Fonético**: Aprende os apelidos e gírias da equipe sem censura via `vocabulario.txt` e `corrections.json`.
- 🌍 **Suporte Multilíngue**: Atas geradas em português, inglês, espanhol ou formato bilíngue corporativo (`/resumo idioma:en`).
- 💼 **Integrações Enterprise**: Sincronização automática com Atlassian Confluence, criação de tarefas no Jira (`/jira`), Slack e Microsoft Teams.

---

## ⚡ Quickstart em 3 Minutos

Se você já possui o **Node.js (versão 20 ou superior)** instalado:

```bash
# 1. Clone o repositório
git clone https://github.com/wastercaliari/transcribr.git
cd transcribr

# 2. Copie o arquivo de exemplo e instale as dependências
cp .env.example .env
npm install

# 3. Preencha apenas DISCORD_BOT_TOKEN e GROQ_API_KEY no .env, e inicie:
npm start
```

> **Usuários do Windows:** Você também pode simplesmente dar um duplo clique em [`iniciar_servidor.bat`](./iniciar_servidor.bat), que cuidará da instalação e execução automaticamente.

---

## 🔑 Passo a Passo de Configuração

Para rodar o bot no seu próprio servidor Discord, você precisará de apenas **2 chaves gratuitas**:

### 1. Criar o Bot no Discord Developer Portal

1. Acesse o **[Discord Developer Portal](https://discord.com/developers/applications)** e clique em **New Application**.
2. Dê um nome à aplicação (ex.: `TranscriBR`) e confirme.
3. No menu lateral esquerdo, navegue até **Bot**:
   - Clique em **Reset Token**, copie o token exibido e cole-o no campo `DISCORD_BOT_TOKEN` do seu arquivo `.env`.
   - Role até a seção **Privileged Gateway Intents** e marque obrigatoriamente:
     - ✅ **Message Content Intent** (essencial para leitura dos comandos e alertas).
4. No menu lateral esquerdo, vá em **OAuth2** → **URL Generator**:
   - Em **Scopes**, selecione:
     - `bot`
     - `applications.commands`
   - Em **Bot Permissions**, marque:
     - `View Channels` (Ver canais)
     - `Send Messages` (Enviar mensagens)
     - `Manage Messages` (Gerenciar mensagens — para o comando `/limpar`)
     - `Attach Files` (Anexar arquivos — para envio de atas .md e áudios .wav)
     - `Read Message History` (Ver histórico de mensagens)
     - `Connect` (Conectar em canais de voz)
     - `Speak` (Falar)
5. **Link Rápido de Convite:** Você pode substituir `SEU_CLIENT_ID` (encontrado em *OAuth2* -> *Client ID*) na URL abaixo e abrir no navegador para convidar o bot:
   ```text
   https://discord.com/oauth2/authorize?client_id=SEU_CLIENT_ID&permissions=3148864&scope=bot%20applications.commands
   ```
6. No seu servidor Discord, crie um canal de texto chamado **`transcribr-`** (caso você dê permissão de gerenciar canais ao bot, ele mesmo criará o canal se ele não existir).

---

### 2. Obter a Chave Gratuita da Groq Cloud

1. Acesse o **[Groq Cloud Console](https://console.groq.com/keys)** e faça login gratuitamente com sua conta Google ou GitHub.
2. Clique no botão **Create API Key**, insira um identificador qualquer e copie a chave gerada (iniciada por `gsk_...`).
3. Cole a chave no campo `GROQ_API_KEY` do seu arquivo `.env`.

> 💡 **Nota:** A Groq disponibiliza uma cota gratuita generosa com capacidade de sobra para transcrição contínua em tempo real (Whisper Large-v3) e geração de resumos longos com LLMs de última geração (GPT-OSS 120B / Llama 3.3). Não é necessário cadastrar cartão de crédito.

---

## 💬 Comandos Slash do Discord

Todos os comandos são integrados nativamente com a interface de Slash Commands do Discord:

| Comando | Descrição | Exemplo de Uso |
|---|---|---|
| `/transcrever` | Conecta o bot à sua chamada de voz atual e inicia a transcrição contínua. | `/transcrever` |
| `/parar` | Pausa a escuta do bot e faz com que ele se desconecte do canal de voz. | `/parar` |
| `/resumo` | Gera e envia na sua DM uma **Ata Técnica de Engenharia** completa com linha do tempo de blocos de 50 falas, decisões e arquivo `.md` anexado. | `/resumo minutos:30`<br>`/resumo horas:1 minutos:15`<br>`/resumo minutos:45 idioma:en` |
| `/audio` | Exporta e anexa no chat o arquivo `.wav` consolidado e sincronizado da conversa. | `/audio minutos:30` |
| `/jira criar-tarefa` | Transforma decisões verbais da chamada em tarefas formais no Jira Cloud. | `/jira criar-tarefa titulo:Refatorar cache` |
| `/status` | Exibe painel em tempo real de saúde, motores STT conectados, biometria e CPU. | `/status` |
| `/limpar` | Apaga o histórico de mensagens do canal `transcribr-` com segurança. | `/limpar` |

### Parâmetros Suportados no `/resumo`:
- `horas`: Quantidade de horas anteriores a incluir no escopo da ata.
- `minutos`: Quantidade de minutos anteriores a incluir.
- `segundos`: Quantidade de segundos anteriores (ex.: `segundos:90` para alinhamento rápido).
- `idioma`: Idioma desejado para a ata (`pt` = Português, `en` = Inglês, `es` = Espanhol, `bilingual` = Formato executivo bilíngue).

---

## 🌐 Onde e Como Hospedar

O TranscriBR é completamente agnóstico de infraestrutura e consome menos de 90 MB de memória RAM.

### Opção 1: Rodando Localmente no Computador

- **Windows:** Dê duplo clique em [`iniciar_servidor.bat`](./iniciar_servidor.bat). O script valida os pré-requisitos, instala o necessário e possui loop de auto-reconexão caso o bot seja reiniciado.
- **Linux / macOS:**
  ```bash
  npm start
  # Ou em background com PM2:
  npm install -g pm2
  pm2 start bot.js --name transcribr
  ```

---

### Opção 2: Deploy 24/7 na Nuvem com 1 Clique (Railway)

O [Railway](https://railway.app) é a forma recomendada para manter o bot operando 24 horas por dia:

1. Faça um **Fork** deste repositório para o seu GitHub.
2. No [Railway](https://railway.app), clique em **New Project** → **Deploy from GitHub repo** e selecione o `transcribr`.
3. No painel do serviço no Railway, abra a aba **Variables** e configure:
   - `DISCORD_BOT_TOKEN`: Seu token do bot no Discord.
   - `GROQ_API_KEY`: Sua chave `gsk_...` da Groq.
   - `STT_ORDER`: `groq`
4. *(Opcional)* Na aba **Settings** → **Volumes**, adicione um volume persistente montado em `/app/data` para que o banco SQLite (`transcribr.sqlite`) mantenha o histórico entre deploys.

---

### Opção 3: Usando Docker e Docker Compose

O repositório já inclui um [`Dockerfile`](./Dockerfile) otimizado baseado em Node.js Alpine:

```bash
# Execução direta com Docker
docker build -t transcribr .
docker run -d --name transcribr --restart always --env-file .env -v $(pwd)/data:/app/data -p 8080:8080 transcribr
```

Ou usando o stack de observabilidade com Prometheus e Grafana:
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

---

## 📊 Web Dashboard & Observabilidade

Assim que o TranscriBR inicia, um servidor HTTP embutido fica disponível na porta `PORT` (padrão: `8080`):

- 🖥️ **Web Dashboard:** `http://localhost:8080/dashboard` — Acompanhe falas recentes, latência média do Whisper, perfis biométricos e estatísticas operacionais.
- 📈 **Métricas Prometheus:** `http://localhost:8080/metrics` — Exportação no formato canônico OpenMetrics 0.0.4 para scraping pelo Prometheus/Grafana.
- 🩺 **Healthcheck:** `http://localhost:8080/health` — Probes de liveness e readiness para Kubernetes, Railway e Docker.

---

## 🎯 Personalização de Vocabulário e Termos Técnicos

- **Vocabulário Ativo ([`vocabulario.txt`](./vocabulario.txt)):** Adicione nomes de membros da equipe, apelidos, gírias e jargões da sua empresa (um por linha). O Whisper prioriza esses termos foneticamente sem precisar reiniciar o bot.
- **Dicionário de Correções ([`corrections.json`](./corrections.json)):** Mapeie correções automáticas para palavras frequentemente confundidas pelo reconhecimento de voz:
  ```json
  {
    "micro servicos": "microsserviços",
    "git hub": "GitHub"
  }
  ```

---

## 🔧 Solução de Problemas (Troubleshooting)

<details>
<summary><strong>1. O bot entra na chamada de voz, mas não envia nada no canal de texto</strong></summary>

- Certifique-se de que no [Discord Developer Portal](https://discord.com/developers/applications) o **Message Content Intent** está ativado na aba **Bot**.
- Verifique se o canal de texto se chama exatamente `transcribr-` ou se o bot possui a permissão de **Enviar Mensagens** e **Ver Canais** nele.
</details>

<details>
<summary><strong>2. O bot não reconhece comandos de barra (/resumo, /transcrever)</strong></summary>

- Certifique-se de que ao convidar o bot você selecionou os scopes `bot` e `applications.commands`.
- Aguarde até 2 minutos para que o Discord indexe os comandos slash globalmente ou convide o bot novamente usando a URL recomendada neste guia.
</details>

<details>
<summary><strong>3. O bot desconectou ou parou por erro de configuração</strong></summary>

- No Windows, execute [`diagnostico.bat`](./diagnostico.bat) ou `powershell -File diagnostico.ps1` para gerar um relatório completo de conectividade e dependências.
</details>

---

## 📂 Estrutura do Repositório

```text
├── agents/            # Contratos de governança e personas de IA (AGENTE_MESTRE_UNIVERSAL.md)
├── docs/              # Normas de engenharia (RULES.md), CHANGELOG, STATE e decisões (ADRs)
├── src/               # Módulos de engenharia (DSP, áudio WAV, SQLite, webhooks e métricas)
├── tests/             # Bateria automatizada de 152 testes unitários e de integração
├── monitoring/        # Dashboards Grafana IaC e alertas Prometheus
├── scripts/           # Ferramentas operacionais e automações Git-Jira-Confluence
├── bot.js             # Núcleo de execução do bot Discord
├── Dockerfile         # Container corporativo multi-stage
└── .env.example       # Modelo de variáveis de ambiente documentado
```

---

## Stack & Versions
- node@20, discord.js@14, @snazzah/davey@0.1, @discordjs/voice@0.19


## Commands
check: node --check bot.js && node --test tests/*.test.js
session_limit: 20
