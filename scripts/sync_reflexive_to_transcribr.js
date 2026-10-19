const fs = require('fs');
const path = require('path');

const srcDir = 'd:/IA Projects/Antigravity Projects/agent-master-devsecops';
const dstDir = 'd:/IA Projects/Antigravity Projects/TranscriBR';

// Copiar os 3 arquivos reflexivos aprimorados
fs.copyFileSync(path.join(srcDir, 'agents', 'AGENTE_MESTRE_UNIVERSAL.md'), path.join(dstDir, 'agents', 'AGENTE_MESTRE_UNIVERSAL.md'));
fs.copyFileSync(path.join(srcDir, 'agents', 'revisor.md'), path.join(dstDir, 'agents', 'revisor.md'));
fs.copyFileSync(path.join(srcDir, 'docs', 'ARCHITECTURE.md'), path.join(dstDir, 'docs', 'ARCHITECTURE.md'));
fs.copyFileSync(path.join(srcDir, 'docs', 'IDEAS.md'), path.join(dstDir, 'docs', 'IDEAS.md'));

console.log('Arquivos reflexivos sincronizados perfeitamente em TranscriBR.');
