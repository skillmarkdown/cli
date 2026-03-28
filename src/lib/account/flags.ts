import { parseOptionValue } from "../shared/flag-parse";
import { type ParsedAccountFlags } from "./types";

const DELETE_CONFIRMATION = "delete-account";
const SUBJECT_LIMIT = 160;
const MESSAGE_LIMIT = 4000;

function trimValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function parseAccountFlags(args: string[]): ParsedAccountFlags {
  if (args.length === 0) {
    return { valid: false, json: false };
  }

  if (args[0] === "delete") {
    let confirm: string | undefined;
    let json = false;

    for (let index = 1; index < args.length; index += 1) {
      const current = args[index];
      if (current === "--json") {
        json = true;
        continue;
      }
      const confirmOption = parseOptionValue(args, index, "confirm");
      if (confirmOption.matched) {
        const value = trimValue(confirmOption.value);
        if (!value) {
          return { valid: false, json: false };
        }
        confirm = value;
        index = confirmOption.nextIndex;
        continue;
      }
      return { valid: false, json: false };
    }

    return { valid: true, action: "delete", confirm, json };
  }

  if (args[0] === "support") {
    let subject = "";
    let message = "";
    let json = false;

    for (let index = 1; index < args.length; index += 1) {
      const current = args[index];
      if (current === "--json") {
        json = true;
        continue;
      }
      const subjectOption = parseOptionValue(args, index, "subject", { allowEmptyValue: true });
      if (subjectOption.matched) {
        subject = trimValue(subjectOption.value);
        if (!subject || subject.length > SUBJECT_LIMIT) {
          return { valid: false, json: false };
        }
        index = subjectOption.nextIndex;
        continue;
      }
      const messageOption = parseOptionValue(args, index, "message", { allowEmptyValue: true });
      if (messageOption.matched) {
        message = trimValue(messageOption.value);
        if (!message || message.length > MESSAGE_LIMIT) {
          return { valid: false, json: false };
        }
        index = messageOption.nextIndex;
        continue;
      }
      return { valid: false, json: false };
    }

    if (!subject || !message) {
      return { valid: false, json: false };
    }

    return { valid: true, action: "support", subject, message, json };
  }

  return { valid: false, json: false };
}

export { DELETE_CONFIRMATION };
