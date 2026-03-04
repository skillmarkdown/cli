interface ParseValueArgOptions {
  allowHyphenPrefixedValue?: boolean;
  rejectKnownFlagValues?: boolean;
  isKnownFlagToken?: (value: string) => boolean;
}

interface ParseOptionValueOptions extends ParseValueArgOptions {
  allowEmptyValue?: boolean;
}

export function parseValueArg(
  args: string[],
  index: number,
  options: ParseValueArgOptions = {},
): { value?: string; nextIndex: number } {
  const value = args[index + 1];
  if (!value) {
    return { nextIndex: index };
  }
  if (options.rejectKnownFlagValues && options.isKnownFlagToken?.(value)) {
    return { nextIndex: index };
  }
  if (!options.allowHyphenPrefixedValue && value.startsWith("-")) {
    return { nextIndex: index };
  }
  return { value, nextIndex: index + 1 };
}

export function parseIntInRange(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

export function parseOptionValue(
  args: string[],
  index: number,
  name: string,
  options: ParseOptionValueOptions = {},
): { matched: boolean; value?: string; nextIndex: number } {
  const arg = args[index];
  const flag = `--${name}`;
  if (arg === flag) {
    const parsed = parseValueArg(args, index, options);
    if (!parsed.value && options.allowEmptyValue !== true) {
      return { matched: true, nextIndex: index };
    }
    return { matched: true, value: parsed.value ?? "", nextIndex: parsed.nextIndex };
  }
  const inlinePrefix = `${flag}=`;
  if (!arg.startsWith(inlinePrefix)) {
    return { matched: false, nextIndex: index };
  }
  const value = arg.slice(inlinePrefix.length);
  if (!value && options.allowEmptyValue !== true) {
    return { matched: true, nextIndex: index };
  }
  return { matched: true, value, nextIndex: index };
}
