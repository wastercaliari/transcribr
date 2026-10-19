// PURPOSE: Script de empacotamento universal dos agentes do ecossistema TranscriBR.
// Consolida todos os contratos de agentes, regras de governança e playbooks em um bundle autossuficiente
// pronto para importação em qualquer LLM (Claude, ChatGPT/OpenAI, DeepSeek, Ollama, Cursor, etc.).

const fs = require('fs');
const path = require('path');

function createAgentsBundle() {
    const rootDir = path.resolve(__dirname, '..');
    const outputDir = path.join(rootDir, 'dist');
    const bundlePath = path.join(outputDir, 'UNIVERSAL_AGENTS_BUNDLE.md');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const filesToBundle = [
        {
            name: 'AGENTE MESTRE UNIVERSAL PLUG-AND-PLAY',
            file: path.join('agents', 'AGENTE_MESTRE_UNIVERSAL.md'),
            category: 'ALL_IN_ONE_MASTER_AGENT'
        },
        {
            name: 'AGENTE UNIVERSAL DE ENGENHARIA, DEVSECOPS E GOVERNANÇA',
            file: path.join('agents', 'AGENTE_UNIVERSAL_ENGENHARIA_DEVSECOPS.md'),
            category: 'MASTER_AGENT'
        },
        {
            name: 'AGENTE UNIVERSAL DE MELHORIA CONTÍNUA',
            file: path.join('agents', 'AGENTE_UNIVERSAL_MELHORIA_CONTINUA.md'),
            category: 'CONTINUOUS_IMPROVEMENT_AGENT'
        },
        {
            name: 'AGENTE REVISOR INDEPENDENTE',
            file: path.join('agents', 'revisor.md'),
            category: 'CODE_REVIEW_AGENT'
        },
        {
            name: 'DIRETRIZES FUNDAMENTAIS DE DEV RULES & GOVERNANÇA (13 REGRAS)',
            file: path.join('docs', 'RULES.md'),
            category: 'GOVERNANCE_RULES'
        }
    ];

    let bundleContent = `# 🚀 TRANSCRIBR — UNIVERSAL AGENTS PORTABILITY BUNDLE\n\n`;
    bundleContent += `> **Data de Geração:** ${new Date().toISOString()}\n`;
    bundleContent += `> **Compatibilidade:** Qualquer LLM Fundacional (Claude 3.5/Opus, GPT-4o/o1/o3, DeepSeek-V3/R1, Gemini 1.5 Pro, Llama 3.3, Cursor, Windsurf, Ollama).\n\n`;
    bundleContent += `Este documento consolida a especificação integral e os contratos operacionais de todos os agentes do ecossistema TranscriBR para execução agnóstica.\n\n`;
    bundleContent += `---\n\n`;

    for (const item of filesToBundle) {
        const fullPath = path.join(rootDir, item.file);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            bundleContent += `## 📌 SEÇÃO: ${item.name} (${item.category})\n`;
            bundleContent += `* **Arquivo Origem:** \`${item.file}\`\n\n`;
            bundleContent += `\`\`\`markdown\n`;
            bundleContent += content;
            bundleContent += `\n\`\`\`\n\n---\n\n`;
        } else {
            console.warn(`⚠️ Arquivo não encontrado: ${item.file}`);
        }
    }

    fs.writeFileSync(bundlePath, bundleContent, 'utf8');
    console.log(`✅ Bundle universal de agentes gerado com sucesso em: ${bundlePath}`);
    return bundlePath;
}

if (require.main === module) {
    createAgentsBundle();
}

module.exports = { createAgentsBundle };
