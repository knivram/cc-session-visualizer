import type { Session, Phase, SessionEvent } from "./types";

// ── SVG constants ────────────────────────────────────────────────────

const COL_W = 200;
const ROW_H = 50;
const HEADER_H = 80;
const PAD_X = 40;
const PAD_Y = 20;
const ARROW_COLORS: Record<string, string> = {
  spawn: "#4ade80",
  result: "#60a5fa",
  message: "#fb923c",
  shutdown: "#f87171",
  team_create: "#a78bfa",
  team_delete: "#a78bfa",
};

// ── SVG generation ───────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


function renderPhaseSvg(phase: Phase): string {
  const agents = phase.agents;
  const events = phase.events;
  const nameToCol = new Map<string, number>();
  agents.forEach((a, i) => nameToCol.set(a.name, i));

  const width = agents.length * COL_W + PAD_X * 2;
  const height = HEADER_H + events.length * ROW_H + PAD_Y * 2 + 30;

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  );

  // Defs: arrowhead markers
  lines.push("<defs>");
  for (const [type, color] of Object.entries(ARROW_COLORS)) {
    lines.push(
      `<marker id="ah-${type}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">` +
        `<polygon points="0 0, 10 3.5, 0 7" fill="${color}"/>` +
        `</marker>`
    );
  }
  lines.push("</defs>");

  // Background
  lines.push(
    `<rect width="${width}" height="${height}" fill="#1e293b" rx="8"/>`
  );

  // Header: participant boxes
  for (let i = 0; i < agents.length; i++) {
    const x = PAD_X + i * COL_W + COL_W / 2;
    const agent = agents[i];
    const boxW = COL_W - 20;
    lines.push(
      `<rect x="${x - boxW / 2}" y="${PAD_Y}" width="${boxW}" height="48" rx="6" ` +
        `fill="${agent.type === 'host' ? '#334155' : '#1e3a5f'}" stroke="#475569" stroke-width="1"/>`
    );
    lines.push(
      `<text x="${x}" y="${PAD_Y + 20}" text-anchor="middle" fill="#e2e8f0" ` +
        `font-family="monospace" font-size="12" font-weight="bold">${escHtml(agent.name)}</text>`
    );
    lines.push(
      `<text x="${x}" y="${PAD_Y + 36}" text-anchor="middle" fill="#94a3b8" ` +
        `font-family="monospace" font-size="10">${escHtml(agent.type)}</text>`
    );
  }

  // Lifelines
  for (let i = 0; i < agents.length; i++) {
    const x = PAD_X + i * COL_W + COL_W / 2;
    lines.push(
      `<line x1="${x}" y1="${HEADER_H}" x2="${x}" y2="${height - PAD_Y}" ` +
        `stroke="#475569" stroke-width="1" stroke-dasharray="6,4"/>`
    );
  }

  // Event rows
  for (let row = 0; row < events.length; row++) {
    const evt = events[row];
    const y = HEADER_H + row * ROW_H + ROW_H / 2;
    const fromCol = nameToCol.get(evt.from);
    const toCol = nameToCol.get(evt.to);

    // Encode detail as data attribute
    const detailJson = escHtml(JSON.stringify(evt.detail));
    const groupAttrs =
      `class="evt-row" data-type="${evt.type}" ` +
      `data-detail="${detailJson}" ` +
      `data-from="${escHtml(evt.from)}" data-to="${escHtml(evt.to)}" ` +
      `data-ts="${escHtml(evt.timestamp)}" ` +
      `data-label="${escHtml(evt.label)}" ` +
      `style="cursor:pointer"`;

    lines.push(`<g ${groupAttrs}>`);

    // Hover highlight row
    lines.push(
      `<rect x="0" y="${y - ROW_H / 2}" width="${width}" height="${ROW_H}" ` +
        `fill="transparent" class="row-bg"/>`
    );

    // Timestamp label on far left
    const timeStr = evt.timestamp.slice(11, 19); // HH:MM:SS
    lines.push(
      `<text x="4" y="${y + 4}" fill="#64748b" font-family="monospace" font-size="9">${timeStr}</text>`
    );

    const color = ARROW_COLORS[evt.type] ?? "#94a3b8";

    if (fromCol !== undefined && toCol !== undefined) {
      if (fromCol === toCol) {
        // Self-event: small loop
        const x = PAD_X + fromCol * COL_W + COL_W / 2;
        lines.push(
          `<path d="M ${x} ${y} C ${x + 40} ${y - 15}, ${x + 40} ${y + 15}, ${x} ${y}" ` +
            `fill="none" stroke="${color}" stroke-width="2"/>`
        );
        lines.push(
          `<text x="${x + 45}" y="${y + 4}" fill="${color}" ` +
            `font-family="monospace" font-size="11">${escHtml(evt.label)}</text>`
        );
      } else {
        // Arrow between columns
        const x1 = PAD_X + fromCol * COL_W + COL_W / 2;
        const x2 = PAD_X + toCol * COL_W + COL_W / 2;
        const dir = x2 > x1 ? 1 : -1;
        const ax1 = x1 + dir * 8;
        const ax2 = x2 - dir * 8;

        lines.push(
          `<line x1="${ax1}" y1="${y}" x2="${ax2}" y2="${y}" ` +
            `stroke="${color}" stroke-width="2" marker-end="url(#ah-${evt.type})"/>`
        );

        // Label above arrow
        const midX = (ax1 + ax2) / 2;
        lines.push(
          `<text x="${midX}" y="${y - 8}" text-anchor="middle" fill="${color}" ` +
            `font-family="monospace" font-size="11">${escHtml(evt.label)}</text>`
        );
      }
    }

    lines.push("</g>");
  }

  lines.push("</svg>");
  return lines.join("\n");
}

