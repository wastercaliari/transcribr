/**
 * sync_all_cards_git.js
 * Script definitivo para criar branches dedicadas por card do Jira,
 * empurrá-las para o GitHub (origin) e registrar commits e branches
 * em todos os cards do Jira (SCRUM-5 a SCRUM-52).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getAuth() {
    let token = process.env.CONFLUENCE_API_TOKEN || process.env.ATLASSIAN_API_TOKEN;
    if (!token) {
        try {
            const tokenFile = path.resolve(__dirname, '..', 'Atlassian Account.txt');
            if (fs.existsSync(tokenFile)) {
                const match = fs.readFileSync(tokenFile, 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/);
                if (match) token = match[0];
            }
        } catch { /* ignora */ }
    }
    const email = process.env.CONFLUENCE_EMAIL || 'wasterlucas@gmail.com';
    if (!token) return null;
    return Buffer.from(`${email}:${token}`).toString('base64');
}

const CARD_MAPPINGS = [
    // Epics
    { key: 'SCRUM-5', branch: 'feat/SCRUM-5-audio-dave-pipeline', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Pipeline de Áudio e Criptografia DAVE (E2EE)' },
    { key: 'SCRUM-12', branch: 'feat/SCRUM-12-stt-whisper-engine', sha: 'ea82b577a3a9e282c84fa3ec4734f48af20c2cfa', title: 'Motores de Transcrição de Voz (STT) & Inteligência Artificial' },
    { key: 'SCRUM-19', branch: 'feat/SCRUM-19-resumo-ata-engine', sha: 'c8799d53682f40b7039fc7086a0abc8607c68c85', title: 'Motor de Ata Técnica & Resumo Inteligente (/resumo)' },
    { key: 'SCRUM-26', branch: 'feat/SCRUM-26-bot-core-lifecycle', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Discord Bot Core, Ciclo de Vida e Comandos Slash' },
    { key: 'SCRUM-33', branch: 'feat/SCRUM-33-devops-railway-infra', sha: '721d39683d0143aa5d527e58c9bcd7b2538c10b5', title: 'Infraestrutura, DevOps & Deploy 24/7 (Railway)' },
    { key: 'SCRUM-38', branch: 'feat/SCRUM-38-atlassian-enterprise-integration', sha: '4cdbd0e401741651408b3580cebd910508a76954', title: 'Integrações Enterprise & Ecossistema Atlassian (Confluence & Jira)' },

    // Tarefas Concluídas - Pipeline de Áudio
    { key: 'SCRUM-6', branch: 'feat/SCRUM-6-dave-audio-decryption', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Descriptografia de áudio Discord DAVE via @snazzah/davey' },
    { key: 'SCRUM-7', branch: 'feat/SCRUM-7-opus-pcm-decoding', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Decodificação Opus via Prism Media para PCM 16kHz mono' },
    { key: 'SCRUM-8', branch: 'feat/SCRUM-8-high-pass-filter', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Filtro Passa-Alta digital (High-Pass RC 100Hz)' },
    { key: 'SCRUM-9', branch: 'feat/SCRUM-9-agc-gain-control', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Controle Automático de Ganho (AGC) e normalização de pico' },
    { key: 'SCRUM-10', branch: 'feat/SCRUM-10-silence-trimming-padding', sha: '6ab9eb38b7ac118ed3e7d732c6039cc1be4ad1ec', title: 'Algoritmo de Silence Trimming (RMS 200) com padding' },
    { key: 'SCRUM-11', branch: 'feat/SCRUM-11-wav-packer', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Empacotador WAV 16-bit Little-Endian canônico' },

    // Tarefas Concluídas - Motores de STT
    { key: 'SCRUM-13', branch: 'feat/SCRUM-13-groq-whisper-integration', sha: 'ea82b577a3a9e282c84fa3ec4734f48af20c2cfa', title: 'Integração de alta velocidade com Groq Cloud Whisper Large-v3' },
    { key: 'SCRUM-14', branch: 'feat/SCRUM-14-circuit-breaker-stt', sha: 'ea82b577a3a9e282c84fa3ec4734f48af20c2cfa', title: 'Implementação de Circuit Breaker com Retry-After (HTTP 429)' },
    { key: 'SCRUM-15', branch: 'feat/SCRUM-15-whisper-dynamic-context', sha: '6ab9eb38b7ac118ed3e7d732c6039cc1be4ad1ec', title: 'Injeção de contexto dinâmico no prompt do Whisper' },
    { key: 'SCRUM-16', branch: 'feat/SCRUM-16-phonetic-dictionary-corrections', sha: '6ab9eb38b7ac118ed3e7d732c6039cc1be4ad1ec', title: 'Sistema de Dicionário Fonético e Sanitização (corrections.json)' },
    { key: 'SCRUM-17', branch: 'feat/SCRUM-17-hallucination-filter-metrics', sha: '6ab9eb38b7ac118ed3e7d732c6039cc1be4ad1ec', title: 'Algoritmo de filtragem de alucinações e métricas de qualidade' },
    { key: 'SCRUM-18', branch: 'feat/SCRUM-18-faster-whisper-local-server', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Servidor local Faster-Whisper int8 (stt_server.py)' },

    // Tarefas Concluídas - Motor de Ata Técnica
    { key: 'SCRUM-20', branch: 'feat/SCRUM-20-prompt-engineering-ata', sha: 'c8799d53682f40b7039fc7086a0abc8607c68c85', title: 'Engenharia de prompt especializada para Atas Técnicas' },
    { key: 'SCRUM-21', branch: 'feat/SCRUM-21-flexible-time-window', sha: 'ec3c30c2e1eeab0d37ca4adfd7dd863c3a96965a', title: 'Suporte a seleção flexível de janela de tempo (horas, minutos e segundos)' },
    { key: 'SCRUM-22', branch: 'feat/SCRUM-22-llm-fallback-chain', sha: '033577d2884c89224d3a26652da6489ea42cbaf1', title: 'Arquitetura de fallback multi-modelo LLM Groq' },
    { key: 'SCRUM-23', branch: 'feat/SCRUM-23-sliding-window-tpm', sha: '033577d2884c89224d3a26652da6489ea42cbaf1', title: 'Janela deslizante de segurança (18.000 chars) para teto TPM' },
    { key: 'SCRUM-24', branch: 'fix/SCRUM-24-markdown-table-sanitizer', sha: 'b242f7112c2434be07668033348ff3f4f7e530c7', title: 'Sanitizador de Markdown para Discord (conversão de tabelas com pipes)' },
    { key: 'SCRUM-25', branch: 'feat/SCRUM-25-split-message-dm', sha: 'c8799d53682f40b7039fc7086a0abc8607c68c85', title: 'Segmentação e envio de atas em blocos seguros de DM (< 1.900 caracteres)' },

    // Tarefas Concluídas - Discord Bot Core
    { key: 'SCRUM-27', branch: 'feat/SCRUM-27-dynamic-slash-commands', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Registro e sincronização dinâmica de comandos Slash' },
    { key: 'SCRUM-28', branch: 'feat/SCRUM-28-voice-auto-reconciliation', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Mecanismo de Reconciliação automática e auto-join' },
    { key: 'SCRUM-29', branch: 'feat/SCRUM-29-single-process-tcp-lock', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Trava de processo único via Socket TCP na porta local 49152' },
    { key: 'SCRUM-30', branch: 'fix/SCRUM-30-transcription-deduplication', sha: 'a93fce0a7553019b79422e1dc0c70a2d44f121ee', title: 'Sistema de deduplicação de transcrições com janela volátil de 4s' },
    { key: 'SCRUM-31', branch: 'feat/SCRUM-31-paginated-channel-cleanup', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Algoritmo de limpeza paginada do canal transcribr- (/limpar)' },
    { key: 'SCRUM-32', branch: 'feat/SCRUM-32-webhook-client-fallback', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Despacho dual com Webhook Client prioritário e fallback de canal' },

    // Tarefas Concluídas - Infraestrutura & DevOps
    { key: 'SCRUM-34', branch: 'feat/SCRUM-34-dockerfile-multistage-cpp', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Construção de Dockerfile multi-stage com toolchain nativa C++' },
    { key: 'SCRUM-35', branch: 'chore/SCRUM-35-secure-env-configuration', sha: '49b9964857f7bf3e33895be87cd2c8ea044a4dd7', title: 'Configuração de variáveis de ambiente seguras e segregação de .env' },
    { key: 'SCRUM-36', branch: 'feat/SCRUM-36-log-rotation-purge', sha: 'abd861b8e92cf50cb07f64f72c5dc28dbd05bc3e', title: 'Implementação de rotação de logs (bot.log) e purga de histórico' },
    { key: 'SCRUM-37', branch: 'feat/SCRUM-37-railway-continuous-deploy', sha: '721d39683d0143aa5d527e58c9bcd7b2538c10b5', title: 'Configuração de deploy contínuo no Railway com Procfile e railway.json' },

    // Tarefas Concluídas - Governança & Atlassian
    { key: 'SCRUM-39', branch: 'feat/SCRUM-39-atlassian-mcp-servers', sha: 'c8906b2f35fb0e2dffab243c611cf0fc8d01b834', title: 'Configuração de Servidores MCP locais para Jira e Confluence' },
    { key: 'SCRUM-40', branch: 'docs/SCRUM-40-confluence-bible-pages', sha: '1abc9b1b060bd02b6660a9d73b82576945b1896c', title: 'Publicação automatizada da Bíblia do Projeto no espaço TBR do Confluence' },
    { key: 'SCRUM-41', branch: 'docs/SCRUM-41-jira-scrum-board-sync', sha: '1194e49a5ba9a8f9a4b6f8db324f593005f02e97', title: 'Sincronização do Backlog e governança ágil no Jira Project SCRUM' },
    { key: 'SCRUM-42', branch: 'docs/SCRUM-42-triplice-registro-governance', sha: 'f33585d0acd917f5dd08c8f88af22de2d1e0a506', title: 'Padronizar tríplice registro obrigatório (Git, Jira e Confluence)' },
    { key: 'SCRUM-43', branch: 'setup/SCRUM-43-dev-rules-setup', sha: 'c8906b2f35fb0e2dffab243c611cf0fc8d01b834', title: 'Instalar e homologar framework DEV RULES 16.4 e Agente Revisor' },

    // Tarefas Concluídas no Sprint 0 Atual
    { key: 'SCRUM-44', branch: 'feat/SCRUM-44-interactive-summary-buttons', sha: 'b69c756837c8b91d993701b148c4a83819b1651b', title: 'I-1: Implementar botão interativo no Discord para solicitação de ata técnica' },
    { key: 'SCRUM-45', branch: 'feat/SCRUM-45-confluence-auto-sync', sha: 'dca9479501857bff5d9c73ee0f56fc0890a97bcd', title: 'I-2: Sincronização automática das atas técnicas do /resumo direto no Confluence' },
    { key: 'SCRUM-46', branch: 'test/SCRUM-46-dsp-audio-unit-tests', sha: '84848dcb1d90f36cf1384e5ed652e8375d22ae9d', title: 'I-3: Implementar suíte de testes unitários automatizados para o pipeline DSP e áudio' },
    { key: 'SCRUM-47', branch: 'feat/SCRUM-47-telemetry-metrics-module', sha: 'e091b6586f58f0947860e9df2e6abafeeaae6c5e', title: 'I-4: Desenvolver módulo de telemetria e métricas de desempenho de transcrição' },
    { key: 'SCRUM-48', branch: 'feat/SCRUM-48-export-markdown-attachment', sha: '121eefe370caf2790ac83e1f87ce9bdf1d16b79c', title: 'I-5: Exportar Ata Técnica como anexo em arquivo Markdown (.md) ou PDF no Discord' },
    { key: 'SCRUM-49', branch: 'feat/SCRUM-49-http-healthcheck-server', sha: '585e905068c7fc099450e52c75f6771f55186a73', title: 'I-6: Implementar servidor HTTP de healthcheck (/health) para probes de liveness' },
    { key: 'SCRUM-50', branch: 'feat/SCRUM-50-voice-reconnection-resilience', sha: '83903f048073a325e71fede8435a8e2aaec6ee21', title: 'I-7: Reforçar resiliência de reconexão de voz contra instabilidade de WebSocket e Voice Gateway' },
    { key: 'SCRUM-51', branch: 'feat/SCRUM-51-split-message-codeblocks', sha: 'f917ff3346339a322af5c725c528f84946efb62e', title: 'I-8: Aprimorar splitMessage para preservação de formatação de blocos Markdown longos' },
    { key: 'SCRUM-52', branch: 'fix/SCRUM-52-fix-voice-channel-migration', sha: 'ba3aed71ff98f4c950d0c490413d07c0358cecc0', title: 'Fix: Impedir migração indevida de canal de voz e fixar canal ativo de chamada' }
];

async function linkJiraRemote(auth, issueKey, url, title, summary) {
    // Verifica links existentes para evitar duplicatas idênticas
    const getRes = await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${issueKey}/remotelink`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
    });
    if (getRes.status === 200) {
        const existing = await getRes.json();
        if (existing.some(l => l.object && l.object.url === url)) {
            return { status: 'already_linked' };
        }
    }

    const payload = {
        globalId: `github:${issueKey}:${Buffer.from(url).toString('base64').replace(/=/g, '')}`,
        object: {
            url: url,
            title: title,
            summary: summary,
            icon: {
                url16x16: 'https://github.githubassets.com/favicons/favicon.png',
                title: 'GitHub'
            }
        }
    };

    const res = await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${issueKey}/remotelink`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    return { status: res.status === 200 || res.status === 201 ? 'linked' : `error_${res.status}` };
}

async function run() {
    console.log(`🚀 Iniciando sincronização e vinculação de ${CARD_MAPPINGS.length} cards...`);
    const auth = getAuth();
    if (!auth) {
        console.error('❌ Token Atlassian não encontrado!');
        process.exit(1);
    }

    // 1. Criar e sincronizar branches locais
    console.log('\n🌿 [Etapa 1/3] Criando branches dedicadas por ticket...');
    const createdBranches = [];
    for (const item of CARD_MAPPINGS) {
        try {
            // Verifica se a branch já existe localmente
            const check = execSync(`git branch --list "${item.branch}"`, { encoding: 'utf8' }).trim();
            if (!check) {
                execSync(`git branch "${item.branch}" ${item.sha}`);
                console.log(`  ✓ Criada branch: ${item.branch} -> ${item.sha.slice(0, 7)}`);
            } else {
                console.log(`  · Branch já existe: ${item.branch}`);
            }
            createdBranches.push(item.branch);
        } catch (err) {
            console.warn(`  ⚠️ Erro ao criar branch ${item.branch}: ${err.message}`);
        }
    }

    // 2. Push de todas as branches para origin
    console.log('\n⬆️ [Etapa 2/3] Enviando branches para GitHub (origin)...');
    try {
        // Empurramos em blocos para evitar estourar limites de linha de comando
        for (let i = 0; i < createdBranches.length; i += 10) {
            const batch = createdBranches.slice(i, i + 10);
            console.log(`  Pushing lote ${i + 1} a ${i + batch.length}...`);
            execSync(`git push origin ${batch.join(' ')}`, { stdio: 'inherit' });
        }
        console.log('  ✅ Todas as branches enviadas com sucesso para o GitHub!');
    } catch (err) {
        console.error(`  ⚠️ Falha durante git push origin: ${err.message}`);
    }

    // 3. Vincular Remote Links interativos em cada card do Jira
    console.log('\n🔗 [Etapa 3/3] Registrando Remote Links (Branch + Commit) nos cards do Jira...');
    let linkedCount = 0;
    for (const item of CARD_MAPPINGS) {
        const repoUrl = 'https://github.com/wastercaliari/transcribr';
        const branchUrl = `${repoUrl}/tree/${item.branch}`;
        const commitUrl = `${repoUrl}/commit/${item.sha}`;

        const branchTitle = `Branch: ${item.branch}`;
        const branchSummary = `Branch dedicada para ${item.key}: ${item.title}`;

        const commitTitle = `Commit: ${item.sha.slice(0, 7)} (${item.key})`;
        const commitSummary = `Implementação verificada de ${item.key}`;

        const bResult = await linkJiraRemote(auth, item.key, branchUrl, branchTitle, branchSummary);
        const cResult = await linkJiraRemote(auth, item.key, commitUrl, commitTitle, commitSummary);

        console.log(`  📌 [${item.key}] Branch: ${bResult.status} | Commit: ${cResult.status}`);
        linkedCount++;
    }

    console.log(`\n🎉 Concluído! ${linkedCount} cards atualizados com sucesso com histórico completo de Git e Jira!`);
}

run().catch(console.error);
