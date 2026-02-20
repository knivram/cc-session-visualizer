/** Represents a participant in the session (host or subagent). */
export interface Agent {
  id: string;
  name: string;
  type: string; // "host" | "Explore" | "general-purpose" | etc.
  teamName?: string;
  fileId?: string; // task_id from queue-operation, maps to agent-{fileId}.jsonl
  description: string;
}

export type EventType =
  | "spawn"
  | "result"
  | "message"
  | "team_create"
  | "team_delete"
  | "shutdown";

/** A single event arrow or marker in the sequence diagram. */
export interface SessionEvent {
  type: EventType;
  from: string; // agent name
  to: string; // agent name
  timestamp: string; // ISO 8601
  label: string; // short label for arrow
  detail: Record<string, unknown>; // full content for detail panel
  toolUseId?: string;
}

/** A phase groups related agents and their events. */
export interface Phase {
  name: string;
  agents: Agent[];
  events: SessionEvent[];
}

/** Top-level parsed session. */
export interface Session {
  id: string;
  startTime: string;
  endTime: string;
  agents: Agent[];
  phases: Phase[];
}

/** Raw JSONL line after JSON.parse. */
export interface RawLine {
  type: string;
  timestamp?: string;
  message?: {
    role: string;
    content: unknown;
  };
  toolUseResult?: Record<string, unknown>;
  parentUuid?: string;
  uuid?: string;
  sessionId?: string;
  agentId?: string;
  operation?: string;
  content?: string;
  [key: string]: unknown;
}
