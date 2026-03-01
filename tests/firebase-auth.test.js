const test = require("node:test");
const assert = require("node:assert/strict");

const { signInWithGitHubAccessToken } = require("../dist/lib/firebase-auth.js");

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

test("signInWithGitHubAccessToken returns mapped Firebase session", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      mockJsonResponse(200, {
        localId: "uid-1",
        email: "user@example.com",
        refreshToken: "refresh-1",
      });

    const result = await signInWithGitHubAccessToken("api-key", "gh-token");
    assert.deepEqual(result, {
      localId: "uid-1",
      email: "user@example.com",
      refreshToken: "refresh-1",
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("signInWithGitHubAccessToken reports non-JSON responses", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () => mockTextResponse(200, "not-json");

    await assert.rejects(signInWithGitHubAccessToken("api-key", "gh-token"), {
      message: "Firebase auth API returned non-JSON response (200)",
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("signInWithGitHubAccessToken surfaces Firebase API error payload", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      mockJsonResponse(400, {
        error: {
          message: "INVALID_IDP_RESPONSE",
        },
      });

    await assert.rejects(signInWithGitHubAccessToken("api-key", "gh-token"), {
      message: "Firebase auth error: INVALID_IDP_RESPONSE",
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("signInWithGitHubAccessToken rejects missing required fields", async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      mockJsonResponse(200, {
        localId: "uid-1",
      });

    await assert.rejects(signInWithGitHubAccessToken("api-key", "gh-token"), {
      message: "Firebase auth response was missing required fields",
    });
  } finally {
    global.fetch = originalFetch;
  }
});
