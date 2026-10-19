// PURPOSE: Script de empacotamento distribuível da Opção B (Pastas agents/ e docs/) em formato ZIP.
// Gera dist/TRANSCRIBR_ENTERPRISE_AGENTS_PACK.zip para compartilhamento direto com amigos e equipes.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

function createEnterprisePackZip() {
    const rootDir = path.resolve(__dirname, '..');
    const distDir = path.join(rootDir, 'dist');
    const zipPath = path.join(distDir, 'TRANSCRIBR_ENTERPRISE_AGENTS_PACK.zip');

    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }

    console.log('📦 Compactando pastas /agents e /docs em formato ZIP...');

    // Utiliza Compress-Archive nativo do PowerShell
    const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${path.join(rootDir, 'agents')}', '${path.join(rootDir, 'docs')}' -DestinationPath '${zipPath}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });

    if (!fs.existsSync(zipPath)) {
        throw new Error(`Falha ao gerar o arquivo ZIP em: ${zipPath}`);
    }

    const stats = fs.statSync(zipPath);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');

    console.log(`✅ Pacote ZIP Enterprise gerado com sucesso!`);
    console.log(`📍 Caminho: ${zipPath}`);
    console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`🔒 SHA256: ${hash}`);

    return { zipPath, sizeKb: (stats.size / 1024).toFixed(2), sha256: hash };
}

if (require.main === module) {
    createEnterprisePackZip();
}

module.exports = { createEnterprisePackZip };
