# TranscriBR 🎙️

Bot do Discord que **entra sozinho nas calls de voz e transcreve todo mundo**, postando as falas em tempo real no canal `transcribr-`.

- **100% Compatível com Discord DAVE (E2EE)** (criptografia de ponta a ponta).
- **Voz → Texto ultrarrápido**: Groq Whisper Large-v3 (transcrição em ~0.5s, 100% gratuita).
- **Resumo Inteligente**: `/resumo` com modelos de alta capacidade da Groq (OpenAI GPT-OSS 120B / Qwen).
- **Modo 24/7 na Nuvem (Railway)** ou execução local no Windows.
- **Contexto dinâmico**: detecta quem está na sala para reconhecer nomes e gírias sem censurar palavrões.

---

## 🚀 Como Hospedar 24/7 no Railway (Recomendado)

O Railway mantém o bot online 24 horas por dia sem precisar deixar o computador ligado.

### Passo 1: Subir o código para o seu GitHub
O repositório já está conectado e configurado com a branch `main`:
```bash
git push origin main
```

### Passo 2: Variáveis de Ambiente no Railway
No painel do Railway, clique no serviço e vá na aba **Variables**:

| Variável | Valor | Descrição |
|---|---|---|
| `DISCORD_BOT_TOKEN` | `seu_token_aqui` | Token gerado no Portal do Discord Developer |
| `GROQ_API_KEY` | `sua_chave_groq` | Chave gratuita de <https://console.groq.com/keys> |
| `STT_ORDER` | `groq` | Motor de transcrição (Groq Whisper Large-v3) |

---

## 💻 Como Rodar Localmente no Windows

Se preferir rodar direto no seu computador:

1. Renomeie `.env.example` para `.env` e preencha suas chaves.
2. Dê dois cliques em `instalar_servidor.bat`.
3. Execute `iniciar_servidor.bat` para iniciar o bot.

---

## 💬 Comandos no Discord

| Comando | O que faz |
|---|---|
| `/transcrever` | Inicia/retoma a transcrição na chamada |
| `/parar` | Pausa (o bot sai da call e fica pausado) |
| `/resumo horas:3` | Resume as últimas horas da call e envia na sua DM |
| `/limpar` | Apaga mensagens antigas do canal `transcribr-` |
| `/status` | Mostra o estado atual do bot |

---

## 🔒 Segurança

- O arquivo `.env` nunca deve ser compartilhado ou enviado ao GitHub. Ele já está listado no `.gitignore`.
- No Railway, suas chaves ficam criptografadas na aba **Variables**.
