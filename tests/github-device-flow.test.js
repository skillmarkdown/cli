const test = require("node:test");
const assert = require("node:assert/strict");

const { pollForAccessToken, requestDeviceCode } = require("../dist/lib/github-device-flow.js");

function mockTextResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

function mockJsonResponse(status, payload) {
  return mockTextResponse(status, JSON.stringify(payload));
}

test("requestDeviceCode returns mapped values", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      mockJsonResponse(200, {
        device_code: "dev-1",
        user_code: "ABCD-EFGH",
        verification_uri: "https://github.com/login/device",
        verification_uri_complete: "https://github.com/login/device?user_code=ABCD-EFGH",
        expires_in: 900,
        interval: 5,
      });

    const result = await requestDeviceCode("client-id");
    assert.deepEqual(result, {
      deviceCode: "dev-1",
      userCode: "ABCD-EFGH",
      verificationUri: "https://github.com/login/device",
      verificationUriComplete: "https://github.com/login/device?user_code=ABCD-EFGH",
      expiresIn: 900,
      interval: 5,
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("requestDeviceCode reports non-JSON responses", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () => mockTextResponse(200, "not-json");

    await assert.rejects(requestDeviceCode("client-id"), {
      message: "GitHub API returned non-JSON response (200)",
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("requestDeviceCode reports non-2xx responses", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      mockJsonResponse(401, {
        error: "unauthorized_client",
      });

    await assert.rejects(requestDeviceCode("client-id"), {
      message: "GitHub API request failed (401)",
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("requestDeviceCode reports missing required fields in JSON payload", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      mockJsonResponse(200, {
        user_code: "ABCD-EFGH",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
      });

    await assert.rejects(requestDeviceCode("client-id"), {
      message: "GitHub device code response was missing required fields",
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("pollForAccessToken handles slow_down and eventually succeeds", async () => {
  const originalFetch = global.fetch;
  let calls = 0;

  try {
    global.fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return mockJsonResponse(200, { error: "slow_down" });
      }

      return mockJsonResponse(200, { access_token: "token-1" });
    };

    const result = await pollForAccessToken("client-id", "device-code", 1, 30, {
      sleep: async () => {},
    });
    assert.deepEqual(result, { accessToken: "token-1" });
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("pollForAccessToken reports expired_token", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      mockJsonResponse(200, {
        error: "expired_token",
      });

    await assert.rejects(
      pollForAccessToken("client-id", "device-code", 1, 30, {
        sleep: async () => {},
      }),
      {
        message: "GitHub device code expired before authorization completed",
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("pollForAccessToken reports access_denied", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      mockJsonResponse(200, {
        error: "access_denied",
      });

    await assert.rejects(
      pollForAccessToken("client-id", "device-code", 1, 30, {
        sleep: async () => {},
      }),
      {
        message: "GitHub authorization was denied by the user",
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("pollForAccessToken reports non-JSON responses", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () => mockTextResponse(200, "not-json");

    await assert.rejects(
      pollForAccessToken("client-id", "device-code", 1, 30, {
        sleep: async () => {},
      }),
      {
        message: "GitHub API returned non-JSON response (200)",
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("pollForAccessToken times out when authorization never completes", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      mockJsonResponse(200, {
        error: "authorization_pending",
      });

    await assert.rejects(
      pollForAccessToken("client-id", "device-code", 1, 0, {
        sleep: async () => {},
      }),
      {
        message: "GitHub device login timed out",
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});
