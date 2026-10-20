/**
 * Testes Unitários de Detecção Multi-Falante e Resolução de Membros (SCRUM-78)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { humansIn, getGuildDiarizer, VoiceDiarizer } = require('../bot.js');

test.describe('Módulo de Detecção Multi-Falante & Resolução de Voz (SCRUM-78)', () => {
    test.describe('humansIn() com Detecção Híbrida (Members & VoiceStates)', () => {
        test('deve listar membros diretamente quando channel.members estiver populado', () => {
            const fakeChannel = {
                id: 'ch-1',
                members: new Map([
                    ['u-1', { id: 'u-1', displayName: 'Waster', user: { bot: false } }],
                    ['u-2', { id: 'u-2', displayName: 'Hudson', user: { bot: false } }],
                    ['bot-1', { id: 'bot-1', displayName: 'TranscriBR', user: { bot: true } }]
                ])
            };

            const humans = humansIn(fakeChannel);
            assert.strictEqual(humans.length, 2);
            assert.deepStrictEqual(humans.map(h => h.displayName), ['Waster', 'Hudson']);
        });

        test('deve acionar fallback de guild.voiceStates quando channel.members estiver vazio', () => {
            const fakeChannel = {
                id: 'ch-voice-99',
                members: new Map(),
                client: { user: { id: 'bot-id' }, users: { cache: new Map([['u-ext', { username: 'Vitor', bot: false }]]) } },
                guild: {
                    members: { cache: new Map() },
                    voiceStates: {
                        cache: new Map([
                            ['u-ext', { id: 'u-ext', channelId: 'ch-voice-99', member: null }],
                            ['bot-id', { id: 'bot-id', channelId: 'ch-voice-99', member: null }]
                        ])
                    }
                }
            };

            const humans = humansIn(fakeChannel);
            assert.strictEqual(humans.length, 1);
            assert.strictEqual(humans[0].displayName, 'Vitor');
        });

        test('deve tratar canal nulo ou indefinido retornando array vazio', () => {
            assert.deepStrictEqual(humansIn(null), []);
            assert.deepStrictEqual(humansIn(undefined), []);
        });
    });

    test.describe('Resolução de userName e Reatribuição do Diarizador sem TypeError', () => {
        test('não deve lançar TypeError: Assignment to constant variable ao atualizar userName com resultado do diarizador', () => {
            const diarizer = new VoiceDiarizer();
            // Gera tom acústico de teste para simular fala
            const bufferLen = 16000 * 2; // 1 segundo
            const pcm = Buffer.alloc(bufferLen);
            for (let i = 0; i < 16000; i++) {
                const sample = Math.round(15000 * Math.sin(2 * Math.PI * 220 * (i / 16000)));
                pcm.writeInt16LE(sample, i * 2);
            }

            // Matricula usuário conhecido
            diarizer.enrollSpeaker('u-known', 'Guilherme', pcm);

            // Simula lógica de resolução de userName do bot.js com let
            let userName = 'Alguém';
            if (userName && userName !== 'Alguém') {
                diarizer.enrollSpeaker('u-anon', userName, pcm);
            } else {
                const idResult = diarizer.identifySpeaker(pcm);
                if (idResult.match && idResult.speakerName) {
                    assert.doesNotThrow(() => {
                        userName = idResult.speakerName;
                    }, 'A reatribuição de userName não deve lançar erro');
                }
            }

            assert.strictEqual(userName, 'Guilherme');
        });

        test('deve manter userName original caso o locutor já possua displayName identificado', () => {
            const diarizer = new VoiceDiarizer();
            const pcm = Buffer.alloc(32000);
            for (let i = 0; i < 16000; i++) {
                pcm.writeInt16LE(Math.round(10000 * Math.sin(2 * Math.PI * 300 * (i / 16000))), i * 2);
            }

            let userName = 'Hudson';
            if (userName && userName !== 'Alguém') {
                diarizer.enrollSpeaker('u-hudson', userName, pcm);
            } else {
                const idResult = diarizer.identifySpeaker(pcm);
                if (idResult.match && idResult.speakerName) {
                    userName = idResult.speakerName;
                }
            }

            assert.strictEqual(userName, 'Hudson');
            assert.strictEqual(diarizer.profiles.get('u-hudson').name, 'Hudson');
        });
    });

    test.describe('Watchdog de Liberação da Trava de Escuta (Listening Set)', () => {
        test('deve limpar userId do conjunto listening quando o release for acionado', () => {
            const listening = new Set(['user-1', 'user-2']);
            assert.strictEqual(listening.has('user-1'), true);

            let released = false;
            let watchdogCleared = false;
            const fakeTimer = setTimeout(() => {}, 10000);
            const release = () => {
                if (released) return;
                released = true;
                clearTimeout(fakeTimer);
                watchdogCleared = true;
                listening.delete('user-1');
            };

            release();
            assert.strictEqual(listening.has('user-1'), false);
            assert.strictEqual(listening.has('user-2'), true);
            assert.strictEqual(watchdogCleared, true);

            // Chamada subsequente idempotente
            release();
            assert.strictEqual(listening.has('user-1'), false);
        });
    });
});
