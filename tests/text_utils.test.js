const { describe, it } = require('node:test');
const assert = require('node:assert');
const { formatDiscordMarkdown, formatTimeWindow, splitMessage, isSuspicious, stripHtmlTags } = require('../bot.js');

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

        it('deve fechar e reabrir blocos de código markdown quando particionar dentro de um codeblock', () => {
            const codeLines = Array(40).fill('console.log("trecho de código extenso para ata técnica");').join('\n');
            const markdownWithCode = '```javascript\n' + codeLines + '\n```';
            const parts = splitMessage(markdownWithCode, 500);

            assert.ok(parts.length > 1);
            // Cada parte deve ter número par de ``` (ou seja, blocos devidamente fechados)
            for (const part of parts) {
                const matches = part.match(/```/g);
                assert.ok(matches && matches.length % 2 === 0, `Parte com bloco aberto desbalanceado: ${part}`);
            }
            // A segunda parte deve iniciar com a reabertura do bloco com a linguagem
            assert.ok(parts[1].startsWith('```javascript'), 'Segunda parte deveria reabrir o codeblock');
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

    describe('stripHtmlTags (CodeQL Alert #1 / CWE-116)', () => {
        it('deve remover tags HTML simples preservando o conteúdo textual', () => {
            assert.strictEqual(stripHtmlTags('<b>Olá</b> <i>Mundo</i>!'), 'Olá Mundo!');
            assert.strictEqual(stripHtmlTags('<script>alert("teste")</script>Fala normal'), 'alert("teste")Fala normal');
        });

        it('deve remover recursivamente tags HTML aninhadas (defesa contra bypass de sanitização única)', () => {
            // Vetores de ataque CWE-116: tags embutidas dentro de outras tags
            assert.strictEqual(stripHtmlTags('<<script>alert(1)</script>'), 'alert(1)');
            assert.strictEqual(stripHtmlTags('<<script>script>alert(1)</script>'), 'alert(1)');
            assert.strictEqual(stripHtmlTags('<scr<script>ipt>código malicioso</script>'), 'código malicioso');
            assert.strictEqual(stripHtmlTags('<<<script>>>'), '');
            const nested = stripHtmlTags('<<script>script>alert(1)</script>');
            assert.ok(!nested.includes('<'), 'Não deve conter nenhum caractere <');
            assert.ok(!nested.includes('>'), 'Não deve conter nenhum caractere >');
        });

        it('deve processar sequências massivas de "<" em tempo linear sem vulnerabilidade a ReDoS', () => {
            const evil = '<'.repeat(50_000);
            const start = Date.now();
            const result = stripHtmlTags(evil);
            const duration = Date.now() - start;
            assert.strictEqual(result, '');
            assert.ok(duration < 100, `Processamento demorou ${duration}ms, esperado < 100ms`);
        });

        it('deve tratar entradas vazias, nulas ou não-string com segurança', () => {
            assert.strictEqual(stripHtmlTags(''), '');
            assert.strictEqual(stripHtmlTags(null), '');
            assert.strictEqual(stripHtmlTags(undefined), '');
            assert.strictEqual(stripHtmlTags(12345), '');
        });
    });
});
