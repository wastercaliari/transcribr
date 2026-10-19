const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  SUPPORTED_LANGUAGES,
  normalizeTargetLanguage,
  getLanguageInstructions,
  buildTranslationPrompt
} = require('../src/multilingual_translation');
const { buildSummaryPrompt } = require('../bot');

describe('Multilingual Meeting Minutes Translation Module (SCRUM-57)', () => {
  describe('normalizeTargetLanguage', () => {
    it('deve normalizar aliases para Português (pt)', () => {
      assert.strictEqual(normalizeTargetLanguage('pt'), 'pt');
      assert.strictEqual(normalizeTargetLanguage('PT'), 'pt');
      assert.strictEqual(normalizeTargetLanguage('pt-br'), 'pt');
      assert.strictEqual(normalizeTargetLanguage('portugues'), 'pt');
      assert.strictEqual(normalizeTargetLanguage('Português'), 'pt');
      assert.strictEqual(normalizeTargetLanguage(null), 'pt');
      assert.strictEqual(normalizeTargetLanguage(''), 'pt');
      assert.strictEqual(normalizeTargetLanguage('unknown-lang'), 'pt');
    });

    it('deve normalizar aliases para Inglês (en)', () => {
      assert.strictEqual(normalizeTargetLanguage('en'), 'en');
      assert.strictEqual(normalizeTargetLanguage('EN-US'), 'en');
      assert.strictEqual(normalizeTargetLanguage('english'), 'en');
      assert.strictEqual(normalizeTargetLanguage('inglês'), 'en');
      assert.strictEqual(normalizeTargetLanguage('ingles'), 'en');
    });

    it('deve normalizar aliases para Espanhol (es)', () => {
      assert.strictEqual(normalizeTargetLanguage('es'), 'es');
      assert.strictEqual(normalizeTargetLanguage('ES-ES'), 'es');
      assert.strictEqual(normalizeTargetLanguage('espanhol'), 'es');
      assert.strictEqual(normalizeTargetLanguage('spanish'), 'es');
    });

    it('deve normalizar aliases para Bilíngue (bilingual)', () => {
      assert.strictEqual(normalizeTargetLanguage('bilingual'), 'bilingual');
      assert.strictEqual(normalizeTargetLanguage('bilingue'), 'bilingual');
      assert.strictEqual(normalizeTargetLanguage('bilíngue'), 'bilingual');
      assert.strictEqual(normalizeTargetLanguage('pt-en'), 'bilingual');
      assert.strictEqual(normalizeTargetLanguage('dual'), 'bilingual');
    });
  });

  describe('getLanguageInstructions', () => {
    it('deve gerar diretrizes corretas para cada idioma suportado', () => {
      const instrPt = getLanguageInstructions('pt');
      assert.ok(instrPt.includes('PORTUGUÊS (BRASIL)'));

      const instrEn = getLanguageInstructions('en');
      assert.ok(instrEn.includes('ENGLISH (US)'));
      assert.ok(instrEn.includes('MUST BE WRITTEN IN ENGLISH'));

      const instrEs = getLanguageInstructions('es');
      assert.ok(instrEs.includes('ESPAÑOL'));
      assert.ok(instrEs.includes('DEBEN SER REDACTADOS EN ESPAÑOL'));

      const instrBi = getLanguageInstructions('bilingual');
      assert.ok(instrBi.includes('FORMATO BILÍNGUE'));
    });
  });

  describe('buildTranslationPrompt', () => {
    it('deve gerar prompt de tradução com restrições e preservação de Markdown', () => {
      const mockAta = '## Resumo\n• Ponto 1: Decisão técnica tomada';
      const prompt = buildTranslationPrompt(mockAta, 'en');

      assert.ok(prompt.includes('English (US)'));
      assert.ok(prompt.includes('NUNCA use tabelas Markdown com barras verticais'));
      assert.ok(prompt.includes(mockAta));
    });
  });

  describe('Integração com buildSummaryPrompt em bot.js', () => {
    const mockEntries = [
      { t: Date.now() - 60000, g: 'g1', a: 'Alice', x: 'Iniciando o deploy da versão 2.0 no cluster Kubernetes.' },
      { t: Date.now() - 30000, g: 'g1', a: 'Bob', x: 'Perfeito, pipeline de CI aprovada com sucesso.' }
    ];

    it('deve gerar prompt com idioma padrão (PT) quando não especificado', () => {
      const res = buildSummaryPrompt(mockEntries, 1800);
      assert.strictEqual(res.targetLanguage, 'pt');
      assert.ok(res.prompt.includes('Idioma Alvo da Ata: PT'));
      assert.ok(res.prompt.includes('PORTUGUÊS (BRASIL)'));
    });

    it('deve configurar idioma alvo para Inglês (EN) quando solicitado', () => {
      const res = buildSummaryPrompt(mockEntries, 1800, { targetLanguage: 'en' });
      assert.strictEqual(res.targetLanguage, 'en');
      assert.ok(res.prompt.includes('Idioma Alvo da Ata: EN'));
      assert.ok(res.prompt.includes('ENGLISH (US)'));
      assert.ok(res.prompt.includes('MUST BE WRITTEN IN ENGLISH'));
    });

    it('deve configurar idioma alvo para Espanhol (ES) quando solicitado', () => {
      const res = buildSummaryPrompt(mockEntries, 1800, { targetLanguage: 'es' });
      assert.strictEqual(res.targetLanguage, 'es');
      assert.ok(res.prompt.includes('Idioma Alvo da Ata: ES'));
      assert.ok(res.prompt.includes('ESPAÑOL'));
    });

    it('deve configurar formato Bilíngue quando solicitado', () => {
      const res = buildSummaryPrompt(mockEntries, 1800, { targetLanguage: 'bilingual' });
      assert.strictEqual(res.targetLanguage, 'bilingual');
      assert.ok(res.prompt.includes('Idioma Alvo da Ata: BILINGUAL'));
      assert.ok(res.prompt.includes('FORMATO BILÍNGUE'));
    });
  });
});
