export function tryParsePackPayload(candidate) {
  try {
    const parsed = JSON.parse(candidate);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0]) {
      return null;
    }
    const first = parsed[0];
    return first && typeof first === "object" ? first : null;
  } catch {
    return null;
  }
}

export function parsePackJson(output) {
  const direct = tryParsePackPayload(output.trim());
  if (direct) {
    return direct;
  }

  let cursor = output.length;
  while (cursor > 0) {
    const start = output.lastIndexOf("[", cursor - 1);
    if (start < 0) {
      break;
    }
    const parsed = tryParsePackPayload(output.slice(start).trim());
    if (parsed) {
      return parsed;
    }
    cursor = start;
  }

  throw new Error("npm pack --json did not return parseable JSON output");
}

export function summarizeByTopLevel(files) {
  const byGroup = new Map();
  for (const file of files) {
    const filePath = typeof file.path === "string" ? file.path : "<unknown>";
    const size = typeof file.size === "number" ? file.size : 0;
    let group = filePath;
    if (filePath.includes("/")) {
      const [head, tail] = filePath.split("/", 2);
      group = head === "dist" && tail ? `dist/${tail.split("/")[0]}` : head;
    }
    byGroup.set(group, (byGroup.get(group) ?? 0) + size);
  }
  return [...byGroup.entries()].sort((a, b) => b[1] - a[1]);
}

export function hasPackedFile(files, path) {
  return files.some((file) => file && typeof file.path === "string" && file.path === path);
}
