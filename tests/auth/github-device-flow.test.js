const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");
const {
  mockJsonResponse,
  mockTextResponse,
  withMockedFetch,
} = require("../helpers/fetch-test-utils.js");

const { pollForAccessToken, requestDeviceCode } = requireDist("lib/github-device-flow.js");

test("requestDeviceCode returns mapped values", async () => {
  const result = await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        device_code: "dev-1",
        user_code: "ABCD-EFGH",
        verification_uri: "https://github.com/login/device",
        verification_uri_complete: "https://github.com/login/device?user_code=ABCD-EFGH",
        expires_in: 900,
        interval: 5,
      }),
    () => requestDeviceCode("client-id"),
  );

  assert.deepEqual(result, {
    deviceCode: "dev-1",
    userCode: "ABCD-EFGH",
    verificationUri: "https://github.com/login/device",
    verificationUriComplete: "https://github.com/login/device?user_code=ABCD-EFGH",
    expiresIn: 900,
    interval: 5,
  });
});

test("requestDeviceCode reports non-JSON responses", async () => {
  await withMockedFetch(
    async () => mockTextResponse(200, "not-json"),
    async () => {
      await assert.rejects(requestDeviceCode("client-id"), {
        message: /GitHub API returned non-JSON response \(200\)/,
      });
    },
  );
});

test("requestDeviceCode reports non-2xx responses", async () => {
  await withMockedFetch(
    async () => mockJsonResponse(401, { error: "unauthorized_client" }),
    async () => {
      await assert.rejects(requestDeviceCode("client-id"), {
        message: /GitHub API request failed \(401\)/,
      });
    },
  );
});

test("requestDeviceCode reports missing required fields in JSON payload", async () => {
  await withMockedFetch(
    async () =>
      mockJsonResponse(200, {
        user_code: "ABCD-EFGH",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
      }),
    async () => {
      await assert.rejects(requestDeviceCode("client-id"), {
        message: /missing required fields/,
      });
    },
  );
});

test("pollForAccessToken handles slow_down and eventually succeeds", async () => {
  let calls = 0;

  const result = await withMockedFetch(
    async () => {
      calls += 1;
      if (calls === 1) {
        return mockJsonResponse(200, { error: "slow_down" });
      }

      return mockJsonResponse(200, { access_token: "token-1" });
    },
    () => pollForAccessToken("client-id", "device-code", 1, 30, { sleep: async () => {} }),
  );

  assert.deepEqual(result, { accessToken: "token-1" });
  assert.equal(calls, 2);
});

for (const [errorCode, messagePattern] of [
  ["expired_token", /expired before authorization completed/],
  ["access_denied", /authorization was denied by the user/],
]) {
  test(`pollForAccessToken reports ${errorCode}`, async () => {
    await withMockedFetch(
      async () => mockJsonResponse(200, { error: errorCode }),
      async () => {
        await assert.rejects(
          pollForAccessToken("client-id", "device-code", 1, 30, { sleep: async () => {} }),
          {
            message: messagePattern,
          },
        );
      },
    );
  });
}

test("pollForAccessToken reports non-JSON responses", async () => {
  await withMockedFetch(
    async () => mockTextResponse(200, "not-json"),
    async () => {
      await assert.rejects(
        pollForAccessToken("client-id", "device-code", 1, 30, { sleep: async () => {} }),
        {
          message: /non-JSON response \(200\)/,
        },
      );
    },
  );
});

test("pollForAccessToken times out when authorization never completes", async () => {
  await withMockedFetch(
    async () => mockJsonResponse(200, { error: "authorization_pending" }),
    async () => {
      await assert.rejects(
        pollForAccessToken("client-id", "device-code", 1, 0, { sleep: async () => {} }),
        {
          message: /GitHub device login timed out/,
        },
      );
    },
  );
});
