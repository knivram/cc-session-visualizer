import { writeFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import { homedir } from "os";
import { parseSession } from "./parser";
import { renderHtml } from "./renderer";

const input = process.argv[2];
if (!input) {
  console.error("Usage: bun run src/index.ts <session-id>");
  console.error("  Searches ~/.claude/projects/*/  for the matching session.");
  console.error("  Accepts a full UUID or a prefix (e.g. first 8 chars).");
  process.exit(1);
}

function findSession(idOrPrefix: string): string {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) {
    console.error(`Projects directory not found: ${projectsDir}`);
    process.exit(1);
  }

  const matches: string[] = [];

  for (const project of readdirSync(projectsDir)) {
    const projectPath = join(projectsDir, project);
    let entries: string[];
    try {
      entries = readdirSync(projectPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue;
      const sessionId = entry.replace(".jsonl", "");
      if (sessionId === idOrPrefix || sessionId.startsWith(idOrPrefix)) {
        matches.push(join(projectPath, entry));
      }
    }
  }

  if (matches.length === 0) {
    console.error(`No session found matching: ${idOrPrefix}`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Multiple sessions match "${idOrPrefix}":`);
    for (const m of matches) console.error(`  ${m}`);
    console.error("Please use a longer prefix to disambiguate.");
    process.exit(1);
  }
  return matches[0];
}

const inputPath = findSession(input);
console.log(`Parsing session from: ${inputPath}`);

const session = parseSession(inputPath);
console.log(
  `Found ${session.agents.length - 1} agents, ${session.phases.length} phases`
);
for (const phase of session.phases) {
  console.log(
    `  ${phase.name}: ${phase.agents.length} participants, ${phase.events.length} events`
  );
}

const html = renderHtml(session);
const outFile = `session-${session.id.slice(0, 8)}.html`;
writeFileSync(outFile, html, "utf-8");
console.log(`Wrote ${outFile} (${(html.length / 1024).toFixed(1)} KB)`);
