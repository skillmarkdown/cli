const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { deriveOwnerFromSession } = requireDist("lib/auth/owner.js");

test("deriveOwnerFromSession returns null for provider-neutral sessions", () => {
  assert.equal(
    deriveOwnerFromSession({
      provider: "email",
      uid: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh-1",
    }),
    null,
  );
});
