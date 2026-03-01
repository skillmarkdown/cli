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

async function withMockedFetch(mockImpl, fn) {
  const originalFetch = global.fetch;
  global.fetch = mockImpl;

  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
  }
}

module.exports = {
  mockTextResponse,
  mockJsonResponse,
  withMockedFetch,
};