// ── HTML generation ──────────────────────────────────────────────────

export function renderHtml(session: Session): string {
  const duration = computeDuration(session.startTime, session.endTime);
  const totalAgents = session.agents.length - 1; // exclude host
  const phaseSummary = session.phases.map((p) => p.name).join(" → ");

  const phaseSections = session.phases
    .map(
      (phase) => `
    <section class="phase">
      <h2>${escHtml(phase.name)}</h2>
      <p class="phase-meta">${phase.agents.length} participants &middot; ${phase.events.length} events</p>
      <div class="diagram-container">
        ${renderPhaseSvg(phase)}
      </div>
    </section>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session ${escHtml(session.id.slice(0, 8))}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0f172a;
    color: #e2e8f0;
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    font-size: 14px;
    line-height: 1.6;
  }
  header {
    background: #1e293b;
    border-bottom: 1px solid #334155;
    padding: 20px 32px;
  }
  header h1 {
    font-size: 18px;
    font-weight: 600;
    color: #f1f5f9;
  }
  header .meta {
    display: flex;
    gap: 24px;
    margin-top: 8px;
    color: #94a3b8;
    font-size: 13px;
  }
  header .meta span { white-space: nowrap; }
  main { padding: 24px 32px; max-width: 100%; }
  .phase {
    background: #1e293b;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
    border: 1px solid #334155;
  }
  .phase h2 {
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 4px;
  }
  .phase-meta {
    color: #64748b;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .diagram-container {
    overflow-x: auto;
    border-radius: 8px;
  }
  .diagram-container svg { display: block; }

  /* Hover effect on event rows */
  .evt-row .row-bg { transition: fill 0.15s; }
  .evt-row:hover .row-bg { fill: rgba(148, 163, 184, 0.08); }

  /* Detail panel */
  #detail-panel {
    position: fixed;
    top: 0;
    right: -440px;
    width: 440px;
    height: 100vh;
    background: #1e293b;
    border-left: 1px solid #334155;
    overflow-y: auto;
    transition: right 0.25s ease;
    z-index: 100;
    box-shadow: -4px 0 20px rgba(0,0,0,0.4);
  }
  #detail-panel.open { right: 0; }
  #detail-panel .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #334155;
    position: sticky;
    top: 0;
    background: #1e293b;
  }
  #detail-panel .panel-header h3 { font-size: 14px; color: #f1f5f9; }
  #detail-panel .close-btn {
    background: none;
    border: 1px solid #475569;
    color: #94a3b8;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #detail-panel .close-btn:hover { background: #334155; color: #e2e8f0; }
  #detail-panel .panel-body { padding: 16px 20px; }
  .detail-field {
    margin-bottom: 12px;
  }
  .detail-field .label {
    font-size: 11px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .detail-field .value {
    color: #e2e8f0;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-word;
    background: #0f172a;
    padding: 8px 10px;
    border-radius: 6px;
    max-height: 300px;
    overflow-y: auto;
  }

  /* Legend */
  .legend {
    display: flex;
    gap: 20px;
    padding: 12px 32px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    font-size: 12px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #94a3b8;
  }
  .legend-dot {
    width: 12px;
    height: 3px;
    border-radius: 2px;
  }
</style>
</head>
<body>

<header>
  <h1>CC Session Visualizer</h1>
  <div class="meta">
    <span>Session: ${escHtml(session.id.slice(0, 8))}&hellip;</span>
    <span>Duration: ${escHtml(duration)}</span>
    <span>Agents: ${totalAgents}</span>
    <span>Phases: ${escHtml(phaseSummary)}</span>
  </div>
</header>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:#4ade80"></div> Spawn</div>
  <div class="legend-item"><div class="legend-dot" style="background:#60a5fa"></div> Result</div>
  <div class="legend-item"><div class="legend-dot" style="background:#fb923c"></div> Message</div>
  <div class="legend-item"><div class="legend-dot" style="background:#f87171"></div> Shutdown</div>
  <div class="legend-item"><div class="legend-dot" style="background:#a78bfa"></div> Team op</div>
</div>

<main>
${phaseSections}
</main>

<aside id="detail-panel">
  <div class="panel-header">
    <h3 id="panel-title">Event Detail</h3>
    <button class="close-btn" id="close-panel">&times;</button>
  </div>
  <div class="panel-body" id="panel-body"></div>
</aside>

<script>
(function() {
  const panel = document.getElementById('detail-panel');
  const panelBody = document.getElementById('panel-body');
  const panelTitle = document.getElementById('panel-title');
  const closeBtn = document.getElementById('close-panel');

  closeBtn.addEventListener('click', () => panel.classList.remove('open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') panel.classList.remove('open');
  });

  document.querySelectorAll('.evt-row').forEach(g => {
    g.addEventListener('click', () => {
      const type = g.dataset.type;
      const from = g.dataset.from;
      const to = g.dataset.to;
      const ts = g.dataset.ts;
      const label = g.dataset.label;
      let detail = {};
      try { detail = JSON.parse(g.dataset.detail.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')); } catch(e) {}

      panelTitle.textContent = type.replace('_', ' ').toUpperCase();

      let html = '';
      html += field('Type', type);
      html += field('Timestamp', ts);
      html += field('From', from);
      html += field('To', to);
      html += field('Label', label);

      for (const [k, v] of Object.entries(detail)) {
        if (v !== null && v !== undefined && v !== '') {
          html += field(k, typeof v === 'string' ? v : JSON.stringify(v, null, 2));
        }
      }

      panelBody.innerHTML = html;
      panel.classList.add('open');
    });
  });

  function field(label, value) {
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return '<div class="detail-field"><div class="label">' + esc(label) + '</div><div class="value">' + esc(value) + '</div></div>';
  }
})();
</script>

</body>
</html>`;
}

function computeDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(ms) || ms < 0) return "?";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins > 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return `${mins}m ${secs}s`;
}
