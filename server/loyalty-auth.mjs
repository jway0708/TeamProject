// Credentials and upstream tokens stay in this Node process.
export function createAuthorization(config, fetchImpl = fetch) {
  let cached;
  let pending;
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  function extractToken(value) {
    if (typeof value === 'string') return value.replace(/^Bearer\s+/i, '').trim();
    if (!value || typeof value !== 'object') return '';
    for (const key of ['token', 'accessToken', 'access_token', 'jwtToken', 'jwt', 'data']) {
      const entry = Object.entries(value).find(([name]) => name.toLowerCase() === key.toLowerCase());
      if (entry) {
        const result = extractToken(entry[1]);
        if (result) return result;
      }
    }
    return '';
  }

  function expiry(token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      if (Number.isFinite(payload.exp)) return payload.exp * 1000 - 30_000;
    } catch { /* Opaque tokens use a short cache duration. */ }
    return Date.now() + 5 * 60_000;
  }

  async function getToken() {
    if (config.token) return config.token.replace(/^Bearer\s+/i, '').trim();
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    if (pending) return pending;
    if (!config.username || !config.password) {
      throw new Error('Configure LOYALTY_USERNAME and LOYALTY_PASSWORD, or LOYALTY_API_TOKEN, on the backend.');
    }
    pending = (async () => {
      const url = new URL(`${baseUrl}/JWTToken/Post`);
      url.searchParams.set('UserName', config.username);
      url.searchParams.set('Password', config.password);
      const response = await fetchImpl(url, {
        method: 'POST', headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000), redirect: 'error',
      });
      if (!response.ok) throw new Error('Loyalty API authentication failed. Check backend credentials.');
      const raw = await response.text();
      let value;
      try { value = JSON.parse(raw); } catch { value = raw; }
      const token = extractToken(value);
      // Reject unrecognised error text or response formats rather than sending them as credentials.
      if (!token || /\s/.test(token) || token.length < 20) {
        throw new Error('Token response format is not recognised. Confirm the JWTToken/Post response with the API owner.');
      }
      cached = { token, expiresAt: expiry(token) };
      return token;
    })();
    try { return await pending; } finally { pending = undefined; }
  }

  async function request(path, body, method = 'POST') {
    const send = async (token) => fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: method === 'GET' ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000), redirect: 'error',
    });
    const usedToken = await getToken();
    let response = await send(usedToken);
    if (response.status === 401 && !config.token) {
      await response.body?.cancel();
      if (cached?.token === usedToken) cached = undefined;
      response = await send(await getToken());
    }
    return response;
  }
  return { post: (path, body) => request(path, body), get: path => request(path, undefined, 'GET') };
}
