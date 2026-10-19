# CHANGELOG
2026-10-18 [RULE] @global Todo commit ou altera√ß√£o t√©cnica deve ter tr√≠plice registro em Git, Jira e Confluence | why: governan√ßa do projeto
2026-10-18 [DECISION] @bot.js Ado√ß√£o de Groq Whisper Large-v3 e GPT-OSS para transcri√ß√£o e atas | why: lat√™ncia menor que 500ms e custo zero
2026-10-18 [DONE] @RULES.md Instala√ß√£o das diretrizes DEV RULES 16.4 e agente revisor independente | why: mentoria, hist√≥rico imut√°vel e revis√£o de c√≥digo
2026-10-18 [DONE] @Jira SincronizaÁ„o do Kanban (SCRUM): 31 tarefas concluÌdas e 8 novos itens de backlog criados (SCRUM-44 a SCRUM-51) | why: enriquecimento e governanÁa contÌnua
2026-10-18 [DONE] @Confluence AtualizaÁ„o canÙnica das p·ginas 07. ADRs, 01. Arquitetura e Homepage com novo backlog e status | why: manter bÌblia do projeto 100% fiel ao cÛdigo
2026-10-18 [DECISION] @revisor RelatÛrio do Revisor Independente aprovado com ressalvas: sem regressıes de sintaxe, foco em testes unit·rios para DSP | why: elevar maturidade tÈcnica do ecossistema
2026-10-18 [DONE] @Jira VinculaÁ„o de 41 tarefas ‡ Sprint 0 ativa (ID: 2) no Jira Software | why: exibir cards no Quadro ativo (board 1)
2026-10-18 [RULE] @global InstituiÁ„o da Regra 11 no RULES.md: TrÌplice Registro ContÌnuo ObrigatÛrio (Git, Jira e Confluence) executado a cada passo | why: diretriz explÌcita de governanÁa contÌnua
2026-10-18 [DONE] @tests/audio_dsp.test.js ImplementaÁ„o de suÌte de testes unit·rios para DSP (High-Pass, AGC, Silence Trimming, WAV) e utilit·rios de texto | why: seguranÁa contra regressıes no pipeline de ·udio (I-3)
2026-10-18 [DONE] @bot.js Aprimoramento de splitMessage com garantia de paridade e reabertura de codeblocks Markdown | why: prevenir quebras visuais em atas tÈcnicas longas no Discord (I-8)
2026-10-18 [DONE] @bot.js ImplementaÁ„o de servidor HTTP de healthcheck (/health) para probes de liveness e mÈtricas de memÛria no Railway | why: observabilidade e monitoramento contÌnuo em produÁ„o (I-6)
2026-10-18 [DONE] @bot.js ImplementaÁ„o de polÌtica de reconex„o de voz resiliente com backoff exponencial | why: evitar desconexıes permanentes por oscilaÁıes transitÛrias no Discord Voice Gateway (I-7)
2026-10-18 [DONE] @bot.js MÛdulo de telemetria e mÈtricas de desempenho de transcriÁ„o no /status e /health | why: visibilidade de latÍncia mÈdia, ·udio processado e descarte de ruÌdos (I-4)
2026-10-18 [DONE] @bot.js ExportaÁ„o da Ata TÈcnica e transcriÁ„o integral como anexo Markdown (.md) no Discord /resumo | why: download imediato e facilidade de arquivamento institucional (I-5)
2026-10-18 [DONE] @bot.js Implementa√ß√£o de bot√µes interativos no Discord (ActionRowBuilder/ButtonBuilder) para solicita√ß√£o de ata com 1 clique | why: facilidade de uso e encerramento guiado de chamadas (I-1)
2026-10-18 [DONE] @bot.js Sincroniza√ß√£o autom√°tica das atas t√©cnicas do /resumo direto no Confluence space TBR via REST API | why: governan√ßa corporativa e hist√≥rico institucional indexado (I-2)
2026-10-18 [RULE] @Jira Sempre que pegar uma tarefa em 'A fazer' no Kanban, transicionar imediatamente para 'Em andamento' antes de iniciar codifica√ß√£o/testes | why: diretriz expl√≠cita do usu√°rio para visibilidade em tempo real do progresso
2026-10-18 [DONE] @bot.js Fixa√ß√£o de canal de voz (state.targetChannels) e elimina√ß√£o de race condition em reconex√£o de voz | why: impedir que o bot migre indevidamente para outras calls com mais participantes (SCRUM-52)
2026-10-18 [DONE] @Jira Cria√ß√£o do Quadro Kanban "Ideias & Sugest√µes" (Board ID: 2), cria√ß√£o de 3 novos status de ciclo de vida e cadastro de 8 novas ideias (SCRUM-53 a SCRUM-60) | why: esteira cont√≠nua de inova√ß√£o e idea√ß√£o solicitada pelo usu√°rio
2026-10-18 [RULE] @git Estrat√©gia de branches por card do Jira (<tipo>/<TICKET>-<desc>) e vincula√ß√£o autom√°tica de commits e branches no Jira via hook post-commit | why: rastreabilidade total do desenvolvimento de ponta a ponta solicitada pelo usu√°rio
2026-10-18 [DONE] @scripts/link_jira_github.js Implementa√ß√£o de script e hook post-commit para vincula√ß√£o autom√°tica de commits e branches do GitHub nos cards do Jira via Remote Links API | why: automa√ß√£o do hist√≥rico Git no Atlassian
2026-10-18 [DONE] @github Sincroniza√ß√£o e publica√ß√£o de 48 branches dedicadas (<tipo>/<TICKET>-<desc>) no GitHub origin | why: rastreabilidade e hist√≥rico nativo por ticket no Jira
2026-10-18 [DONE] @Jira Vincula√ß√£o completa de 48 cards (SCRUM-5 a SCRUM-52) com branches e commits via GitHub for Atlassian e Remote Links API | why: indexa√ß√£o nativa no painel de Desenvolvimento do Jira
2026-10-18 [DECISION] @Confluence Homologa√ß√£o e publica√ß√£o do ADR-011 sobre rastreabilidade nativa e branches dedicadas por ticket | why: manter B√≠blia do Projeto (page 360453) atualizada
2026-10-18 [DONE] @src/audio_recorder.js Grava√ß√£o e exporta√ß√£o do arquivo de √°udio WAV consolidado p√≥s-chamada (/audio e /resumo) | why: auditoria e conformidade sonora (SCRUM-53) (I-9)
2026-10-18 [RULE] @github Formaliza√ß√£o da abertura obrigat√≥ria de Pull Request (gh pr create) e esteira GitHub Actions CI (.github/workflows/ci.yml) antes de merge em main | why: boas pr√°ticas de CI/CD e governan√ßa empresarial solicitadas pelo usu√°rio
2026-10-18 [DONE] @.github/workflows/ci.yml Implementa√ß√£o de esteira Enterprise DevSecOps no GitHub Actions com SAST CodeQL, TruffleHog e npm audit | why: prote√ß√£o contra vulnerabilidades e vazamento de segredos (SCRUM-61)
2026-10-18 [DONE] @src/speech_storage.js Implementa√ß√£o de persist√™ncia dur√°vel do hist√≥rico de falas em SQLite com WAL mode, √≠ndices e fallback transparente | why: sobreviv√™ncia a rein√≠cios e redeploys no Railway sem perda de atas t√©cnicas (SCRUM-54) (I-10)
2026-10-18 [DONE] @bot.js Resolu√ß√£o do Code Scanning Alert #1 com stripHtmlTags recursivo contra inje√ß√£o de tags HTML aninhadas (CWE-116) e inclus√£o da Regra 12 de DevSecOps | why: conformidade com an√°lise est√°tica de seguran√ßa do CodeQL (SCRUM-62)
2026-10-18 [DONE] @AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md Cria√ß√£o e homologa√ß√£o do protocolo can√¥nico do Agente Universal de Engenharia, Arquitetura, DevSecOps e Governan√ßa | why: padroniza√ß√£o operacional universal de alta maturidade enterprise (SCRUM-63)
2026-10-18 [DONE] @src/metrics.js @bot.js @docker-compose.monitoring.yml Implementacao de Observabilidade Ativa com Prometheus (/metrics), Grafana Provisioning (IaC) e Scanner Autonomo com Auto-Remediacao (SCRUM-64)
2026-10-18 [RULE] @RULES.md Instituicao da Regra 13 de Observabilidade Ativa e Auto-Remediacao Continua com Prometheus, Grafana e Scanner de Incidentes | why: deteccao e cura proativa de anomalias operacionais
2026-10-18 [DONE] @Atlassian @GitHub Concessao de acessos e inclusao de colaborador Guilherme Trevizani (guilhermetrevz@outlook.com / GitHub: gtrevizani) no GitHub, Jira e Confluence (SCRUM-65)
2026-10-18 [DONE] @Atlassian Elevacao de Guilherme Trevizani para Administrador/Dono no Jira (Role Administrator + jira-admins) e Confluence (Role Administrador do espaco TBR + confluence-admins) (SCRUM-66)
2026-10-18 [DONE] @scripts/export_agents_bundle.js Criacao de gerador de bundle universal e manifesto dist/UNIVERSAL_AGENTS_BUNDLE.md para portabilidade dos agentes entre qualquer LLM (SCRUM-67)
2026-10-18 [DONE] @AGENTE_MESTRE_UNIVERSAL.md Criacao de arquivo unico consolidado para compartilhamento plug-and-play de agentes com amigos (SCRUM-68)
2026-10-18 [REFACTOR] @agents @docs Reestruturacao de diretorios em pastas dedicadas /agents e /docs com catalogos README e preservacao de CI/CD (SCRUM-69)
2026-10-18 [DOCS] @agents/AGENTE_MESTRE_UNIVERSAL.md Parametrizacao agnostica universal, matriz de severidades e guia de instalacao plug-and-play para qualquer projeto (SCRUM-70)
2026-10-18 [FEAT] @scripts/create_enterprise_agents_pack.js Criacao de pacote ZIP enterprise das pastas /agents e /docs com prompt canonico de orquestracao multi-agente (SCRUM-72)
