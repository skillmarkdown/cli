export function printJson(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}
