/**
 * test-render.ts
 *
 * Generates a demo HTML output from a mock session to visually verify
 * the renderer styling. Run with: bun run src/test-render.ts
 *
 * Writes: demo.html
 */

import { writeFileSync } from "fs";
import type { Session } from "./types";
import { renderHtml } from "./renderer";

// ── Mock Session ─────────────────────────────────────────────────────

const MOCK_SESSION: Session = {
  id: "abc123def456789012345678",
  startTime: "2024-06-15T10:00:00.000Z",
  endTime: "2024-06-15T10:08:47.000Z",
  agents: [
    { id: "host", name: "host", type: "host", description: "Orchestrator" },
    {
      id: "ag-explore",
      name: "Explore",
      type: "Explore",
      description: "Explores the codebase to find relevant files",
    },
    {
      id: "ag-plan",
      name: "Plan",
      type: "Plan",
      description: "Creates structured implementation plan",
    },
    {
      id: "ag-bash",
      name: "Bash",
      type: "Bash",
      description: "Executes shell commands",
    },
    {
      id: "ag-gp",
      name: "general-purpose",
      type: "general-purpose",
      description: "General purpose reasoning agent",
    },
  ],
  phases: [
    {
      name: "Phase 1: Exploration & Planning",
      agents: [
        { id: "host", name: "host", type: "host", description: "Orchestrator" },
        {
          id: "ag-explore",
          name: "Explore",
          type: "Explore",
          description: "Codebase explorer",
        },
        {
          id: "ag-plan",
          name: "Plan",
          type: "Plan",
          description: "Implementation planner",
        },
      ],
      events: [
        {
          type: "spawn",
          from: "host",
          to: "Explore",
          timestamp: "2024-06-15T10:00:01.120Z",
          label: "spawn:Explore",
          detail: {
            task: "Explore the repository structure and identify key source files",
            background: false,
            tool_use_id: "toolu_01ABC123",
          },
        },
        {
          type: "message",
          from: "Explore",
          to: "host",
          timestamp: "2024-06-15T10:00:08.440Z",
          label: "progress",
          detail: {
            content: "Scanning directory tree...",
            files_found: 24,
          },
        },
        {
          type: "result",
          from: "Explore",
          to: "host",
          timestamp: "2024-06-15T10:00:22.890Z",
          label: "result:Explore",
          detail: {
            files: ["src/index.ts", "src/parser.ts", "src/renderer.ts", "src/types.ts"],
            summary: "Found 4 source files. Main entry at src/index.ts.",
            duration_ms: 21770,
          },
        },
        {
          type: "spawn",
          from: "host",
          to: "Plan",
          timestamp: "2024-06-15T10:00:25.010Z",
          label: "spawn:Plan",
          detail: {
            task: "Create implementation plan for improving visual output of the session visualizer",
            background: false,
            context: ["src/renderer.ts", "src/types.ts"],
          },
        },
        {
          type: "result",
          from: "Plan",
          to: "host",
          timestamp: "2024-06-15T10:01:14.230Z",
          label: "result:Plan",
          detail: {
            steps: 5,
            plan: "1. Redesign CSS with CSS variables\n2. Improve SVG agent boxes\n3. Add pill-style legend\n4. Enhance detail panel\n5. Add JSON syntax highlighting",
            estimated_effort: "medium",
          },
        },
      ],
    },
    {
      name: "Phase 2: Implementation",
      agents: [
        { id: "host", name: "host", type: "host", description: "Orchestrator" },
        {
          id: "ag-gp",
          name: "general-purpose",
          type: "general-purpose",
          description: "Writes the implementation",
        },
        {
          id: "ag-bash",
          name: "Bash",
          type: "Bash",
          description: "Runs commands & tests",
        },
      ],
      events: [
        {
          type: "spawn",
          from: "host",
          to: "general-purpose",
          timestamp: "2024-06-15T10:01:18.100Z",
          label: "spawn:impl",
          detail: {
            task: "Rewrite renderer.ts with improved CSS design system and SVG enhancements",
            background: false,
            files_to_edit: ["src/renderer.ts"],
          },
        },
        {
          type: "spawn",
          from: "general-purpose",
          to: "Bash",
          timestamp: "2024-06-15T10:01:45.330Z",
          label: "spawn:Bash",
          detail: {
            task: "Run TypeScript type check",
            command: "bun tsc --noEmit",
            background: true,
          },
        },
        {
          type: "message",
          from: "Bash",
          to: "general-purpose",
          timestamp: "2024-06-15T10:02:01.780Z",
          label: "stdout",
          detail: {
            output: "No type errors found.",
            exit_code: 0,
          },
        },
        {
          type: "result",
          from: "Bash",
          to: "general-purpose",
          timestamp: "2024-06-15T10:02:02.100Z",
          label: "result:Bash",
          detail: {
            success: true,
            duration_ms: 16770,
          },
        },
        {
          type: "message",
          from: "general-purpose",
          to: "host",
          timestamp: "2024-06-15T10:03:12.440Z",
          label: "progress",
          detail: {
            message: "CSS variables defined, SVG improvements in progress...",
            percent_complete: 60,
          },
        },
        {
          type: "result",
          from: "general-purpose",
          to: "host",
          timestamp: "2024-06-15T10:05:33.900Z",
          label: "result:impl",
          detail: {
            files_changed: ["src/renderer.ts"],
            lines_added: 280,
            lines_removed: 110,
            summary: "Renderer redesigned with zinc palette, CSS variables, improved SVG headers and arrows, pill legend, better detail panel.",
          },
        },
      ],
    },
    {
      name: "Phase 3: Verification & Commit",
      agents: [
        { id: "host", name: "host", type: "host", description: "Orchestrator" },
        {
          id: "ag-bash",
          name: "Bash",
          type: "Bash",
          description: "Git operations & build",
        },
      ],
      events: [
        {
          type: "spawn",
          from: "host",
          to: "Bash",
          timestamp: "2024-06-15T10:05:40.000Z",
          label: "spawn:verify",
          detail: {
            task: "Run build and commit changes",
            background: false,
          },
        },
        {
          type: "message",
          from: "Bash",
          to: "host",
          timestamp: "2024-06-15T10:05:55.100Z",
          label: "build",
          detail: {
            command: "bun build src/index.ts",
            output: "Build complete. 0 errors.",
          },
        },
        {
          type: "message",
          from: "Bash",
          to: "Bash",
          timestamp: "2024-06-15T10:06:02.300Z",
          label: "git:add",
          detail: {
            command: "git add src/renderer.ts src/test-render.ts",
          },
        },
        {
          type: "message",
          from: "Bash",
          to: "host",
          timestamp: "2024-06-15T10:06:08.700Z",
          label: "git:commit",
          detail: {
            commit: "feat: redesign renderer with modern zinc dark theme",
            sha: "d4e5f6a",
          },
        },
        {
          type: "shutdown",
          from: "Bash",
          to: "host",
          timestamp: "2024-06-15T10:06:10.000Z",
          label: "shutdown",
          detail: { reason: "task complete", exit_code: 0 },
        },
        {
          type: "shutdown",
          from: "host",
          to: "host",
          timestamp: "2024-06-15T10:06:12.000Z",
          label: "session end",
          detail: {
            total_agents_used: 4,
            total_events: 17,
            success: true,
          },
        },
      ],
    },
  ],
};

// ── Run ──────────────────────────────────────────────────────────────

const html = renderHtml(MOCK_SESSION);
const outFile = "demo.html";
writeFileSync(outFile, html, "utf-8");

console.log(`✓ Rendered demo session to ${outFile} (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`  Phases: ${MOCK_SESSION.phases.length}`);
console.log(`  Agents: ${MOCK_SESSION.agents.length - 1}`);
console.log(
  `  Events: ${MOCK_SESSION.phases.reduce((s, p) => s + p.events.length, 0)}`
);
console.log(`\nOpen in browser: open ${outFile}`);
