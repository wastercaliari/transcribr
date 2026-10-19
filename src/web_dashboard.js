/**
 * TranscriBR - Dashboard Web Corporativo em Tempo Real
 * Ticket: SCRUM-56 (I-12)
 *
 * Responsável por renderizar a interface web executiva para telemetria,
 * monitoramento de saúde de motores STT, atas técnicas recentes e controle de sessões.
 */

'use strict';

/**
 * Escapa strings para renderização segura em HTML, prevenindo ataques XSS (CWE-79).
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Gera o documento HTML do Dashboard Web Corporativo.
 * @param {object} initialData Dados iniciais de status e telemetria
 * @returns {string} HTML renderizável
 */
function renderDashboardHtml(initialData = {}) {
  const botTag = escapeHtml(initialData.bot || 'TranscriBR');
  const uptime = Number(initialData.uptimeSeconds) || 0;
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const uptimeStr = `${hours}h ${minutes}m`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TranscriBR — Dashboard Corporativo de Telemetria</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-family);
      line-height: 1.5;
      padding: 1.5rem;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 1rem;
    }
    .header-title h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .header-title p {
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      background: rgba(34, 197, 94, 0.15);
      color: var(--success);
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--success);
      box-shadow: 0 0 8px var(--success);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .kpi-card .label {
      color: var(--text-muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
      margin-bottom: 0.35rem;
    }
    .kpi-card .value {
      font-size: 1.85rem;
      font-weight: 700;
      color: var(--text);
    }
    .kpi-card .subtext {
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-top: 0.35rem;
    }
    .main-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 900px) {
      .main-grid { grid-template-columns: 1fr; }
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 0.75rem;
    }
    .panel-header h2 {
      font-size: 1.15rem;
      font-weight: 600;
    }
    .table-container {
      overflow-x: auto;
      max-height: 400px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      background: rgba(15, 23, 42, 0.6);
      color: var(--text-muted);
      font-weight: 600;
      position: sticky;
      top: 0;
    }
    td {
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    }
    tr:hover td {
      background: rgba(56, 189, 248, 0.05);
    }
    .engine-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .engine-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: rgba(15, 23, 42, 0.5);
      border-radius: 0.5rem;
      border: 1px solid var(--card-border);
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    button, select {
      background: rgba(56, 189, 248, 0.15);
      color: var(--primary);
      border: 1px solid var(--primary);
      border-radius: 0.375rem;
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    button:hover {
      background: var(--primary);
      color: #0f172a;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-title">
      <h1>🎙️ TranscriBR Dashboard</h1>
      <p>Monitoramento Corporativo de Áudio, STT e Atas Técnicas em Tempo Real</p>
    </div>
    <div class="controls">
      <span class="status-badge" id="botBadge">
        <span class="status-dot"></span>
        <span id="botTag">${botTag}</span>
      </span>
      <select id="refreshRate" onchange="changeInterval()">
        <option value="3000">Atualizar (3s)</option>
        <option value="5000" selected>Atualizar (5s)</option>
        <option value="15000">Atualizar (15s)</option>
      </select>
      <button onclick="fetchData()">🔄 Atualizar</button>
    </div>
  </header>

  <section class="kpi-grid">
    <div class="kpi-card">
      <div class="label">Sessões Ativas</div>
      <div class="value" id="kpiSessions">${initialData.activeSessions || 0}</div>
      <div class="subtext">Canais de voz conectados</div>
    </div>
    <div class="kpi-card">
      <div class="label">Latência Média STT</div>
      <div class="value" id="kpiLatency">${initialData.telemetry?.avgLatencyMs || 0} ms</div>
      <div class="subtext">Tempo de resposta Whisper</div>
    </div>
    <div class="kpi-card">
      <div class="label">Falas Processadas</div>
      <div class="value" id="kpiPosted">${initialData.telemetry?.transcriptionsPosted || 0}</div>
      <div class="subtext" id="kpiDiscarded">Descartes: ${initialData.telemetry?.hallucinationsDiscarded || 0}</div>
    </div>
    <div class="kpi-card">
      <div class="label">Uptime & Memória</div>
      <div class="value" id="kpiUptime">${uptimeStr}</div>
      <div class="subtext" id="kpiMemory">Heap: ${initialData.memory?.heapUsedMb || 0}MB | RSS: ${initialData.memory?.rssMb || 0}MB</div>
    </div>
  </section>

  <main class="main-grid">
    <section class="panel">
      <div class="panel-header">
        <h2>📝 Histórico Recente de Falas & Atas</h2>
        <span style="font-size:0.8rem; color:var(--text-muted);" id="speechesCount">Últimos registros</span>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Horário</th>
              <th>Participante</th>
              <th>Fala Transcrita</th>
            </tr>
          </thead>
          <tbody id="speechesTableBody">
            <tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Carregando transcrições...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>⚡ Motores & Telemetria</h2>
      </div>
      <div class="engine-list">
        <div class="engine-item">
          <div>
            <strong>Groq Whisper Large-v3</strong>
            <p style="font-size:0.75rem; color:var(--text-muted);">Nuvem de ultra-baixa latência</p>
          </div>
          <span style="color:var(--success); font-weight:600;" id="sttGroqStatus">ATIVO</span>
        </div>
        <div class="engine-item">
          <div>
            <strong>Whisper Local (Fallback)</strong>
            <p style="font-size:0.75rem; color:var(--text-muted);">Offline / On-premise</p>
          </div>
          <span style="color:var(--text-muted); font-weight:600;" id="sttLocalStatus">OFFLINE</span>
        </div>
        <div class="engine-item">
          <div>
            <strong>Perfis Biométricos de Voz</strong>
            <p style="font-size:0.75rem; color:var(--text-muted);">Locutores matriculados</p>
          </div>
          <span style="color:var(--primary); font-weight:600;" id="biometricCount">0 perfis</span>
        </div>
      </div>
    </section>
  </main>

  <script>
    let timer = null;

    async function fetchData() {
      try {
        const [resStatus, resSpeeches] = await Promise.all([
          fetch('/api/status').then(r => r.json()).catch(() => null),
          fetch('/api/recent-speeches').then(r => r.json()).catch(() => [])
        ]);

        if (resStatus) {
          document.getElementById('kpiSessions').textContent = resStatus.activeSessions || 0;
          document.getElementById('kpiLatency').textContent = (resStatus.telemetry?.avgLatencyMs || 0) + ' ms';
          document.getElementById('kpiPosted').textContent = resStatus.telemetry?.transcriptionsPosted || 0;
          document.getElementById('kpiDiscarded').textContent = 'Descartes: ' + (resStatus.telemetry?.hallucinationsDiscarded || 0) + ' | Pulos: ' + (resStatus.telemetry?.duplicatesSkipped || 0);

          const up = resStatus.uptimeSeconds || 0;
          const h = Math.floor(up / 3600);
          const m = Math.floor((up % 3600) / 60);
          document.getElementById('kpiUptime').textContent = h + 'h ' + m + 'm';
          document.getElementById('kpiMemory').textContent = 'Heap: ' + (resStatus.memory?.heapUsedMb || 0) + 'MB | RSS: ' + (resStatus.memory?.rssMb || 0) + 'MB';

          if (resStatus.biometricProfiles !== undefined) {
            document.getElementById('biometricCount').textContent = resStatus.biometricProfiles + ' perfis';
          }
        }

        if (Array.isArray(resSpeeches)) {
          const tbody = document.getElementById('speechesTableBody');
          if (resSpeeches.length === 0) {
            tbody.innerHTML = '<tr><td colspan=\"3\" style=\"text-align:center; color:var(--text-muted);\">Nenhuma fala registrada na sessão recente.</td></tr>';
          } else {
            tbody.innerHTML = resSpeeches.slice(-15).reverse().map(s => {
              const d = new Date(s.t || Date.now());
              const timeStr = d.toLocaleTimeString('pt-BR');
              const author = (s.a || 'Alguém').replace(/</g, '&lt;');
              const text = (s.x || '').replace(/</g, '&lt;');
              return '<tr><td style=\"color:var(--text-muted); font-size:0.75rem;\">' + timeStr + '</td><td style=\"font-weight:600; color:var(--primary);\">' + author + '</td><td>' + text + '</td></tr>';
            }).join('');
            document.getElementById('speechesCount').textContent = resSpeeches.length + ' falas armazenadas';
          }
        }
      } catch (err) {
        console.error('Falha ao atualizar dashboard:', err);
      }
    }

    function changeInterval() {
      if (timer) clearInterval(timer);
      const val = Number(document.getElementById('refreshRate').value) || 5000;
      timer = setInterval(fetchData, val);
    }

    fetchData();
    changeInterval();
  </script>
</body>
</html>`;
}

module.exports = {
  escapeHtml,
  renderDashboardHtml
};
