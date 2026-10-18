# IDEAS (open, best first, max 10)
- I-10 [CODE] Persistência do buffer histórico de falas em SQLite ou Redis | evidence: bot.js:33 log de falas é resetado em reinício de container | value: histórico resistente a restarts | cost: M
- I-11 [CODE] Diarização avançada e identificação de locutor por Voice Fingerprinting | evidence: bot.js:429 speaking.on agrupa por ID sem biometria acústica | value: precisão em sobreposição de vozes | cost: L
- I-12 [USER] Dashboard Web corporativo em tempo real para monitoramento e telemetria | evidence: bot.js:1285 healthcheck HTTP apenas JSON bruto | value: interface gráfica para stakeholders | cost: M
- I-13 [USER] Tradução simultânea e suporte multilíngue para atas globais (PT/EN/ES) | evidence: bot.js:800 prompt de resumo fixo em português | value: reuniões corporativas internacionais | cost: S
- I-14 [USER] Criação automática de tarefas no Jira a partir de decisões faladas (/jira criar-tarefa) | evidence: bot.js:930 integração Confluence unidirecional | value: conversão de falas em ações no Jira | cost: M
- I-15 [USER] Transmissão de atas técnicas para canais corporativos de Slack e Teams | evidence: bot.js:965 atas enviadas apenas em DM do Discord | value: integração multi-plataforma corporativa | cost: S
- I-16 [RISK] Sistema de vigilância e alertas proativos por palavras-chave críticas de engenharia | evidence: bot.js:390 pipeline filtra ruídos mas não monitora palavras-chave de crise | value: resposta imediata a incidentes | cost: S
