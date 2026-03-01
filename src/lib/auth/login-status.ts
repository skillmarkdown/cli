import { type AuthSession } from "./session";

export function formatSessionProject(
  session: AuthSession,
  currentConfigProjectId?: string,
): { label: string; mismatch: boolean } {
  if (!session.projectId) {
    if (currentConfigProjectId) {
      return { label: `unknown (current config: ${currentConfigProjectId})`, mismatch: false };
    }
    return { label: "unknown", mismatch: false };
  }

  return {
    label: session.projectId,
    mismatch: Boolean(currentConfigProjectId && session.projectId !== currentConfigProjectId),
  };
}

export function printSessionStatus(
  session: AuthSession | null,
  currentConfigProjectId?: string,
): number {
  if (!session) {
    console.log("Not logged in.");
    return 1;
  }

  const project = formatSessionProject(session, currentConfigProjectId);

  if (session.email) {
    console.log(`Logged in with GitHub as ${session.email} (project: ${project.label}).`);
  } else {
    console.log(`Logged in with GitHub (uid: ${session.uid}, project: ${project.label}).`);
  }

  if (project.mismatch && currentConfigProjectId) {
    console.log(
      `Current CLI config targets project '${currentConfigProjectId}'. ` +
        "Run 'skillmd login --reauth' to switch projects.",
    );
  }

  return 0;
}
