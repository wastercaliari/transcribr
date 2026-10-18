const test = require('node:test');
const assert = require('node:assert/strict');
const { selectTargetVoiceChannel } = require('../bot.js');

test('Voice Channel Selection & Stickiness Module (SCRUM-52)', async (t) => {
    const mockChannel = (id, name, humansCount, isAfk = false, hasPerms = true) => ({
        id,
        name,
        type: 2, // GuildVoice
        members: new Map(
            Array.from({ length: humansCount }, (_, i) => [`user_${id}_${i}`, { user: { bot: false } }])
        ),
        permissionsFor: () => ({ has: () => hasPerms })
    });

    await t.test('deve retornar null se o bot estiver pausado', () => {
        const channels = new Map([
            ['c1', mockChannel('c1', 'Sala 1', 3)]
        ]);
        const guild = {
            id: 'g1',
            afkChannelId: 'afk',
            channels: { cache: channels }
        };
        const selected = selectTargetVoiceChannel(guild, 'c1', { paused: true, targetChannels: {} });
        assert.equal(selected, null);
    });

    await t.test('deve priorizar absolutamente o canal fixado (targetChannelId) mesmo se outro canal tiver mais pessoas', () => {
        const c1 = mockChannel('c1', 'Reunião Dev', 2);
        const c2 = mockChannel('c2', 'Geral Amigos', 5);
        const channels = new Map([
            ['c1', c1],
            ['c2', c2]
        ]);
        const guild = {
            id: 'g1',
            afkChannelId: 'afk',
            channels: { cache: channels }
        };
        const stateMock = { paused: false, targetChannels: { g1: 'c1' } };

        const selected = selectTargetVoiceChannel(guild, 'c1', stateMock);
        assert.equal(selected.id, 'c1');
        assert.equal(selected.name, 'Reunião Dev');
    });

    await t.test('deve selecionar o canal com mais pessoas quando não houver canal fixado', () => {
        const c1 = mockChannel('c1', 'Canal Pequeno', 1);
        const c2 = mockChannel('c2', 'Canal Grande', 4);
        const channels = new Map([
            ['c1', c1],
            ['c2', c2]
        ]);
        const guild = {
            id: 'g1',
            afkChannelId: 'afk',
            channels: { cache: channels }
        };
        const stateMock = { paused: false, targetChannels: {} };

        const selected = selectTargetVoiceChannel(guild, null, stateMock);
        assert.equal(selected.id, 'c2');
        assert.equal(selected.name, 'Canal Grande');
    });

    await t.test('deve ignorar canal AFK mesmo que tenha participantes', () => {
        const afk = mockChannel('afk_id', 'AFK', 10, true);
        const normal = mockChannel('normal_id', 'Geral', 2);
        const channels = new Map([
            ['afk_id', afk],
            ['normal_id', normal]
        ]);
        const guild = {
            id: 'g1',
            afkChannelId: 'afk_id',
            channels: { cache: channels }
        };
        const stateMock = { paused: false, targetChannels: {} };

        const selected = selectTargetVoiceChannel(guild, null, stateMock);
        assert.equal(selected.id, 'normal_id');
    });

    await t.test('deve descartar canal fixado e retornar null se todos os canais estiverem vazios', () => {
        const c1 = mockChannel('c1', 'Reunião Vazia', 0);
        const channels = new Map([
            ['c1', c1]
        ]);
        const guild = {
            id: 'g1',
            afkChannelId: 'afk',
            channels: { cache: channels }
        };
        const stateMock = { paused: false, targetChannels: { g1: 'c1' } };

        const selected = selectTargetVoiceChannel(guild, 'c1', stateMock);
        assert.equal(selected, null);
        assert.equal(stateMock.targetChannels.g1, undefined);
    });
});
