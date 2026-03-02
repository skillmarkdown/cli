import { type InstallIntent } from "../use/types";
import { type UpdateInstalledMetadata, type UpdateIntentResolution } from "./types";

function asVersionSelector(value: string): UpdateIntentResolution {
  return {
    selector: {
      strategy: "version",
      value,
    },
    installIntent: {
      strategy: "version",
      value,
    },
  };
}

function asChannelSelector(value: "latest" | "beta"): UpdateIntentResolution {
  return {
    selector: {
      strategy: "channel",
      value,
    },
    installIntent: {
      strategy: "channel",
      value,
    },
  };
}

function asLatestFallbackSelector(): UpdateIntentResolution {
  return {
    selector: {
      strategy: "latest_fallback_beta",
      value: null,
    },
    installIntent: {
      strategy: "latest_fallback_beta",
      value: null,
    },
  };
}

function parseIntentFromMetadata(intent: InstallIntent | undefined): UpdateIntentResolution | null {
  if (!intent) {
    return null;
  }

  if (
    intent.strategy === "version" &&
    typeof intent.value === "string" &&
    intent.value.length > 0
  ) {
    return asVersionSelector(intent.value);
  }

  if (intent.strategy === "channel" && (intent.value === "latest" || intent.value === "beta")) {
    return asChannelSelector(intent.value);
  }

  if (intent.strategy === "latest_fallback_beta") {
    return asLatestFallbackSelector();
  }

  return null;
}

function parseIntentFromSourceCommand(
  sourceCommand: string | undefined,
): UpdateIntentResolution | null {
  if (!sourceCommand || sourceCommand.trim().length === 0) {
    return null;
  }

  const versionMatch = sourceCommand.match(/(?:^|\s)--version(?:=|\s+)([^\s]+)/u);
  if (versionMatch && versionMatch[1]) {
    return asVersionSelector(versionMatch[1]);
  }

  const channelMatch = sourceCommand.match(/(?:^|\s)--channel(?:=|\s+)(latest|beta)\b/u);
  if (channelMatch && (channelMatch[1] === "latest" || channelMatch[1] === "beta")) {
    return asChannelSelector(channelMatch[1]);
  }

  return null;
}

export function resolveUpdateIntent(
  metadata: UpdateInstalledMetadata | null,
): UpdateIntentResolution {
  const fromMetadata = parseIntentFromMetadata(metadata?.installIntent);
  if (fromMetadata) {
    return fromMetadata;
  }

  const fromSource = parseIntentFromSourceCommand(metadata?.sourceCommand);
  if (fromSource) {
    return fromSource;
  }

  return asLatestFallbackSelector();
}
