# IDEAS (open, best first, max 10)
- I-1 [USER] Botão interativo no Discord para solicitar ata técnica (/resumo) com 1 clique | evidence: bot.js:848 | value: acesso imediato sem digitar comando | cost: S
- I-2 [CODE] Sincronização automática das atas do /resumo direto no Confluence | evidence: bot.js:820 resumo enviado apenas em DM | value: histórico corporativo compartilhado | cost: M
- I-3 [RISK] Suíte de testes unitários automatizados para o pipeline DSP e áudio | evidence: ausência de testes em bot.js:163-214 | value: prevenção de regressões em áudio | cost: S
- I-4 [SPEED] Módulo de telemetria e métricas de desempenho de transcrição | evidence: bot.js:418 log pontual sem agregações | value: visibilidade operacional 24/7 | cost: M
- I-5 [USER] Exportar Ata Técnica como anexo Markdown (.md) ou PDF no Discord | evidence: bot.js:821 particionamento de texto longo | value: leitura e arquivamento formal | cost: S
- I-6 [SPEED] Servidor HTTP de healthcheck (/health) para probes de liveness no Railway | evidence: README.md:9 | value: monitoramento proativo de disponibilidade | cost: S
- I-7 [RISK] Resiliência a reconexão de voz contra instabilidade de WebSocket do Discord | evidence: bot.js:488-503 reconexão básica | value: estabilidade contínua sem quedas | cost: M
- I-8 [CODE] Aprimorar splitMessage para fechar e reabrir codeblocks em mensagens > 1900 chars | evidence: bot.js:599 | value: integridade visual de formatação no Discord | cost: S
