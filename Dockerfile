FROM node:22-bookworm-slim

# Dependências nativas necessárias para o subsistema de áudio e compilação de pacotes C++ (@snazzah/davey / opus)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências do projeto
COPY package*.json ./
RUN npm install --omit=dev

# Copia os arquivos do projeto
COPY . .

# Modo produção e ordem padrão para nuvem (Groq Whisper ultra-rápido > Gemini como reserva)
ENV NODE_ENV=production
ENV STT_ORDER=groq,gemini

CMD ["npm", "start"]
