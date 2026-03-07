export const BUILTIN_AGENT_TARGETS = [
  "skillmd",
  "openai",
  "claude",
  "gemini",
  "meta",
  "mistral",
  "deepseek",
  "perplexity",
] as const;

export type BuiltinAgentTarget = (typeof BUILTIN_AGENT_TARGETS)[number];
export type AgentTarget = BuiltinAgentTarget | `custom:${string}`;

export const DEFAULT_AGENT_TARGET: BuiltinAgentTarget = "skillmd";

const BUILTIN_AGENT_TARGET_SET = new Set<string>(BUILTIN_AGENT_TARGETS);
const CUSTOM_AGENT_TARGET_PATTERN = /^custom:([a-z0-9][a-z0-9-]{0,62})$/u;
const BUILTIN_AGENT_TARGET_LIST = BUILTIN_AGENT_TARGETS.join(", ");

export function normalizeAgentTarget(value: string): AgentTarget | null {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();

  if (BUILTIN_AGENT_TARGET_SET.has(normalized)) {
    return normalized as BuiltinAgentTarget;
  }

  if (CUSTOM_AGENT_TARGET_PATTERN.test(trimmed)) {
    return trimmed as AgentTarget;
  }

  return null;
}

export function isAgentTarget(value: unknown): value is AgentTarget {
  return typeof value === "string" && normalizeAgentTarget(value) !== null;
}

export function parseAgentTargetOrThrow(value: string, fieldName: string): AgentTarget {
  const parsed = normalizeAgentTarget(value);
  if (!parsed) {
    throw new Error(
      `${fieldName} must be one of ${BUILTIN_AGENT_TARGET_LIST}, or custom:<slug> ` +
        "(slug: lowercase letters/digits with optional hyphens, up to 63 chars)",
    );
  }
  return parsed;
}

export function resolveDefaultAgentTarget(envValue: string | undefined): AgentTarget {
  if (!envValue || envValue.trim().length === 0) {
    return DEFAULT_AGENT_TARGET;
  }

  try {
    return parseAgentTargetOrThrow(envValue, "SKILLMD_AGENT_TARGET");
  } catch {
    throw new Error(
      `invalid SKILLMD_AGENT_TARGET; expected ${BUILTIN_AGENT_TARGET_LIST}, or custom:<slug>`,
    );
  }
}

export function parseCustomAgentSlug(agentTarget: AgentTarget): string | undefined {
  const matches = agentTarget.match(CUSTOM_AGENT_TARGET_PATTERN);
  return matches?.[1];
}
