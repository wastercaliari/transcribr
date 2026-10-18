# TranscriBR 🎙️

Bot do Discord para **transcrição de voz em tempo real e resumos inteligentes com IA**, que entra sozinho nas chamadas e posta tudo no chat de texto.

- **100% Compatível com Discord DAVE (E2EE)** (suporte nativo à criptografia de ponta a ponta do Discord).
- **Voz → Texto ultrarrápido**: Groq Whisper Large-v3 (resposta em ~0.5s, 100% gratuito).
- **Resumo Automático de Reuniões**: O comando `/resumo` sintetiza tópicos, decisões e combinados via LLM de alta capacidade (OpenAI GPT-OSS 120B / Qwen na Groq).
- **Sem Censura e Contextual**: Não censura palavrões nem gírias e aprende os apelidos das pessoas na sala via `vocabulario.txt`.
- **Hospedagem 24/7 na Nuvem**: Pronto para rodar com 1 clique no Railway com consumo mínimo (~80MB de RAM).

---

## 📋 Pré-requisitos (Obtendo suas chaves gratuitas)

Você precisará de apenas **2 coisas gratuitas** antes de iniciar:

### 1. Criar o Bot no Discord Developer Portal
1. Acesse o **[Discord Developer Portal](https://discord.com/developers/applications)** e clique em **New Application** (dê o nome de *TranscriBR* ou o nome que desejar).
2. No menu lateral esquerdo, vá em **Bot**:
   - Clique em **Reset Token** e copie o seu **Token** (guarde-o, ele será o seu `DISCORD_BOT_TOKEN`).
   - Na seção **Privileged Gateway Intents**, ative as opções:
     - ✅ **Message Content Intent** (se disponível)
3. No menu lateral esquerdo, vá em **OAuth2** → **URL Generator**:
   - Em **Scopes**, marque: `bot` e `applications.commands`.
   - Em **Bot Permissions**, marque:
     - `View Channels` (Ver canais)
     - `Send Messages` (Enviar mensagens)
     - `Manage Messages` (Gerenciar mensagens — para o comando `/limpar`)
     - `Read Message History` (Ver histórico de mensagens)
     - `Connect` (Conectar)
     - `Speak` (Falar)
4. Copie a **URL gerada no final da página**, cole no seu navegador e convide o bot para o seu servidor Discord.
5. No seu servidor Discord, crie um canal de texto chamado **`transcribr-`** (é nele que o bot enviará as transcrições).

### 2. Obter a Chave Gratuita da Groq
1. Acesse o **[Groq Cloud Console](https://console.groq.com/keys)** e faça login com sua conta Google ou GitHub.
2. Clique em **Create API Key**, dê um nome e copie a chave gerada (ela começa com `gsk_...`).
   *(Essa chave gratuita cobre tanto a transcrição do Whisper quanto os resumos do `/resumo`).*

---

## 🌐 Onde Hospedar? (Total Liberdade)

O TranscriBR é **100% agnóstico de infraestrutura**. Ele roda empacotado em **Node.js** e conta com um **`Dockerfile` otimizado** pronto para uso. Você pode hospedá-lo onde achar melhor:

- ☁️ **Serviços de Nuvem / PaaS:** [Railway](https://railway.app), [Render](https://render.com), [Fly.io](https://fly.io), [Koyeb](https://koyeb.com), etc.
- 🖥️ **VPS / Servidores Dedicados:** Oracle Cloud (Free Tier), DigitalOcean, Hetzner, AWS, Google Cloud, Azure, etc.
- 🐳 **Docker / Docker Compose:** No seu próprio servidor caseiro (Homelab, Raspberry Pi, Unraid, TrueNAS).
- 💻 **No seu próprio PC:** Rodando localmente em segundo plano (Windows, Linux ou macOS).

Basta apenas que o ambiente tenha as **variáveis de ambiente configuradas** (`DISCORD_BOT_TOKEN`, `GROQ_API_KEY` e `STT_ORDER=groq`).

---

## 🚀 Opção 1: Hospedagem 24/7 na Nuvem (Exemplo: Railway)

O Railway é uma das formas mais simples e rápidas para deixar o bot online 24/7 sem precisar manter o PC ligado:

### Passo a Passo no Railway:
1. Faça um **Fork** deste repositório para a sua conta do GitHub (botão **Fork** no topo direito).
2. Acesse o **[Railway.app](https://railway.app)** e faça login com o seu GitHub.
3. Clique em **+ New Project** → **Deploy from GitHub repo** e selecione o repositório `transcribr`.
4. Assim que o projeto carregar, clique no serviço dele no painel e vá na aba **Variables**.
5. Adicione as variáveis abaixo clicando em **Add Variable**:

| Nome da Variável | O que colar | Descrição |
|---|---|---|
| `DISCORD_BOT_TOKEN` | *(seu token do Discord)* | Token copiado no Discord Developer Portal |
| `GROQ_API_KEY` | `gsk_...` | Chave copiada no Console da Groq |
| `STT_ORDER` | `groq` | Define o motor de voz como Groq Whisper |

6. O Railway fará o build do container automaticamente e seu bot ficará **online imediatamente 24/7**!

*(Caso use Render, Fly.io ou outra nuvem, o processo é idêntico: conecte o repositório GitHub e insira as mesmas 3 variáveis de ambiente nas configurações do serviço).*

---

## 💻 Opção 2: Hospedagem em VPS, Servidor Linux ou Docker

Se você tem uma **VPS** (como Ubuntu/Debian) ou usa **Docker**:

### Usando Docker:
```bash
# 1. Clone o repositório
git clone https://github.com/SEU_USUARIO/transcribr.git
cd transcribr

# 2. Crie o arquivo .env com suas chaves (baseado no .env.example)
cp .env.example .env
# edite o .env com seu editor preferido (nano .env)

# 3. Construa e suba o container em background:
docker build -t transcribr .
docker run -d --name transcribr --restart always --env-file .env transcribr
```

---

## 🖥️ Opção 3: Como Rodar Localmente no seu Computador

Se preferir rodar direto na sua máquina (Windows ou Linux):

1. Clone o repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/transcribr.git
   cd transcribr
   ```
2. Crie uma cópia do arquivo `.env.example` com o nome de `.env`:
   - No Windows: `copy .env.example .env`
   - No Linux/Mac: `cp .env.example .env`
3. Abra o arquivo `.env` com qualquer editor de texto e preencha suas chaves:
   ```env
   DISCORD_BOT_TOKEN=seu_token_do_discord_aqui
   GROQ_API_KEY=sua_chave_groq_aqui
   STT_ORDER=groq
   ```
4. Instale as dependências e inicie o bot:
   ```bash
   npm install
   npm start
   ```
   *(No Windows, você também pode simplesmente dar dois cliques em `iniciar_servidor.bat`).*

---

## 💬 Comandos Disponíveis no Discord

| Comando | Descrição |
|---|---|
| `/transcrever` | Faz o bot entrar na sua chamada de voz atual e começar a transcrever. |
| `/parar` | Pausa a transcrição e faz o bot sair da call. |
| `/resumo [horas] [minutos] [segundos]` | Gera uma **Ata Técnica** estruturada na sua DM com visão geral, arquitetura/ferramentas citadas, impedimentos e decisões técnicas tomadas na janela de tempo informada. |
| `/limpar` | Apaga o histórico de transcrições do canal `transcribr-` *(requer permissão de Gerenciar Mensagens)*. |
| `/status` | Exibe se o bot está ativo, pausado e quais motores estão conectados. |

### 💡 Exemplos do `/resumo`:
- `/resumo segundos:90` — Ata técnica dos últimos 90 segundos.
- `/resumo minutos:30` — Ata técnica estruturada dos últimos 30 minutos de call.
- `/resumo horas:2` — Ata técnica completa das últimas 2 horas de reunião.
- `/resumo horas:1 minutos:30` — Ata técnica de 1 hora e meia.

---

## 🎯 Melhorando a Precisão da Transcrição

- **Vocabulário Personalizado (`vocabulario.txt`):** Adicione gírias, nomes dos seus amigos e termos técnicos em `vocabulario.txt` (um por linha). O Whisper usará essa lista como prioridade fonética sem você precisar reiniciar o bot.
- **Dicionário Fonético (`corrections.json`):** Caso o Whisper confunda termos específicos com palavras parecidas, adicione pares `"errado": "correto"` em `corrections.json`.

---

## 🔒 Segurança

- O arquivo `.env` com suas chaves privadas está listado no `.gitignore` e **nunca é versionado ou exposto**.
- No Railway, todas as suas variáveis de ambiente ficam criptografadas na aba **Variables**.
