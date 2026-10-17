# TranscriBR 🎙️

Bot do Discord que **entra sozinho nas calls de voz e transcreve todo mundo**, postando as falas em tempo real no canal `transcribr-`.

- **100% Compatível com Discord DAVE (E2EE)** (criptografia de ponta a ponta).
- **Voz → Texto inteligente**: Groq Whisper Large-v3 (ultra-rápido ~0.5s e grátis) + Gemini como reserva e resumos `/resumo`.
- **Modo 24/7 na Nuvem (Railway)** ou execução local no Windows.
- **Contexto dinâmico**: detecta quem está na sala para reconhecer nomes e gírias sem censurar palavrões.

---

## 🚀 Como Hospedar 24/7 no Railway (Recomendado)

O Railway mantém o bot online 24 horas por dia sem precisar deixar o computador ligado.

### Passo 1: Subir o código para o seu GitHub
1. Crie um repositório vazio no seu [GitHub](https://github.com/new) (exemplo: `transcribr`).
2. No terminal desta pasta, adicione o repositório remoto e envie o código:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/transcribr.git
   git push -u origin main
   ```

### Passo 2: Criar o Projeto no Railway
1. Acesse o [Railway.app](https://railway.app) e faça login com seu GitHub.
2. Clique em **+ New Project** → **Deploy from GitHub repo**.
3. Selecione o repositório `transcribr`.
4. O Railway usará automaticamente o `Dockerfile` incluído no projeto.

### Passo 3: Configurar as Variáveis de Ambiente
No painel do Railway, clique no serviço criado, vá na aba **Variables** e adicione:

| Variável | Valor | Descrição |
|---|---|---|
| `DISCORD_BOT_TOKEN` | `seu_token_aqui` | Token gerado no Portal do Discord Developer |
| `GROQ_API_KEY` | `sua_chave_groq` | Chave gratuita de <https://console.groq.com/keys> |
| `GEMINI_API_KEY` | `sua_chave_gemini` | Chave gratuita de <https://aistudio.google.com/apikey> |
| `STT_ORDER` | `groq,gemini` | Ordem dos motores na nuvem (super leve e rápido) |

Pronto! O Railway fará o deploy e o bot ficará **online 24/7** imediatamente.

---

## 💻 Como Rodar Localmente no Windows

Se preferir rodar direto no seu computador:

1. Renomeie `.env.example` para `.env` e preencha suas chaves.
2. Dê dois cliques em `instalar_servidor.bat` (ele instala Node.js, dependências e dependências de áudio).
3. Execute `iniciar_servidor.bat` para iniciar o bot.

---

## 💬 Comandos no Discord

| Comando | O que faz |
|---|---|
| `/transcrever` | Inicia/retoma a transcrição na chamada |
| `/parar` | Pausa (o bot sai da call e fica pausado) |
| `/resumo horas:3` | Resume as últimas horas da call e envia na sua DM via Gemini |
| `/limpar` | Apaga mensagens antigas do canal `transcribr-` |
| `/status` | Mostra o estado atual do bot e motores ativos |

---

## 🔒 Segurança

- O arquivo `.env` nunca deve ser compartilhado ou enviado ao GitHub. Ele já está listado no `.gitignore`.
- No Railway, suas chaves ficam criptografadas na aba **Variables**.
