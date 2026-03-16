export const COMMAND_MATRIX = [
  { id: "root.no-command", mode: "local_contract", command: "root" },
  { id: "root.unknown-command", mode: "local_contract", command: "root" },
  { id: "root.version.long", mode: "both", command: "root" },
  { id: "root.version.short", mode: "both", command: "root" },
  { id: "root.auth-token.global", mode: "local_contract", command: "root" },

  { id: "init.minimal", mode: "local_contract", command: "init" },
  { id: "init.verbose", mode: "both", command: "init" },
  { id: "init.verbose.no-validate", mode: "both", command: "init" },

  { id: "validate.default", mode: "both", command: "validate" },
  { id: "validate.strict", mode: "both", command: "validate" },
  { id: "validate.parity", mode: "local_contract", command: "validate" },

  { id: "login.interactive", mode: "live_e2e", command: "login" },
  { id: "login.status", mode: "both", command: "login" },
  { id: "login.reauth", mode: "both", command: "login" },
  { id: "login.env-noninteractive", mode: "both", command: "login" },
  { id: "login.env-missing", mode: "local_contract", command: "login" },
  { id: "logout.basic", mode: "both", command: "logout" },
  { id: "whoami.json", mode: "both", command: "whoami" },

  { id: "publish.dry-run", mode: "both", command: "publish" },
  { id: "publish.real", mode: "live_e2e", command: "publish" },
  { id: "publish.owner", mode: "live_e2e", command: "publish" },
  { id: "publish.access.private", mode: "live_e2e", command: "publish" },
  { id: "publish.provenance", mode: "local_contract", command: "publish" },
  { id: "publish.agent-target.custom", mode: "local_contract", command: "publish" },

  { id: "search.default", mode: "both", command: "search" },
  { id: "search.limit", mode: "local_contract", command: "search" },
  { id: "search.cursor", mode: "local_contract", command: "search" },
  { id: "search.scope.public", mode: "local_contract", command: "search" },
  { id: "search.scope.private", mode: "live_e2e", command: "search" },

  { id: "view.skill-id", mode: "both", command: "view" },
  { id: "view.selection-index", mode: "local_contract", command: "view" },
  { id: "history.default", mode: "both", command: "history" },
  { id: "history.limit", mode: "both", command: "history" },
  { id: "history.cursor", mode: "local_contract", command: "history" },

  { id: "install.default", mode: "both", command: "install" },
  { id: "install.prune", mode: "both", command: "install" },
  { id: "install.agent-target", mode: "local_contract", command: "install" },
  { id: "list.local", mode: "both", command: "list" },
  { id: "list.global", mode: "local_contract", command: "list" },
  { id: "list.agent-target", mode: "local_contract", command: "list" },
  { id: "use.default", mode: "both", command: "use" },
  { id: "use.version", mode: "both", command: "use" },
  { id: "use.spec", mode: "both", command: "use" },
  { id: "use.save", mode: "local_contract", command: "use" },
  { id: "use.global", mode: "local_contract", command: "use" },
  { id: "use.agent-target", mode: "local_contract", command: "use" },
  { id: "use.save-global-conflict", mode: "local_contract", command: "use" },
  { id: "update.ids", mode: "both", command: "update" },
  { id: "update.all", mode: "both", command: "update" },
  { id: "update.global", mode: "local_contract", command: "update" },
  { id: "update.no-op", mode: "local_contract", command: "update" },
  { id: "update.agent-target", mode: "local_contract", command: "update" },
  { id: "remove.local", mode: "both", command: "remove" },
  { id: "remove.global", mode: "local_contract", command: "remove" },
  { id: "remove.agent-target", mode: "local_contract", command: "remove" },

  { id: "tag.ls", mode: "both", command: "tag" },
  { id: "tag.add", mode: "both", command: "tag" },
  { id: "tag.rm", mode: "both", command: "tag" },
  { id: "deprecate.version", mode: "both", command: "deprecate" },
  { id: "deprecate.range", mode: "live_e2e", command: "deprecate" },
  { id: "unpublish.version", mode: "both", command: "unpublish" },

  { id: "token.add.read", mode: "local_contract", command: "token" },
  { id: "token.add.publish", mode: "both", command: "token" },
  { id: "token.add.admin", mode: "both", command: "token" },
  { id: "token.ls", mode: "both", command: "token" },
  { id: "token.rm", mode: "both", command: "token" },
  { id: "token.invalid-id", mode: "local_contract", command: "token" },

  { id: "org.ls", mode: "both", command: "org" },
  { id: "org.members.ls", mode: "both", command: "org" },
  { id: "org.members.add", mode: "both", command: "org" },
  { id: "org.members.rm", mode: "both", command: "org" },
  { id: "org.team.ls", mode: "both", command: "org" },
  { id: "org.team.add", mode: "both", command: "org" },
  { id: "org.team.members.ls", mode: "both", command: "org" },
  { id: "org.team.members.add", mode: "both", command: "org" },
  { id: "org.team.members.rm", mode: "both", command: "org" },
  { id: "org.skills.ls", mode: "both", command: "org" },
  { id: "org.skills.team.set", mode: "both", command: "org" },
  { id: "org.skills.team.clear", mode: "both", command: "org" },
  { id: "org.tokens.ls", mode: "both", command: "org" },
  { id: "org.tokens.add", mode: "both", command: "org" },
  { id: "org.tokens.rm", mode: "both", command: "org" },
];

export function getMatrixIds() {
  return new Set(COMMAND_MATRIX.map((entry) => entry.id));
}

export function getMatrixCommands() {
  return new Set(COMMAND_MATRIX.map((entry) => entry.command));
}
