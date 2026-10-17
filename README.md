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

## 🚀 Como Hospedar 24/7 na Nuvem (Railway) - Recomendado

A maneira mais prática de deixar o bot online 24 horas por dia sem precisar deixar o seu computador ligado:

### Passo a Passo:
1. Faça um **Fork** deste repositório para a sua conta do GitHub (botão **Fork** no topo direito).
2. Acesse o **[Railway.app](https://railway.app)** e faça login com o seu GitHub.
3. Clique em **+ New Project** → **Deploy from GitHub repo** e selecione o repositório `transcribr`.
4. Assim que o projeto carregar, clique no serviço dele no painel e vá na aba **Variables**.
5. Adicione as 3 variáveis abaixo clicando em **Add Variable**:

| Nome da Variável | O que colar | Descrição |
|---|---|---|
| `DISCORD_BOT_TOKEN` | *(seu token do Discord)* | Token copiado no Discord Developer Portal |
| `GROQ_API_KEY` | `gsk_...` | Chave copiada no Console da Groq |
| `STT_ORDER` | `groq` | Define o motor de voz como Groq Whisper |

6. O Railway fará o build do container automaticamente em menos de 1 minuto e seu bot ficará **online imediatamente 24/7**!

---

## 💻 Como Rodar Localmente no seu Computador

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
| `/resumo horas:3` | Gera um resumo estruturado com tópicos e decisões das últimas horas e envia na sua DM. |
| `/limpar` | Apaga o histórico de transcrições do canal `transcribr-` *(requer permissão de Gerenciar Mensagens)*. |
| `/status` | Exibe se o bot está ativo, pausado e quais motores estão conectados. |

---

## 🎯 Melhorando a Precisão da Transcrição

- **Vocabulário Personalizado (`vocabulario.txt`):** Adicione gírias, nomes dos seus amigos e termos técnicos em `vocabulario.txt` (um por linha). O Whisper usará essa lista como prioridade fonética sem você precisar reiniciar o bot.
- **Dicionário Fonético (`corrections.json`):** Caso o Whisper confunda termos específicos com palavras parecidas, adicione pares `"errado": "correto"` em `corrections.json`.

---

## 🔒 Segurança

- O arquivo `.env` com suas chaves privadas está listado no `.gitignore` e **nunca é versionado ou exposto**.
- No Railway, todas as suas variáveis de ambiente ficam criptografadas na aba **Variables**.
