const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  CANONICAL_FILES,
  validateModularStructure,
  renderCanonicalPrompt,
  installIdeConfigs
} = require('../scripts/canonical_installer');

describe('Canonical Modular Enterprise Prompt & Suite (SCRUM-71)', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('validateModularStructure', () => {
    it('deve validar com sucesso a presença de todos os arquivos canônicos no repositório', () => {
      const result = validateModularStructure(rootDir);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.missing.length, 0);
      assert.strictEqual(result.present.length, CANONICAL_FILES.length);
    });

    it('deve identificar arquivos ausentes ao inspecionar diretório incompleto', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tbr-modular-test-'));
      try {
        const result = validateModularStructure(tempDir);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.missing.length, CANONICAL_FILES.length);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('renderCanonicalPrompt', () => {
    it('deve renderizar o prompt mestre com metadados e os 5 modos operacionais', () => {
      const prompt = renderCanonicalPrompt({
        projectName: 'Fintech Core API',
        techStack: 'TypeScript, NestJS, PostgreSQL, Kafka',
        ticketSystem: 'Jira Cloud FIN'
      });

      assert.ok(prompt.includes('Fintech Core API'));
      assert.ok(prompt.includes('NestJS, PostgreSQL'));
      assert.ok(prompt.includes('modo: devsecops'));
      assert.ok(prompt.includes('modo: revisor'));
      assert.ok(prompt.includes('modo: melhoria'));
      assert.ok(prompt.includes('modo: observabilidade'));
      assert.ok(prompt.includes('modo: full-developer'));
      assert.ok(prompt.includes('15 seções'));
      assert.ok(prompt.includes('dupla quebra de linha'));
    });
  });

  describe('installIdeConfigs', () => {
    it('deve gerar arquivos de configuração .cursorrules e CLAUDE.md no destino', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tbr-ide-test-'));
      try {
        const { cursorRulesPath, claudeMdPath } = installIdeConfigs(tempDir, {
          projectName: 'Projeto Teste'
        });

        assert.ok(fs.existsSync(cursorRulesPath));
        assert.ok(fs.existsSync(claudeMdPath));

        const cursorContent = fs.readFileSync(cursorRulesPath, 'utf8');
        assert.ok(cursorContent.includes('Projeto Teste'));
        assert.ok(cursorContent.includes('docs/RULES.md'));
        assert.ok(cursorContent.includes('CWE-1333'));

        const claudeContent = fs.readFileSync(claudeMdPath, 'utf8');
        assert.ok(claudeContent.includes('/agents'));
        assert.ok(claudeContent.includes('/docs'));
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Documentação Canônica de Inicialização', () => {
    it('docs/CANONICAL_MODULAR_ENTERPRISE_PROMPT.md deve existir e conter especificações enterprise', () => {
      const promptDocPath = path.join(rootDir, 'docs', 'CANONICAL_MODULAR_ENTERPRISE_PROMPT.md');
      assert.ok(fs.existsSync(promptDocPath), 'Arquivo canônico deve existir');
      const content = fs.readFileSync(promptDocPath, 'utf8');
      assert.ok(content.includes('Model Context Protocol (MCP)'));
      assert.ok(content.includes('Matriz de Severidade & Políticas Zero-Tolerance'));
      assert.ok(/protocolo de resposta em duas camadas/i.test(content));
      assert.ok(content.includes('modo: full-developer'));
    });

    it('agents/PROMPT_INSTALACAO_ENTERPRISE.md deve indexar as 14 referências de agentes e docs', () => {
      const promptInstallPath = path.join(rootDir, 'agents', 'PROMPT_INSTALACAO_ENTERPRISE.md');
      assert.ok(fs.existsSync(promptInstallPath));
      const content = fs.readFileSync(promptInstallPath, 'utf8');
      assert.ok(content.includes('14 arquivos'));
      assert.ok(content.includes('5 modos operacionais'));
      assert.ok(content.includes('CANONICAL_MODULAR_ENTERPRISE_PROMPT.md'));
    });
  });
});
