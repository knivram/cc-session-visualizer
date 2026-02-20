import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import type {
  Agent,
  Session,
  SessionEvent,
  Phase,
  RawLine,
  EventType,
} from "./types";

// ── helpers ──────────────────────────────────────────────────────────

function readJsonl(path: string): RawLine[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as RawLine);
}

function contentBlocks(line: RawLine): Record<string, unknown>[] {
  const c = line.message?.content;
  return Array.isArray(c) ? c : [];
}

function toolUseBlocks(line: RawLine) {
  return contentBlocks(line).filter(
    (b) => (b as any).type === "tool_use"
  ) as any[];
}

function toolResultBlocks(line: RawLine) {
  return contentBlocks(line).filter(
    (b) => (b as any).type === "tool_result"
  ) as any[];
}

function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

function parseXmlTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m?.[1];
}

// ── main parser ──────────────────────────────────────────────────────

export function parseSession(inputPath: string): Session {
  // Resolve directory and main JSONL
  let dir: string;
  let mainFile: string;

  if (inputPath.endsWith(".jsonl")) {
    mainFile = inputPath;
    dir = dirname(inputPath);
  } else {
    // Find the .jsonl in the directory
    const files = readdirSync(inputPath).filter((f) => f.endsWith(".jsonl"));
    if (files.length === 0) throw new Error("No .jsonl file found in " + inputPath);
    mainFile = join(inputPath, files[0]);
    dir = inputPath;
  }

  const sessionId = basename(mainFile, ".jsonl");
  const mainLines = readJsonl(mainFile);

  // ── 1. Build task_id ↔ tool_use_id map from queue-operations ──

  const taskToToolUse = new Map<string, string>(); // task_id → tool_use_id
  const toolUseToTask = new Map<string, string>(); // tool_use_id → task_id
  const taskCompletions = new Map<string, string>(); // task_id → completion timestamp

  for (const line of mainLines) {
    if (line.type !== "queue-operation") continue;

    if (line.operation === "enqueue" && typeof line.content === "string") {
      // Try JSON first (spawn enqueue)
      try {
        const parsed = JSON.parse(line.content);
        if (parsed.task_id && parsed.tool_use_id) {
          taskToToolUse.set(parsed.task_id, parsed.tool_use_id);
          toolUseToTask.set(parsed.tool_use_id, parsed.task_id);
        }
      } catch {
        // Try XML task-notification (completion)
        const taskId = parseXmlTag(line.content, "task-id");
        const status = parseXmlTag(line.content, "status");
        if (taskId && status === "completed" && line.timestamp) {
          taskCompletions.set(taskId, line.timestamp);
        }
      }
    }
  }

  // ── 2. Extract Task spawns from assistant lines ──

  interface SpawnInfo {
    toolUseId: string;
    timestamp: string;
    description: string;
    subagentType: string;
    name?: string;
    teamName?: string;
    prompt: string;
    runInBackground: boolean;
    taskId?: string;
    agentName?: string; // resolved later for team agents
  }

  const spawns: SpawnInfo[] = [];

  for (const line of mainLines) {
    if (line.type !== "assistant") continue;
    for (const block of toolUseBlocks(line)) {
      if (block.name !== "Task") continue;
      const input = block.input ?? {};
      const spawn: SpawnInfo = {
        toolUseId: block.id,
        timestamp: line.timestamp!,
        description: input.description ?? "",
        subagentType: input.subagent_type ?? "unknown",
        name: input.name,
        teamName: input.team_name,
        prompt: (input.prompt ?? "").slice(0, 500),
        runInBackground: !!input.run_in_background,
        taskId: toolUseToTask.get(block.id),
      };
      spawns.push(spawn);
    }
  }

  // ── 3. Resolve team agent names from tool_results ──

  for (const line of mainLines) {
    if (line.type !== "user") continue;
    const tur = line.toolUseResult ?? {};
    if (tur.status === "teammate_spawned") {
      // Find matching spawn by tool_use_id
      for (const block of toolResultBlocks(line)) {
        const spawn = spawns.find((s) => s.toolUseId === block.tool_use_id);
        if (spawn) {
          spawn.agentName = (tur.name as string) ?? spawn.name;
        }
      }
    }
  }

  // ── 4. Build Agent objects ──

  const HOST: Agent = {
    id: "host",
    name: "Host",
    type: "host",
    description: "Session orchestrator",
  };

  const agents: Agent[] = [HOST];
  const agentByName = new Map<string, Agent>();
  agentByName.set("Host", HOST);

  // Background agents (non-team)
  for (const spawn of spawns) {
    if (spawn.teamName) continue;
    const name =
      spawn.name ??
      spawn.description ??
      `agent-${spawn.taskId ?? spawn.toolUseId.slice(-7)}`;
    const agent: Agent = {
      id: spawn.taskId ?? spawn.toolUseId,
      name: truncate(name, 24),
      type: spawn.subagentType,
      fileId: spawn.taskId,
      description: spawn.description,
    };
    agents.push(agent);
    agentByName.set(agent.name, agent);
    spawn.agentName = agent.name;
  }

  // Team agents
  for (const spawn of spawns) {
    if (!spawn.teamName) continue;
    const name = spawn.agentName ?? spawn.name ?? `agent-${spawn.toolUseId.slice(-7)}`;
    if (!agentByName.has(name)) {
      const agent: Agent = {
        id: spawn.taskId ?? spawn.toolUseId,
        name,
        type: spawn.subagentType,
        teamName: spawn.teamName,
        description: spawn.description,
      };
      agents.push(agent);
      agentByName.set(name, agent);
    }
    spawn.agentName = name;
  }

  // Also register "team-lead" as an alias for Host
  agentByName.set("team-lead", HOST);

  // ── 5. Build events ──

  const events: SessionEvent[] = [];

  // Spawn events
  for (const spawn of spawns) {
    events.push({
      type: "spawn",
      from: "Host",
      to: spawn.agentName!,
      timestamp: spawn.timestamp,
      label: truncate(spawn.description),
      detail: {
        description: spawn.description,
        subagentType: spawn.subagentType,
        teamName: spawn.teamName,
        prompt: spawn.prompt,
        runInBackground: spawn.runInBackground,
      },
      toolUseId: spawn.toolUseId,
    });
  }

  // Result events (from task-notification completions)
  for (const spawn of spawns) {
    if (spawn.teamName) continue; // team agents don't have task completions
    const taskId = spawn.taskId;
    if (!taskId) continue;
    const completionTs = taskCompletions.get(taskId);
    if (!completionTs) continue;
    events.push({
      type: "result",
      from: spawn.agentName!,
      to: "Host",
      timestamp: completionTs,
      label: `${truncate(spawn.description, 25)} done`,
      detail: {
        taskId,
        description: spawn.description,
        completedAt: completionTs,
      },
      toolUseId: spawn.toolUseId,
    });
  }

  // TeamCreate / TeamDelete from main assistant lines
  for (const line of mainLines) {
    if (line.type !== "assistant") continue;
    for (const block of toolUseBlocks(line)) {
      if (block.name === "TeamCreate") {
        const input = block.input ?? {};
        events.push({
          type: "team_create",
          from: "Host",
          to: "Host",
          timestamp: line.timestamp!,
          label: `Create team: ${input.team_name ?? "?"}`,
          detail: { teamName: input.team_name, description: input.description },
          toolUseId: block.id,
        });
      } else if (block.name === "TeamDelete") {
        events.push({
          type: "team_delete",
          from: "Host",
          to: "Host",
          timestamp: line.timestamp!,
          label: "Delete team",
          detail: {},
          toolUseId: block.id,
        });
      }
    }
  }

  // SendMessage from main file assistant lines
  for (const line of mainLines) {
    if (line.type !== "assistant") continue;
    for (const block of toolUseBlocks(line)) {
      if (block.name !== "SendMessage") continue;
      const input = block.input ?? {};
      const msgType: string = input.type ?? "message";
      const evtType: EventType =
        msgType === "shutdown_request" ? "shutdown" : "message";
      const recipient = input.recipient ?? "?";
      // Resolve recipient to known agent name
      const toName = agentByName.has(recipient) ? recipient : recipient;
      events.push({
        type: evtType,
        from: "Host",
        to: toName,
        timestamp: line.timestamp!,
        label:
          evtType === "shutdown"
            ? `Shutdown → ${recipient}`
            : truncate(input.summary ?? input.content ?? "", 40),
        detail: {
          messageType: msgType,
          recipient,
          content: (input.content ?? "").slice(0, 1000),
          summary: input.summary,
        },
        toolUseId: block.id,
      });
    }
  }

  // ── 6. Parse subagent files for SendMessage events ──

  const subagentsDir = join(dir, sessionId, "subagents");
  if (existsSync(subagentsDir)) {
    const subFiles = readdirSync(subagentsDir).filter((f) =>
      f.endsWith(".jsonl")
    );

    for (const subFile of subFiles) {
      const subLines = readJsonl(join(subagentsDir, subFile));

      for (const line of subLines) {
        if (line.type !== "assistant") continue;
        for (const block of toolUseBlocks(line)) {
          if (block.name !== "SendMessage") continue;
          const input = block.input ?? {};
          if (input.type === "shutdown_response") continue; // skip responses

          // Find the routing.sender from the corresponding tool_result
          let senderName: string | undefined;
          for (const resLine of subLines) {
            if (resLine.type !== "user") continue;
            const routing = (resLine.toolUseResult as any)?.routing;
            if (routing?.sender) {
              senderName = routing.sender;
              break;
            }
          }

          // Fallback: infer identity from teammate-message in first user line.
          // The teammate_id tells us who *sent to* this agent, not who this agent is.
          // But if we know the full team roster, we can sometimes infer by elimination.
          // For now, we skip files where routing.sender isn't available.

          if (!senderName) continue; // can't identify sender

          const recipient = input.recipient ?? "?";
          const evtType: EventType =
            input.type === "shutdown_request" ? "shutdown" : "message";

          events.push({
            type: evtType,
            from: senderName,
            to: recipient,
            timestamp: line.timestamp!,
            label:
              evtType === "shutdown"
                ? `Shutdown → ${recipient}`
                : truncate(input.summary ?? input.content ?? "", 40),
            detail: {
              sender: senderName,
              recipient,
              messageType: input.type,
              content: (input.content ?? "").slice(0, 1000),
              summary: input.summary,
            },
            toolUseId: block.id,
          });
        }
      }
    }
  }

  // ── 7. Normalize agent names and sort events ──

  // "team-lead" is the host's name inside team contexts
  for (const evt of events) {
    if (evt.from === "team-lead") evt.from = "Host";
    if (evt.to === "team-lead") evt.to = "Host";
  }

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // ── 8. Phase detection ──

  // Group spawns into phases by consecutive subagent_type + team
  interface SpawnGroup {
    type: string;
    team?: string;
    spawns: SpawnInfo[];
  }
  const groups: SpawnGroup[] = [];
  let currentGroup: SpawnGroup | null = null;

  for (const spawn of spawns) {
    const key = spawn.teamName ?? spawn.subagentType;
    if (!currentGroup || currentGroup.type !== key) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = { type: key, team: spawn.teamName, spawns: [spawn] };
    } else {
      currentGroup.spawns.push(spawn);
    }
  }
  if (currentGroup) groups.push(currentGroup);

  // Assign each event to exactly one phase
  const usedEvents = new Set<SessionEvent>();
  const phases: Phase[] = [];

  for (const group of groups) {
    phases.push(buildPhase(group, events, agentByName, usedEvents));
  }

  // ── 9. Session timestamps ──

  const timestamps = mainLines
    .filter((l) => l.timestamp)
    .map((l) => l.timestamp!);
  const startTime = timestamps[0] ?? "";
  const endTime = timestamps[timestamps.length - 1] ?? "";

  return { id: sessionId, startTime, endTime, agents, phases };
}

