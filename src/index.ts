import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parseSession } from "./parser";
import { renderHtml } from "./renderer";

const isTest = process.argv.includes("--test");
const input = isTest
  ? resolve(dirname(fileURLToPath(import.meta.url)), "..", "test-session.jsonl")
  : process.argv[2];

if (!input) {
  console.error(
    "Usage: bun run src/index.ts <path-to-dir-or-main-jsonl>\n       bun run src/index.ts --test"
  );
  process.exit(1);
}

const inputPath = resolve(input);
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
