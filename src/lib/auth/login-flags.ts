export interface LoginFlags {
  status: boolean;
  reauth: boolean;
  valid: boolean;
}

export function parseLoginFlags(args: string[]): LoginFlags {
  let status = false;
  let reauth = false;

  for (const arg of args) {
    if (arg === "--status") {
      status = true;
      continue;
    }

    if (arg === "--reauth") {
      reauth = true;
      continue;
    }

    return { status: false, reauth: false, valid: false };
  }

  if (status && reauth) {
    return { status: false, reauth: false, valid: false };
  }

  return { status, reauth, valid: true };
}