function buildPhase(
  group: { type: string; team?: string; spawns: SpawnInfo[] },
  allEvents: SessionEvent[],
  agentByName: Map<string, Agent>,
  usedEvents: Set<SessionEvent>
): Phase {
  // Determine phase name
  let name: string;
  if (group.team) {
    name = `Team: ${group.team}`;
  } else if (group.type === "Explore") {
    name = "Exploration";
  } else if (group.type === "general-purpose") {
    name = "Analysis";
  } else {
    name = group.type;
  }

  // Collect non-Host agent names spawned in this phase
  const phaseAgentNames = new Set<string>();
  for (const s of group.spawns) {
    if (s.agentName) phaseAgentNames.add(s.agentName);
  }

  // An event belongs to this phase if at least one non-Host participant
  // is a phase agent, AND the event hasn't been claimed by an earlier phase
  const phaseEvents: SessionEvent[] = [];
  for (const evt of allEvents) {
    if (usedEvents.has(evt)) continue;
    const fromMatch = phaseAgentNames.has(evt.from);
    const toMatch = phaseAgentNames.has(evt.to);
    // Team ops go to the team phase (team_create has teamName, team_delete goes to last team phase)
    const isTeamOp =
      group.team &&
      ((evt.type === "team_create" && (evt.detail as any)?.teamName === group.team) ||
        evt.type === "team_delete");
    if (fromMatch || toMatch || isTeamOp) {
      phaseEvents.push(evt);
      usedEvents.add(evt);
    }
  }

  // Build the full set of participants (Host + phase agents + any mentioned in events)
  const allNames = new Set<string>(["Host"]);
  for (const n of phaseAgentNames) allNames.add(n);
  for (const evt of phaseEvents) {
    allNames.add(evt.from);
    allNames.add(evt.to);
  }

  const phaseAgents: Agent[] = [];
  const seenIds = new Set<string>();
  for (const n of allNames) {
    const agent = agentByName.get(n);
    if (agent && !seenIds.has(agent.id)) {
      seenIds.add(agent.id);
      phaseAgents.push(agent);
    }
  }

  return { name, agents: phaseAgents, events: phaseEvents };
}

interface SpawnInfo {
  toolUseId: string;
  timestamp: string;
  description: string;
  subagentType: string;
  name?: string;
  teamName?: string;
  prompt: string;
  runInBackground: boolean;
  taskId?: string;
  agentName?: string;
}
