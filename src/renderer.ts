import type { Session, Phase, SessionEvent } from "./types";

// ── SVG constants ────────────────────────────────────────────────────

const COL_W = 200;
const ROW_H = 50;
const HEADER_H = 80;
const PAD_X = 40;
const PAD_Y = 20;
const ARROW_COLORS: Record<string, string> = {
  spawn: "#059669",
  result: "#2563eb",
  message: "#d97706",
  shutdown: "#dc2626",
  team_create: "#7c3aed",
  team_delete: "#7c3aed",
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

  // Defs: arrowhead markers + subtle shadow filter
  lines.push("<defs>");
  for (const [type, color] of Object.entries(ARROW_COLORS)) {
    lines.push(
      `<marker id="ah-${type}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">` +
        `<polygon points="0 0, 10 3.5, 0 7" fill="${color}"/>` +
        `</marker>`
    );
  }
  // Subtle drop shadow for participant boxes
  lines.push(
    `<filter id="box-shadow" x="-4%" y="-4%" width="108%" height="116%">` +
      `<feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.06"/>` +
    `</filter>`
  );
  lines.push("</defs>");

  // Background
  lines.push(
    `<rect width="${width}" height="${height}" fill="#ffffff" rx="8"/>` +
    `<rect width="${width}" height="${height}" fill="none" stroke="#e5e7eb" stroke-width="1" rx="8"/>`
  );

  // Header: participant boxes
  for (let i = 0; i < agents.length; i++) {
    const x = PAD_X + i * COL_W + COL_W / 2;
    const agent = agents[i];
    const boxW = COL_W - 20;
    lines.push(
      `<rect x="${x - boxW / 2}" y="${PAD_Y}" width="${boxW}" height="48" rx="8" ` +
        `fill="#ffffff" stroke="${agent.type === 'host' ? '#d1d5db' : '#bfdbfe'}" stroke-width="1" filter="url(#box-shadow)"/>`
    );
    lines.push(
      `<text x="${x}" y="${PAD_Y + 20}" text-anchor="middle" fill="#111827" ` +
        `font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" font-size="12" font-weight="600">${escHtml(agent.name)}</text>`
    );
    lines.push(
      `<text x="${x}" y="${PAD_Y + 36}" text-anchor="middle" fill="#6b7280" ` +
        `font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" font-size="10" font-weight="400">${escHtml(agent.type)}</text>`
    );
  }

  // Lifelines
  for (let i = 0; i < agents.length; i++) {
    const x = PAD_X + i * COL_W + COL_W / 2;
    lines.push(
      `<line x1="${x}" y1="${HEADER_H}" x2="${x}" y2="${height - PAD_Y}" ` +
        `stroke="#e5e7eb" stroke-width="1" stroke-dasharray="6,4"/>`
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
      `<text x="4" y="${y + 4}" fill="#9ca3af" font-family="'SF Mono', 'Cascadia Code', 'Fira Code', monospace" font-size="9">${timeStr}</text>`
    );

    const color = ARROW_COLORS[evt.type] ?? "#9ca3af";

    if (fromCol !== undefined && toCol !== undefined) {
      if (fromCol === toCol) {
        // Self-event: small loop
        const x = PAD_X + fromCol * COL_W + COL_W / 2;
        lines.push(
          `<path d="M ${x} ${y} C ${x + 40} ${y - 15}, ${x + 40} ${y + 15}, ${x} ${y}" ` +
            `fill="none" stroke="${color}" stroke-width="1.5"/>`
        );
        lines.push(
          `<text x="${x + 45}" y="${y + 4}" fill="${color}" ` +
            `font-family="'SF Mono', 'Cascadia Code', 'Fira Code', monospace" font-size="11">${escHtml(evt.label)}</text>`
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
            `stroke="${color}" stroke-width="1.5" marker-end="url(#ah-${evt.type})"/>`
        );

        // Label above arrow
        const midX = (ax1 + ax2) / 2;
        lines.push(
          `<text x="${midX}" y="${y - 8}" text-anchor="middle" fill="${color}" ` +
            `font-family="'SF Mono', 'Cascadia Code', 'Fira Code', monospace" font-size="11">${escHtml(evt.label)}</text>`
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
    background: #f8f9fa;
    color: #1f2937;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* ── Header ────────────────────────────────────────────── */
  header {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    padding: 24px 40px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  header h1 {
    font-size: 17px;
    font-weight: 600;
    color: #111827;
    letter-spacing: -0.01em;
  }
  header .meta {
    display: flex;
    gap: 28px;
    margin-top: 8px;
    color: #6b7280;
    font-size: 13px;
  }
  header .meta span {
    white-space: nowrap;
  }
  header .meta span::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 3px;
    background: #d1d5db;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 8px;
  }
  header .meta span:first-child::before {
    display: none;
  }

  /* ── Legend ─────────────────────────────────────────────── */
  .legend {
    display: flex;
    gap: 24px;
    padding: 12px 40px;
    background: #ffffff;
    border-bottom: 1px solid #f0f0f0;
    font-size: 12px;
    color: #6b7280;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 7px;
    transition: color 0.15s ease;
  }
  .legend-item:hover {
    color: #374151;
  }
  .legend-dot {
    width: 14px;
    height: 3px;
    border-radius: 2px;
  }

  /* ── Main ───────────────────────────────────────────────── */
  main {
    padding: 32px 40px;
    max-width: 100%;
  }

  /* ── Phase cards ────────────────────────────────────────── */
  .phase {
    background: #ffffff;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
    transition: box-shadow 0.2s ease;
  }
  .phase:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
  }
  .phase h2 {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 2px;
    letter-spacing: -0.01em;
  }
  .phase-meta {
    color: #9ca3af;
    font-size: 12px;
    margin-bottom: 20px;
    letter-spacing: 0.01em;
  }

  /* ── Diagram ────────────────────────────────────────────── */
  .diagram-container {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid #f0f0f0;
    background: #ffffff;
  }
  .diagram-container svg { display: block; }

  /* Hover effect on event rows */
  .evt-row .row-bg { transition: fill 0.15s ease; }
  .evt-row:hover .row-bg { fill: rgba(59, 130, 246, 0.04); }

  /* ── Detail panel ───────────────────────────────────────── */
  #detail-panel {
    position: fixed;
    top: 0;
    right: -480px;
    width: 480px;
    height: 100vh;
    background: #ffffff;
    border-left: 1px solid #e5e7eb;
    overflow-y: auto;
    transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 100;
    box-shadow: -8px 0 30px rgba(0,0,0,0.08);
  }
  #detail-panel.open { right: 0; }

  #detail-panel .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #f0f0f0;
    position: sticky;
    top: 0;
    background: #ffffff;
    z-index: 1;
  }
  #detail-panel .panel-header h3 {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    letter-spacing: 0.04em;
  }
  #detail-panel .close-btn {
    background: none;
    border: 1px solid #e5e7eb;
    color: #9ca3af;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }
  #detail-panel .close-btn:hover {
    background: #f3f4f6;
    color: #374151;
    border-color: #d1d5db;
  }
  #detail-panel .panel-body { padding: 20px 24px; }

  .detail-field {
    margin-bottom: 16px;
  }
  .detail-field .label {
    font-size: 11px;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
    margin-bottom: 4px;
  }
  .detail-field .value {
    color: #1f2937;
    font-size: 13px;
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    white-space: pre-wrap;
    word-break: break-word;
    background: #f8f9fa;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #f0f0f0;
    max-height: 300px;
    overflow-y: auto;
    line-height: 1.5;
  }

  /* ── Backdrop overlay when panel is open ────────────────── */
  #panel-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.08);
    z-index: 99;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  #panel-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }

  /* ── Scrollbar styling ──────────────────────────────────── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

  /* ── Selection color ────────────────────────────────────── */
  ::selection { background: rgba(59, 130, 246, 0.15); }
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
  <div class="legend-item"><div class="legend-dot" style="background:#059669"></div> Spawn</div>
  <div class="legend-item"><div class="legend-dot" style="background:#2563eb"></div> Result</div>
  <div class="legend-item"><div class="legend-dot" style="background:#d97706"></div> Message</div>
  <div class="legend-item"><div class="legend-dot" style="background:#dc2626"></div> Shutdown</div>
  <div class="legend-item"><div class="legend-dot" style="background:#7c3aed"></div> Team op</div>
</div>

<main>
${phaseSections}
</main>

<div id="panel-backdrop"></div>

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
  const backdrop = document.getElementById('panel-backdrop');

  function closePanel() {
    panel.classList.remove('open');
    backdrop.classList.remove('visible');
  }

  closeBtn.addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
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
      backdrop.classList.add('visible');
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
