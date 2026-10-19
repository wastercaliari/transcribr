// PURPOSE: Testes unitários para agregação e persistência de blocos de 50 falas (SCRUM-76) e ancoragem contra alucinações.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { SpeechStorage, aggregateUtterancesIntoBlocks } = require('../src/speech_storage.js');
const { buildSummaryPrompt } = require('../bot.js');

describe('Speech Blocks & Anti-Hallucination Engine (SCRUM-76)', () => {
    describe('aggregateUtterancesIntoBlocks', () => {
        it('deve agrupar corretamente 125 falas em blocos de 50 (50, 50, 25)', () => {
            const now = Date.now();
            const entries = [];
            for (let i = 0; i < 125; i++) {
                const author = i % 2 === 0 ? 'Lucas' : (i % 5 === 0 ? 'Guilherme' : 'Waster');
                entries.push({
                    t: now + i * 1000,
                    g: 'guild-1',
                    a: author,
                    x: `Fala número ${i} de teste sobre arquitetura de software`
                });
            }

            const result = aggregateUtterancesIntoBlocks(entries, 50);

            assert.strictEqual(result.totalUtterances, 125);
            assert.strictEqual(result.blocks.length, 3);

            // Bloco 1: 50 falas
            assert.strictEqual(result.blocks[0].blockIndex, 1);
            assert.strictEqual(result.blocks[0].utteranceCount, 50);
            assert.strictEqual(result.blocks[0].firstUtterance.x, 'Fala número 0 de teste sobre arquitetura de software');
            assert.strictEqual(result.blocks[0].lastUtterance.x, 'Fala número 49 de teste sobre arquitetura de software');

            // Bloco 2: 50 falas
            assert.strictEqual(result.blocks[1].blockIndex, 2);
            assert.strictEqual(result.blocks[1].utteranceCount, 50);

            // Bloco 3: 25 falas restantes
            assert.strictEqual(result.blocks[2].blockIndex, 3);
            assert.strictEqual(result.blocks[2].utteranceCount, 25);
            assert.strictEqual(result.blocks[2].lastUtterance.x, 'Fala número 124 de teste sobre arquitetura de software');

            // Estatísticas globais
            assert.ok(result.overallStats.length >= 3);
            const totalCountCalculated = result.overallStats.reduce((acc, s) => acc + s.count, 0);
            assert.strictEqual(totalCountCalculated, 125);

            // A soma das porcentagens deve ser aproximadamente 100%
            const pctSum = result.overallStats.reduce((acc, s) => acc + s.percentage, 0);
            assert.ok(pctSum >= 99.8 && pctSum <= 100.2, `Soma de porcentagens ${pctSum} fora de 100%`);
        });

        it('deve retornar estrutura neutra e segura se a lista de entradas for vazia ou inválida', () => {
            const emptyResult = aggregateUtterancesIntoBlocks([]);
            assert.strictEqual(emptyResult.totalUtterances, 0);
            assert.strictEqual(emptyResult.blocks.length, 0);
            assert.deepStrictEqual(emptyResult.overallStats, []);

            const nullResult = aggregateUtterancesIntoBlocks(null);
            assert.strictEqual(nullResult.totalUtterances, 0);
        });
    });

    describe('SpeechStorage Blocks Persistence', () => {
        let storage;

        beforeEach(() => {
            storage = new SpeechStorage({ dbPath: ':memory:', forceFallback: false });
        });

        afterEach(() => {
            if (storage) storage.close();
        });

        it('deve disparar saveBlock automaticamente a cada 50 falas registradas', () => {
            const now = Date.now();
            const guildId = 'guild-test-50';

            // Registra 49 falas -> 0 blocos fechados
            for (let i = 0; i < 49; i++) {
                storage.logLine(guildId, 'Lucas', `Fala ${i}`, now + i * 500);
            }
            assert.strictEqual(storage.getBlockCount(guildId), 0);

            // Registra a 50ª fala -> 1 bloco fechado
            storage.logLine(guildId, 'Waster', 'Fala 50 que fecha o bloco', now + 49 * 500);
            assert.strictEqual(storage.getBlockCount(guildId), 1);

            const blocks = storage.getBlocks(guildId);
            assert.strictEqual(blocks.length, 1);
            assert.strictEqual(blocks[0].blockIndex, 1);
            assert.strictEqual(blocks[0].utteranceCount, 50);
            assert.ok(Array.isArray(blocks[0].speakerStats));

            // Lucas falou 49 vezes e Waster 1 vez
            const lucasStat = blocks[0].speakerStats.find(s => s.author === 'Lucas');
            assert.strictEqual(lucasStat.count, 49);
            assert.strictEqual(lucasStat.percentage, 98);

            // Registra mais 50 falas -> 2 blocos fechados
            for (let i = 50; i < 100; i++) {
                storage.logLine(guildId, 'Guilherme', `Fala ${i}`, now + i * 500);
            }
            assert.strictEqual(storage.getBlockCount(guildId), 2);
        });

        it('deve limpar blocos ao chamar clearGuild', () => {
            const guildId = 'guild-clear-test';
            for (let i = 0; i < 50; i++) {
                storage.logLine(guildId, 'User', `Fala ${i}`, Date.now() + i * 100);
            }
            assert.strictEqual(storage.getBlockCount(guildId), 1);

            storage.clearGuild(guildId);
            assert.strictEqual(storage.getBlockCount(guildId), 0);
            assert.strictEqual(storage.getBlocks(guildId).length, 0);
        });
    });

    describe('Enriquecimento do buildSummaryPrompt com Blocos de 50 Falas', () => {
        it('deve conter Ranking Real e Cronologia Factual dos Blocos no prompt', () => {
            const now = Date.now();
            const entries = [];
            // Cria 60 falas para formar 2 blocos (50 + 10)
            for (let i = 0; i < 60; i++) {
                entries.push({
                    t: now - (60 - i) * 60000,
                    g: 'guild-resumo',
                    a: i < 40 ? 'Waster' : 'Hudson',
                    x: `Discussão técnica número ${i} sobre persistência em blocos`
                });
            }

            const summaryData = buildSummaryPrompt(entries, 3600, { now });
            assert.ok(summaryData, 'summaryData não deve ser nulo');
            assert.ok(summaryData.blockData, 'Deve incluir blockData estruturado');
            assert.strictEqual(summaryData.blockData.blocks.length, 2);

            const prompt = summaryData.prompt;
            assert.ok(prompt.includes('RANKING REAL DE PARTICIPAÇÃO'), 'Deve conter seção de Ranking Real');
            assert.ok(prompt.includes('CRONOLOGIA FACTUAL DOS BLOCOS DE 50 FALAS'), 'Deve conter seção de Cronologia dos Blocos');
            assert.ok(prompt.includes('**Bloco #1** [50 falas]'), 'Deve identificar Bloco #1 com 50 falas');
            assert.ok(prompt.includes('**Bloco #2** [10 falas]'), 'Deve identificar Bloco #2 com 10 falas');
            assert.ok(prompt.includes('DIRETRIZES DE FIDELIDADE E BLOCOS DE 50 FALAS'), 'Deve conter diretrizes anti-alucinação');
        });
    });
});
