# CHANGELOG
2026-10-18 [RULE] @global Todo commit ou alteraÃ§Ã£o tÃ©cnica deve ter trÃ­plice registro em Git, Jira e Confluence | why: governanÃ§a do projeto
2026-10-18 [DECISION] @bot.js AdoÃ§Ã£o de Groq Whisper Large-v3 e GPT-OSS para transcriÃ§Ã£o e atas | why: latÃªncia menor que 500ms e custo zero
2026-10-18 [DONE] @RULES.md InstalaÃ§Ã£o das diretrizes DEV RULES 16.4 e agente revisor independente | why: mentoria, histÃ³rico imutÃ¡vel e revisÃ£o de cÃ³digo
2026-10-18 [DONE] @Jira Sincronização do Kanban (SCRUM): 31 tarefas concluídas e 8 novos itens de backlog criados (SCRUM-44 a SCRUM-51) | why: enriquecimento e governança contínua
2026-10-18 [DONE] @Confluence Atualização canônica das páginas 07. ADRs, 01. Arquitetura e Homepage com novo backlog e status | why: manter bíblia do projeto 100% fiel ao código
2026-10-18 [DECISION] @revisor Relatório do Revisor Independente aprovado com ressalvas: sem regressões de sintaxe, foco em testes unitários para DSP | why: elevar maturidade técnica do ecossistema
2026-10-18 [DONE] @Jira Vinculação de 41 tarefas à Sprint 0 ativa (ID: 2) no Jira Software | why: exibir cards no Quadro ativo (board 1)
2026-10-18 [RULE] @global Instituição da Regra 11 no RULES.md: Tríplice Registro Contínuo Obrigatório (Git, Jira e Confluence) executado a cada passo | why: diretriz explícita de governança contínua
2026-10-18 [DONE] @tests/audio_dsp.test.js Implementação de suíte de testes unitários para DSP (High-Pass, AGC, Silence Trimming, WAV) e utilitários de texto | why: segurança contra regressões no pipeline de áudio (I-3)
2026-10-18 [DONE] @bot.js Aprimoramento de splitMessage com garantia de paridade e reabertura de codeblocks Markdown | why: prevenir quebras visuais em atas técnicas longas no Discord (I-8)
2026-10-18 [DONE] @bot.js Implementação de servidor HTTP de healthcheck (/health) para probes de liveness e métricas de memória no Railway | why: observabilidade e monitoramento contínuo em produção (I-6)
2026-10-18 [DONE] @bot.js Implementação de política de reconexão de voz resiliente com backoff exponencial | why: evitar desconexões permanentes por oscilações transitórias no Discord Voice Gateway (I-7)
2026-10-18 [DONE] @bot.js Módulo de telemetria e métricas de desempenho de transcrição no /status e /health | why: visibilidade de latência média, áudio processado e descarte de ruídos (I-4)
2026-10-18 [DONE] @bot.js Exportação da Ata Técnica e transcrição integral como anexo Markdown (.md) no Discord /resumo | why: download imediato e facilidade de arquivamento institucional (I-5)
2026-10-18 [DONE] @bot.js ImplementaÃ§Ã£o de botÃµes interativos no Discord (ActionRowBuilder/ButtonBuilder) para solicitaÃ§Ã£o de ata com 1 clique | why: facilidade de uso e encerramento guiado de chamadas (I-1)
2026-10-18 [DONE] @bot.js SincronizaÃ§Ã£o automÃ¡tica das atas tÃ©cnicas do /resumo direto no Confluence space TBR via REST API | why: governanÃ§a corporativa e histÃ³rico institucional indexado (I-2)
2026-10-18 [RULE] @Jira Sempre que pegar uma tarefa em 'A fazer' no Kanban, transicionar imediatamente para 'Em andamento' antes de iniciar codificaÃ§Ã£o/testes | why: diretriz explÃ­cita do usuÃ¡rio para visibilidade em tempo real do progresso
