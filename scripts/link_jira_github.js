/**
 * link_jira_github.js
 * Script para conectar e registrar automaticamente commits e branches do GitHub
 * aos cards do Jira Software (Project SCRUM) via Atlassian Remote Links API.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getAuth() {
    let token = process.env.CONFLUENCE_API_TOKEN || process.env.ATLASSIAN_API_TOKEN;
    if (!token) {
        try {
            const tokenFile = path.resolve(__dirname, '..', 'Atlassian Account.txt');
            if (fs.existsSync(tokenFile)) {
                const match = fs.readFileSync(tokenFile, 'utf8').match(/ATATT[A-Za-z0-9_\-=]+/);
                if (match) token = match[0];
            }
        } catch { /* ignora */ }
    }
    const email = process.env.CONFLUENCE_EMAIL || 'wasterlucas@gmail.com';
    if (!token) return null;
    return Buffer.from(`${email}:${token}`).toString('base64');
}

async function linkCommitToJira(commitSha, branchName) {
    const auth = getAuth();
    if (!auth) {
        console.warn('⚠️ Token Atlassian não encontrado. Pulando vinculação automática.');
        return;
    }

    const sha = commitSha || execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const branch = branchName || execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const message = execSync(`git log -1 --format=%s ${sha}`, { encoding: 'utf8' }).trim();

    // Extrai todas as chaves Jira do commit ou do nome da branch (ex: SCRUM-53)
    const combinedText = `${branch} ${message}`;
    const matches = combinedText.match(/SCRUM-\d+/gi) || [];
    const issueKeys = [...new Set(matches.map(k => k.toUpperCase()))];

    if (!issueKeys.length) {
        return;
    }

    const repoUrl = 'https://github.com/wastercaliari/transcribr';
    const commitUrl = `${repoUrl}/commit/${sha}`;
    const branchUrl = `${repoUrl}/tree/${branch}`;

    for (const key of issueKeys) {
        try {
            // 1. Registra o Remote Link do Commit
            await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${key}/remotelink`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + auth,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    object: {
                        url: commitUrl,
                        title: `GitHub Commit: ${sha.slice(0, 7)} (${message})`,
                        icon: {
                            url16x16: 'https://github.githubassets.com/favicons/favicon.png',
                            title: 'GitHub Commit'
                        }
                    }
                })
            });

            // 2. Registra o Remote Link da Branch
            await fetch(`https://wastercaliari.atlassian.net/rest/api/3/issue/${key}/remotelink`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + auth,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    object: {
                        url: branchUrl,
                        title: `GitHub Branch: ${branch}`,
                        icon: {
                            url16x16: 'https://github.githubassets.com/favicons/favicon.png',
                            title: 'GitHub Branch'
                        }
                    }
                })
            });

            console.log(`🔗 ${key} vinculado com sucesso ao GitHub (commit ${sha.slice(0, 7)} na branch ${branch})`);
        } catch (e) {
            console.warn(`Falha ao vincular ${key} ao GitHub:`, e.message);
        }
    }
}

if (require.main === module) {
    const targetSha = process.argv[2] || null;
    const targetBranch = process.argv[3] || null;
    linkCommitToJira(targetSha, targetBranch).catch(console.error);
}

module.exports = { linkCommitToJira };
