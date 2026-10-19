// PURPOSE: Testes unitários para o motor de atas/resumos (/resumo), amostragem cronológica e calibragem do STT.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
    sampleTranscriptLines,
    buildSummaryPrompt,
    parseWhisper,
    stylePrompt
} = require('../bot.js');

describe('Resumo & STT Engine (SCRUM-73)', () => {
    describe('sampleTranscriptLines', () => {
        it('deve manter 100% das linhas quando o texto couber no limite de caracteres', () => {
            const lines = [
                '[10:00] Alice: Bom dia pessoal',
                '[10:01] Bob: Vamos começar a reunião de planejamento',
                '[10:02] Charlie: Sim, vamos falar sobre a API e o banco de dados'
            ];
            const result = sampleTranscriptLines(lines, 5000);
            assert.strictEqual(result.isSampled, false);
            assert.strictEqual(result.sampledCount, 3);
            assert.strictEqual(result.totalCount, 3);
            assert.strictEqual(result.text, lines.join('\n'));
        });

        it('deve amostrar cronologicamente preservando Início, Fim e Miolo quando exceder o limite', () => {
            // Cria 200 falas simulando uma reunião de 1 hora
            const lines = [];
            for (let i = 0; i < 200; i++) {
                const min = String(Math.floor(i / 3)).padStart(2, '0');
                lines.push(`[10:${min}] Participante_${i % 4}: Linha de discussão detalhada número ${i} com argumentos técnicos.`);
            }

            const maxChars = 2000;
            const result = sampleTranscriptLines(lines, maxChars);

            assert.strictEqual(result.isSampled, true);
            assert.strictEqual(result.totalCount, 200);
            assert.ok(result.text.length <= maxChars, `Tamanho excedeu limite: ${result.text.length} > ${maxChars}`);

            // Deve preservar a fala de abertura (Início)
            assert.ok(result.text.includes('Participante_0: Linha de discussão detalhada número 0'), 'Deve conter abertura da reunião');
            // Deve preservar a fala final (Encerramento/Decisões)
            assert.ok(result.text.includes('Participante_3: Linha de discussão detalhada número 199'), 'Deve conter encerramento da reunião');
            // Deve conter indicador de condensação intermediária
            assert.ok(result.text.includes('fala(s) intermediária(s) condensadas'), 'Deve indicar condensação uniforme');
        });

        it('deve tratar entradas vazias ou nulas com segurança', () => {
            const emptyResult = sampleTranscriptLines([]);
            assert.strictEqual(emptyResult.text, '');
            assert.strictEqual(emptyResult.sampledCount, 0);

            const nullResult = sampleTranscriptLines(null);
            assert.strictEqual(nullResult.text, '');
        });
    });

    describe('buildSummaryPrompt', () => {
        it('deve construir prompt estruturado com metadados temporais e timeline explícita', () => {
            const now = Date.now();
            const entries = [
                { t: now - 1800000, g: '123', a: 'Lucas', x: 'Iniciando alinhamento sobre o deploy no Railway' },
                { t: now - 900000, g: '123', a: 'Guilherme', x: 'Verifiquei que as métricas do Prometheus estão estáveis' },
                { t: now - 60000, g: '123', a: 'Lucas', x: 'Perfeito, vamos subir a versão 2.0 agora' }
            ];

            const summaryData = buildSummaryPrompt(entries, 1800, { now });
            assert.ok(summaryData, 'Deve retornar objeto summaryData');
            assert.strictEqual(summaryData.totalCount, 3);
            assert.deepStrictEqual(summaryData.speakers, ['Lucas', 'Guilherme']);

            const prompt = summaryData.prompt;
            assert.ok(prompt.includes('METADADOS DA SESSÃO'), 'Deve conter bloco de metadados');
            assert.ok(prompt.includes('Janela Solicitada: Últimos 30 minuto(s)'), 'Deve indicar janela solicitada');
            assert.ok(prompt.includes('Participantes Ativos: Lucas, Guilherme'), 'Deve indicar participantes');
            assert.ok(prompt.includes('Linha do Tempo / Cronologia dos Assuntos'), 'Deve conter seção de Linha do Tempo');
            assert.ok(prompt.includes('Lucas: Iniciando alinhamento sobre o deploy'), 'Deve conter transcrição');
        });

        it('deve retornar null se a lista de entries estiver vazia', () => {
            const result = buildSummaryPrompt([], 60);
            assert.strictEqual(result, null);
        });
    });

    describe('parseWhisper', () => {
        it('deve manter segmentos válidos com avg_logprob moderado (-1.2) que antes eram cortados', () => {
            const data = {
                segments: [
                    { text: 'Vamos testar o deploy no Railway agora', avg_logprob: -1.2, no_speech_prob: 0.1, compression_ratio: 1.5 }
                ]
            };
            const parsed = parseWhisper(data, 3);
            assert.strictEqual(parsed.text, 'Vamos testar o deploy no Railway agora');
            assert.strictEqual(parsed.conf, -1.2);
        });

        it('deve descartar segmentos com severa alucinação ou ausência de fala', () => {
            const data = {
                segments: [
                    { text: 'obrigado por assistir deixe seu like', avg_logprob: -0.2, no_speech_prob: 0.05, compression_ratio: 1.2 },
                    { text: 'ruído ininteligível', avg_logprob: -2.0, no_speech_prob: 0.9, compression_ratio: 1.2 }
                ]
            };
            const parsed = parseWhisper(data, 2);
            assert.strictEqual(parsed.text, '', 'Deve descartar alucinação e ruído extremo');
        });
    });

    describe('stylePrompt', () => {
        it('deve gerar lista limpa de termos sem instruções meta-textuais que confundam o Whisper', () => {
            const prompt = stylePrompt(['Lucas', 'Guilherme']);
            assert.ok(prompt.includes('Lucas'), 'Deve conter nomes dos participantes');
            assert.ok(prompt.includes('Guilherme'), 'Deve conter nomes dos participantes');
            assert.ok(!prompt.includes('Transcrição em português do Brasil'), 'Não deve conter metainstrução');
        });
    });
});
