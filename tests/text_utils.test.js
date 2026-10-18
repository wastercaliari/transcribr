// Testes unitários para utilitários de texto, sanitização de Markdown e formatação
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { formatDiscordMarkdown, formatTimeWindow, splitMessage, isSuspicious } = require('../bot.js');

describe('Text & Markdown Utilities', () => {
    describe('formatTimeWindow', () => {
        it('deve formatar corretamente combinações de horas, minutos e segundos', () => {
            assert.strictEqual(formatTimeWindow(90), '1 minuto(s) e 30 segundo(s)');
            assert.strictEqual(formatTimeWindow(3600), '1 hora(s)');
            assert.strictEqual(formatTimeWindow(5400), '1 hora(s) e 30 minuto(s)');
            assert.strictEqual(formatTimeWindow(3665), '1 hora(s) e 1 minuto(s) e 5 segundo(s)');
        });

        it('deve tratar zero segundos retornando "0 segundo(s)"', () => {
            assert.strictEqual(formatTimeWindow(0), '0 segundo(s)');
        });
    });

    describe('formatDiscordMarkdown', () => {
        it('deve remover linhas de grade de tabela e converter células em tópicos verticais', () => {
            const markdownTable = [
                '| Ferramenta | Finalidade |',
                '|---|---|',
                '| Docker | Containers |',
                '| Node.js | Servidor backend |'
            ].join('\n');

            const formatted = formatDiscordMarkdown(markdownTable);
            assert.ok(!formatted.includes('|---|---|'), 'Não deve conter separador de tabela');
            assert.ok(formatted.includes('• **Docker**: Containers'));
            assert.ok(formatted.includes('• **Node.js**: Servidor backend'));
        });

        it('deve preservar texto comum sem tabelas intacto', () => {
            const text = '📌 **Visão Geral**\nReunião sobre arquitetura do TranscriBR.';
            assert.strictEqual(formatDiscordMarkdown(text), text);
        });

        it('deve tratar texto nulo ou vazio retornando string vazia', () => {
            assert.strictEqual(formatDiscordMarkdown(''), '');
            assert.strictEqual(formatDiscordMarkdown(null), '');
        });
    });

    describe('splitMessage', () => {
        it('deve manter texto curto em uma única parte', () => {
            const shortText = 'Mensagem com menos de 100 caracteres.';
            const parts = splitMessage(shortText, 1900);
            assert.strictEqual(parts.length, 1);
            assert.strictEqual(parts[0], shortText);
        });

        it('deve particionar mensagens maiores que o limite respeitando quebras de linha', () => {
            const paragraph = 'Linha de texto para teste de particionamento.'.repeat(10);
            const longText = Array(60).fill(paragraph).join('\n');
            const parts = splitMessage(longText, 1000);

            assert.ok(parts.length > 1);
            for (const part of parts) {
                assert.ok(part.length <= 1000, `Parte excedeu limite: ${part.length}`);
            }
        });
    });

    describe('isSuspicious', () => {
        it('deve detectar frases típicas de alucinação do Whisper', () => {
            assert.ok(isSuspicious('Obrigado por assistir, se inscreva no canal', 2.0));
            assert.ok(isSuspicious('Legendas pela comunidade amara.org', 3.0));
        });

        it('deve detectar repetições em loop', () => {
            assert.ok(isSuspicious('olá olá olá olá olá olá olá olá olá', 2.0));
        });

        it('deve aprovar falas normais e técnicas', () => {
            assert.strictEqual(isSuspicious('Precisamos atualizar a rotação de logs no Railway hoje', 3.0), null);
        });
    });
});
