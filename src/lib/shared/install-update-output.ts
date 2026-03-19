import { isUseApiError } from "../use/errors";
import { formatCliApiErrorWithHint } from "./authz-error-hints";
import { renderTable } from "./table";

export function toUseApiErrorReason(error: unknown): string {
  if (isUseApiError(error)) {
    return formatCliApiErrorWithHint("skillmd use", error).replace(/^skillmd use: /, "");
  }

  return error instanceof Error ? error.message : "Unknown error";
}

export function resolveTableMaxWidth(): number | undefined {
  return process.stdout.isTTY ? (process.stdout.columns ?? 120) : undefined;
}

interface SkillStatusRow {
  skillId: string;
  agentTarget?: string;
  spec?: string;
  fromVersion?: string;
  toVersion?: string;
  status: string;
  reason?: string;
}

interface SkillStatusTableOptions {
  includeSpec?: boolean;
}

export function printSkillStatusTable(
  rows: SkillStatusRow[],
  options: SkillStatusTableOptions = {},
): void {
  const columns = [
    {
      header: "SKILL",
      minWidth: 26,
      maxWidth: 48,
      shrinkPriority: 0,
      wrap: true,
      maxLines: 2,
      value: (row: SkillStatusRow) => row.skillId,
    },
    {
      header: "TARGET",
      width: 10,
      value: (row: SkillStatusRow) => row.agentTarget ?? "-",
    },
    ...(options.includeSpec
      ? [
          {
            header: "SPEC",
            width: 14,
            value: (row: SkillStatusRow) => row.spec ?? "-",
          },
        ]
      : []),
    {
      header: "FROM",
      width: 14,
      value: (row: SkillStatusRow) => row.fromVersion ?? "-",
    },
    {
      header: "TO",
      width: 14,
      value: (row: SkillStatusRow) => row.toVersion ?? "-",
    },
    {
      header: "STATUS",
      width: 14,
      value: (row: SkillStatusRow) => row.status,
    },
    {
      header: "DETAIL",
      minWidth: 12,
      maxWidth: 64,
      shrinkPriority: 4,
      wrap: true,
      maxLines: 4,
      value: (row: SkillStatusRow) => row.reason ?? "",
    },
  ];
  const lines = renderTable(columns, rows, { maxWidth: resolveTableMaxWidth() });
  for (const line of lines) {
    console.log(line);
  }
}

export function printPruneTable(
  rows: Array<{ skillId: string; agentTarget: string; status: string; reason?: string }>,
): void {
  if (rows.length === 0) {
    console.log("Prune: no entries removed.");
    return;
  }
  const lines = renderTable(
    [
      {
        header: "SKILL",
        minWidth: 26,
        maxWidth: 48,
        shrinkPriority: 0,
        wrap: true,
        maxLines: 2,
        value: (row: { skillId: string }) => row.skillId,
      },
      {
        header: "TARGET",
        width: 10,
        value: (row: { agentTarget: string }) => row.agentTarget,
      },
      {
        header: "STATUS",
        width: 12,
        value: (row: { status: string }) => row.status,
      },
      {
        header: "DETAIL",
        minWidth: 12,
        maxWidth: 64,
        shrinkPriority: 4,
        wrap: true,
        maxLines: 4,
        value: (row: { reason?: string }) => row.reason ?? "",
      },
    ],
    rows,
    { maxWidth: resolveTableMaxWidth() },
  );
  console.log("Prune results:");
  for (const line of lines) {
    console.log(line);
  }
}

export function countByStatus<T extends { status: string }>(
  rows: T[],
  expectedStatus: string,
): number {
  return rows.filter((row) => row.status === expectedStatus).length;
}
