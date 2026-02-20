import type { Session, Phase, SessionEvent } from "./types";

// ── SVG constants ────────────────────────────────────────────────────

const COL_W = 220;
const ROW_H = 54;
const HEADER_H = 104;
const PAD_X = 64;
const PAD_Y = 28;

const ARROW_COLORS: Record<string, string> = {
  spawn: "#4ade80",
  result: "#60a5fa",
  message: "#fb923c",
  shutdown: "#f87171",
  team_create: "#c084fc",
  team_delete: "#c084fc",
};

const AGENT_STYLES: Record<string, { fill: string; stroke: string; nameColor: string; typeColor: string }> = {
  host: { fill: "#0c1e36", stroke: "#3b82f6", nameColor: "#e0f2fe", typeColor: "#7dd3fc" },
  default: { fill: "#130c28", stroke: "#7c3aed", nameColor: "#ede9fe", typeColor: "#c4b5fd" },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  spawn: "#4ade80",
  result: "#60a5fa",
  message: "#fb923c",
  shutdown: "#f87171",
  team_create: "#c084fc",
  team_delete: "#c084fc",
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
  const height = HEADER_H + events.length * ROW_H + PAD_Y * 2 + 20;

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  );

  // Defs: arrowhead markers + gradients
  lines.push("<defs>");

  // Arrowhead markers
  for (const [type, color] of Object.entries(ARROW_COLORS)) {
    lines.push(
      `<marker id="ah-${type}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">` +
        `<polygon points="0 0, 10 3.5, 0 7" fill="${color}" opacity="0.9"/>` +
        `</marker>`
    );
  }

  // Background gradient
  lines.push(
    `<linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#18181b"/>` +
      `<stop offset="100%" stop-color="#101014"/>` +
      `</linearGradient>`
  );

  // Agent box gradients
  lines.push(
    `<linearGradient id="host-grad" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#0c1e36"/>` +
      `<stop offset="100%" stop-color="#07111f"/>` +
      `</linearGradient>`
  );
  lines.push(
    `<linearGradient id="agent-grad" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="#130c28"/>` +
      `<stop offset="100%" stop-color="#0b0719"/>` +
      `</linearGradient>`
  );

  // Row highlight filter
  lines.push(
    `<filter id="row-glow"><feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>`
  );

  lines.push("</defs>");

  // Background
  lines.push(
    `<rect width="${width}" height="${height}" fill="url(#bg-grad)" rx="10"/>`
  );

  // Subtle grid lines (vertical zone separators)
  for (let i = 0; i < agents.length; i++) {
    const x = PAD_X + i * COL_W;
    if (i > 0) {
      lines.push(
        `<line x1="${x}" y1="${HEADER_H - 10}" x2="${x}" y2="${height - PAD_Y}" stroke="#27272a" stroke-width="1" stroke-dasharray="1,3"/>`
      );
    }
  }

  // Header: participant boxes
  for (let i = 0; i < agents.length; i++) {
    const cx = PAD_X + i * COL_W + COL_W / 2;
    const agent = agents[i];
    const style = agent.type === "host" ? AGENT_STYLES.host : AGENT_STYLES.default;
    const boxW = COL_W - 24;
    const boxH = 58;
    const bx = cx - boxW / 2;
    const by = PAD_Y;

    // Box shadow via blur rect
    lines.push(
      `<rect x="${bx + 2}" y="${by + 3}" width="${boxW}" height="${boxH}" rx="8" fill="${style.stroke}" opacity="0.12"/>`
    );

    // Main box
    lines.push(
      `<rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="8" ` +
        `fill="${agent.type === "host" ? "url(#host-grad)" : "url(#agent-grad)"}" ` +
        `stroke="${style.stroke}" stroke-width="1.5"/>`
    );

    // Top accent line
    lines.push(
      `<line x1="${bx + 8}" y1="${by}" x2="${bx + boxW - 8}" y2="${by}" ` +
        `stroke="${style.stroke}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`
    );

    // Agent name
    const displayName = agent.name.length > 14 ? agent.name.slice(0, 13) + "…" : agent.name;
    lines.push(
      `<text x="${cx}" y="${by + 24}" text-anchor="middle" fill="${style.nameColor}" ` +
        `font-family="'SF Mono','Cascadia Code','Fira Code',monospace" font-size="12" font-weight="700" ` +
        `letter-spacing="0.3">${escHtml(displayName)}</text>`
    );

    // Type badge background
    const typeLabelW = Math.min(agent.type.length * 6.5 + 12, boxW - 16);
    lines.push(
      `<rect x="${cx - typeLabelW / 2}" y="${by + 32}" width="${typeLabelW}" height="16" rx="4" ` +
        `fill="${style.stroke}" opacity="0.2"/>`
    );
    const displayType = agent.type.length > 16 ? agent.type.slice(0, 15) + "…" : agent.type;
    lines.push(
      `<text x="${cx}" y="${by + 43}" text-anchor="middle" fill="${style.typeColor}" ` +
        `font-family="'SF Mono','Cascadia Code','Fira Code',monospace" font-size="9" font-weight="600" ` +
        `letter-spacing="0.5">${escHtml(displayType)}</text>`
    );
  }

  // Lifelines
  for (let i = 0; i < agents.length; i++) {
    const x = PAD_X + i * COL_W + COL_W / 2;
    const agent = agents[i];
    const style = agent.type === "host" ? AGENT_STYLES.host : AGENT_STYLES.default;
    lines.push(
      `<line x1="${x}" y1="${HEADER_H}" x2="${x}" y2="${height - PAD_Y}" ` +
        `stroke="${style.stroke}" stroke-width="1" stroke-dasharray="5,5" opacity="0.3"/>`
    );
  }

  // Event rows
  for (let row = 0; row < events.length; row++) {
    const evt = events[row];
    const y = HEADER_H + row * ROW_H + ROW_H / 2;
    const fromCol = nameToCol.get(evt.from);
    const toCol = nameToCol.get(evt.to);

    const detailJson = escHtml(JSON.stringify(evt.detail));
    const groupAttrs =
      `class="evt-row" data-type="${escHtml(evt.type)}" ` +
      `data-detail="${detailJson}" ` +
      `data-from="${escHtml(evt.from)}" data-to="${escHtml(evt.to)}" ` +
      `data-ts="${escHtml(evt.timestamp)}" ` +
      `data-label="${escHtml(evt.label)}" ` +
      `style="cursor:pointer"`;

    lines.push(`<g ${groupAttrs}>`);

    // Alternating row background
    const rowBg = row % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent";
    lines.push(
      `<rect x="0" y="${y - ROW_H / 2}" width="${width}" height="${ROW_H}" ` +
        `fill="${rowBg}" class="row-bg"/>`
    );

    // Row number
    lines.push(
      `<text x="8" y="${y + 4}" fill="#52525b" font-family="monospace" font-size="8" text-anchor="start">${row + 1}</text>`
    );

    // Timestamp label
    const timeStr = evt.timestamp.slice(11, 19);
    lines.push(
      `<text x="${PAD_X - 6}" y="${y + 4}" fill="#52525b" font-family="'SF Mono','Cascadia Code',monospace" ` +
        `font-size="9" text-anchor="end">${timeStr}</text>`
    );

    const color = ARROW_COLORS[evt.type] ?? "#a1a1aa";

    if (fromCol !== undefined && toCol !== undefined) {
      if (fromCol === toCol) {
        // Self-event: loop
        const x = PAD_X + fromCol * COL_W + COL_W / 2;
        lines.push(
          `<path d="M ${x} ${y - 8} C ${x + 50} ${y - 18}, ${x + 50} ${y + 10}, ${x} ${y + 8}" ` +
            `fill="none" stroke="${color}" stroke-width="1.5" opacity="0.85"/>`
        );
        // Label pill
        const labelText = escHtml(evt.label.length > 16 ? evt.label.slice(0, 15) + "…" : evt.label);
        const pillW = Math.min(evt.label.length * 6 + 16, 120);
        lines.push(
          `<rect x="${x + 52}" y="${y - 9}" width="${pillW}" height="16" rx="4" fill="${color}" opacity="0.15"/>`
        );
        lines.push(
          `<text x="${x + 52 + pillW / 2}" y="${y + 3}" text-anchor="middle" fill="${color}" ` +
            `font-family="'SF Mono','Cascadia Code',monospace" font-size="10" font-weight="600">${labelText}</text>`
        );
      } else {
        // Arrow between columns
        const x1 = PAD_X + fromCol * COL_W + COL_W / 2;
        const x2 = PAD_X + toCol * COL_W + COL_W / 2;
        const dir = x2 > x1 ? 1 : -1;
        const ax1 = x1 + dir * 8;
        const ax2 = x2 - dir * 14;

        lines.push(
          `<line x1="${ax1}" y1="${y}" x2="${ax2}" y2="${y}" ` +
            `stroke="${color}" stroke-width="1.8" marker-end="url(#ah-${evt.type})" opacity="0.9"/>`
        );

        // Label pill above arrow
        const midX = (ax1 + ax2) / 2;
        const labelText = escHtml(evt.label.length > 20 ? evt.label.slice(0, 19) + "…" : evt.label);
        const pillW = Math.min(evt.label.length * 6 + 16, Math.abs(ax2 - ax1) - 16);
        if (pillW > 20) {
          lines.push(
            `<rect x="${midX - pillW / 2}" y="${y - ROW_H / 2 + 6}" width="${pillW}" height="16" rx="4" ` +
              `fill="${color}" opacity="0.12"/>`
          );
          lines.push(
            `<text x="${midX}" y="${y - ROW_H / 2 + 18}" text-anchor="middle" fill="${color}" ` +
              `font-family="'SF Mono','Cascadia Code',monospace" font-size="10" font-weight="600">${labelText}</text>`
          );
        }
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
  const totalAgents = session.agents.length - 1;
  const totalEvents = session.phases.reduce((s, p) => s + p.events.length, 0);
  const phaseSummary = session.phases.map((p) => p.name).join(" → ");
  const shortId = session.id.slice(0, 8);

  const phaseSections = session.phases
    .map(
      (phase, idx) => `
    <section class="phase">
      <div class="phase-header">
        <div class="phase-badge">${idx + 1}</div>
        <div class="phase-title-group">
          <h2>${escHtml(phase.name)}</h2>
          <div class="phase-meta">
            <span class="meta-chip"><span class="meta-icon">◈</span>${phase.agents.length} participants</span>
            <span class="meta-chip"><span class="meta-icon">⇄</span>${phase.events.length} events</span>
          </div>
        </div>
      </div>
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
<title>Session ${escHtml(shortId)} · CC Visualizer</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #09090b;
    --surface: #18181b;
    --surface-2: #27272a;
    --border: #3f3f46;
    --border-subtle: #27272a;
    --text: #fafafa;
    --text-2: #a1a1aa;
    --text-3: #71717a;
    --radius: 10px;
    --radius-sm: 6px;
    --c-spawn: #4ade80;
    --c-result: #60a5fa;
    --c-message: #fb923c;
    --c-shutdown: #f87171;
    --c-team: #c084fc;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #52525b; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 13px;
    line-height: 1.6;
    min-height: 100vh;
  }

  /* ── Header ───────────────────────────────────────────────── */
  header {
    background: var(--surface);
    border-bottom: 1px solid var(--border-subtle);
    position: relative;
    overflow: hidden;
  }
  header::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #7c3aed, #3b82f6, #06b6d4, #4ade80);
  }
  .header-inner {
    padding: 20px 28px 18px;
    max-width: 1600px;
  }
  .header-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .app-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    background: linear-gradient(135deg, #7c3aed, #3b82f6);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  header h1 {
    font-size: 17px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.3px;
  }
  .session-id {
    font-size: 12px;
    color: var(--text-3);
    background: var(--surface-2);
    border: 1px solid var(--border);
    padding: 2px 8px;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }
  .header-stats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .stat-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 4px 10px 4px 8px;
    font-size: 12px;
    color: var(--text-2);
  }
  .stat-pill .stat-icon { font-size: 10px; }
  .stat-pill .stat-value { color: var(--text); font-weight: 600; }

  /* ── Legend ───────────────────────────────────────────────── */
  .legend {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 28px;
    background: var(--surface);
    border-bottom: 1px solid var(--border-subtle);
    overflow-x: auto;
    flex-wrap: wrap;
  }
  .legend-label {
    font-size: 10px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-right: 4px;
    white-space: nowrap;
  }
  .legend-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid;
    white-space: nowrap;
    letter-spacing: 0.2px;
  }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  /* ── Main ─────────────────────────────────────────────────── */
  main { padding: 20px 28px; max-width: 1600px; }

  /* ── Phase cards ──────────────────────────────────────────── */
  .phase {
    background: var(--surface);
    border-radius: var(--radius);
    border: 1px solid var(--border-subtle);
    border-left: 3px solid #7c3aed;
    margin-bottom: 20px;
    overflow: hidden;
    transition: border-left-color 0.2s;
  }
  .phase:hover { border-left-color: #a78bfa; }
  .phase-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--border-subtle);
  }
  .phase-badge {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #e9d5ff;
    flex-shrink: 0;
  }
  .phase-title-group { flex: 1; }
  .phase-title-group h2 {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: -0.2px;
    margin-bottom: 5px;
  }
  .phase-meta {
    display: flex;
    gap: 8px;
  }
  .meta-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-3);
    background: var(--surface-2);
    padding: 2px 7px;
    border-radius: 4px;
  }
  .meta-icon { font-size: 9px; }
  .diagram-container {
    overflow-x: auto;
    padding: 4px 0;
  }
  .diagram-container svg { display: block; }

  /* ── SVG hover ────────────────────────────────────────────── */
  .evt-row .row-bg { transition: fill 0.1s; }
  .evt-row:hover .row-bg { fill: rgba(167,139,250,0.07) !important; }

  /* ── Detail panel ─────────────────────────────────────────── */
  #detail-panel {
    position: fixed;
    top: 0;
    right: -460px;
    width: 460px;
    height: 100vh;
    background: var(--surface);
    border-left: 1px solid var(--border);
    overflow-y: auto;
    transition: right 0.28s cubic-bezier(0.16,1,0.3,1);
    z-index: 100;
    box-shadow: -8px 0 32px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
  }
  #detail-panel.open { right: 0; }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
    position: sticky;
    top: 0;
    background: var(--surface);
    z-index: 1;
  }
  .panel-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #panel-type-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid;
  }
  #panel-title { font-size: 14px; font-weight: 700; color: var(--text); }
  .close-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-3);
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .close-btn:hover { background: var(--surface-2); color: var(--text); }

  .panel-body { padding: 16px 20px; flex: 1; }

  .detail-field { margin-bottom: 14px; }
  .detail-field .label {
    font-size: 10px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 4px;
  }
  .detail-field .value {
    color: var(--text-2);
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--bg);
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    max-height: 280px;
    overflow-y: auto;
    line-height: 1.5;
  }
  .detail-field .value.highlighted { color: var(--text); }

  /* JSON syntax highlighting */
  .json-key { color: #c084fc; }
  .json-str { color: #86efac; }
  .json-num { color: #fb923c; }
  .json-bool { color: #60a5fa; }
  .json-null { color: #71717a; }

  /* ── Empty state ──────────────────────────────────────────── */
  .empty-state {
    text-align: center;
    padding: 48px 24px;
    color: var(--text-3);
    font-size: 13px;
  }
  .empty-icon { font-size: 32px; margin-bottom: 12px; }
</style>
</head>
<body>

<header>
  <div class="header-inner">
    <div class="header-top">
      <div class="app-icon">◈</div>
      <h1>CC Session Visualizer</h1>
      <span class="session-id">${escHtml(shortId)}&hellip;</span>
    </div>
    <div class="header-stats">
      <div class="stat-pill">
        <span class="stat-icon">⏱</span>
        <span>Duration</span>
        <span class="stat-value">${escHtml(duration)}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-icon">◈</span>
        <span>Agents</span>
        <span class="stat-value">${totalAgents}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-icon">⇄</span>
        <span>Events</span>
        <span class="stat-value">${totalEvents}</span>
      </div>
      <div class="stat-pill">
        <span class="stat-icon">▤</span>
        <span>Phases</span>
        <span class="stat-value">${session.phases.length}</span>
      </div>
    </div>
  </div>
</header>

<div class="legend">
  <span class="legend-label">Event types</span>
  <div class="legend-pill" style="color:var(--c-spawn);border-color:rgba(74,222,128,0.3);background:rgba(74,222,128,0.08)">
    <div class="legend-dot" style="background:var(--c-spawn)"></div>Spawn
  </div>
  <div class="legend-pill" style="color:var(--c-result);border-color:rgba(96,165,250,0.3);background:rgba(96,165,250,0.08)">
    <div class="legend-dot" style="background:var(--c-result)"></div>Result
  </div>
  <div class="legend-pill" style="color:var(--c-message);border-color:rgba(251,146,60,0.3);background:rgba(251,146,60,0.08)">
    <div class="legend-dot" style="background:var(--c-message)"></div>Message
  </div>
  <div class="legend-pill" style="color:var(--c-shutdown);border-color:rgba(248,113,113,0.3);background:rgba(248,113,113,0.08)">
    <div class="legend-dot" style="background:var(--c-shutdown)"></div>Shutdown
  </div>
  <div class="legend-pill" style="color:var(--c-team);border-color:rgba(192,132,252,0.3);background:rgba(192,132,252,0.08)">
    <div class="legend-dot" style="background:var(--c-team)"></div>Team op
  </div>
</div>

<main>
${phaseSections}
</main>

<aside id="detail-panel">
  <div class="panel-header">
    <div class="panel-title-row">
      <span id="panel-type-badge"></span>
      <h3 id="panel-title">Event Detail</h3>
    </div>
    <button class="close-btn" id="close-panel">&times;</button>
  </div>
  <div class="panel-body" id="panel-body"></div>
</aside>

<script>
(function() {
  const panel = document.getElementById('detail-panel');
  const panelBody = document.getElementById('panel-body');
  const panelTitle = document.getElementById('panel-title');
  const panelBadge = document.getElementById('panel-type-badge');
  const closeBtn = document.getElementById('close-panel');

  const TYPE_COLORS = {
    spawn: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)' },
    result: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.35)' },
    message: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)' },
    shutdown: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' },
    team_create: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.35)' },
    team_delete: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.35)' },
  };

  closeBtn.addEventListener('click', () => panel.classList.remove('open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') panel.classList.remove('open');
  });

  document.querySelectorAll('.evt-row').forEach(g => {
    g.addEventListener('click', () => {
      const type = g.dataset.type || '';
      const from = g.dataset.from || '';
      const to = g.dataset.to || '';
      const ts = g.dataset.ts || '';
      const label = g.dataset.label || '';
      let detail = {};
      try {
        const raw = g.dataset.detail
          .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        detail = JSON.parse(raw);
      } catch(e) {}

      const tc = TYPE_COLORS[type] || { color: '#a1a1aa', bg: 'rgba(161,161,170,0.1)', border: 'rgba(161,161,170,0.3)' };
      panelBadge.textContent = type.replace('_', ' ').toUpperCase();
      panelBadge.style.color = tc.color;
      panelBadge.style.background = tc.bg;
      panelBadge.style.borderColor = tc.border;

      panelTitle.textContent = 'Event Detail';

      let html = '';
      html += field('From', from, false);
      html += field('To', to, false);
      html += field('Timestamp', ts, false);
      html += field('Label', label, false);

      for (const [k, v] of Object.entries(detail)) {
        if (v !== null && v !== undefined && v !== '') {
          const isJson = typeof v !== 'string';
          html += field(k, isJson ? JSON.stringify(v, null, 2) : v, isJson);
        }
      }

      panelBody.innerHTML = html || '<div class="empty-state"><div class="empty-icon">◈</div>No detail available</div>';
      panel.classList.add('open');
    });
  });

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function highlightJson(str) {
    return esc(str)
      .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="json-str">"$1"</span>')
      .replace(/: (-?\d+\.?\d*)/g, ': <span class="json-num">$1</span>')
      .replace(/: (true|false)/g, ': <span class="json-bool">$1</span>')
      .replace(/: null/g, ': <span class="json-null">null</span>');
  }

  function field(label, value, isCode) {
    const content = isCode
      ? '<div class="value highlighted">' + highlightJson(String(value)) + '</div>'
      : '<div class="value">' + esc(value) + '</div>';
    return '<div class="detail-field"><div class="label">' + esc(label) + '</div>' + content + '</div>';
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
