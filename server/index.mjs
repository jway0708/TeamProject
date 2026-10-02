import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createAuthorization } from './loyalty-auth.mjs';

// Only account bootstrap routes and the session-protected member profile are exposed.
const routes = new Set([
  '/api/MemberAccount/RequestOTP',
  '/api/MemberAccount/RegisterOtp',
  '/api/MemberLogin/MemberMobileLoginGetProfile',
  '/api/MemberLogin/RegisterMember',
  '/api/MemberWallet/CheckReffererCodeValid',
  '/api/MemberDetails/GetMemberDetails',
]);

const loginRoutes = new Set([
  '/api/MemberLogin/MemberMobileLoginGetProfile',
]);
const canonicalPhone = value => typeof value === 'string' ? value.replace(/[\s()+-]/g, '') : '';
const lowerKeys = value => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key.toLowerCase(), entry])) : {};

function confirmsLogin(value, phone) {
  const data = lowerKeys(value);
  if (data.success === false || data.issuccess === false || data.error || data.errors) return false;
  if (data.success === true || data.issuccess === true) return true;
  if (data.phonenumber && canonicalPhone(data.phonenumber) === canonicalPhone(phone)) return true;
  return data.data ? confirmsLogin(data.data, phone) : false;
}

export function createGateway(config, fetchImpl = fetch) {
  const auth = createAuthorization(config, fetchImpl);
  const sessions = new Map();
  const cookieName = 'member_session';
  const sessionCookie = (id, age) => `${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${config.secureCookies ? '; Secure' : ''}`;
  return createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, 'http://localhost');
    if (!routes.has(url.pathname) || url.search) return reply(404, { message: 'API route is not available.' });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return reply(405, { message: 'Use POST.' });
    }
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      return reply(415, { message: 'Send application/json.' });
    }
    let body;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16_384) return reply(413, { message: 'Request body is too large.' });
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString());
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    } catch { return reply(400, { message: 'Send a valid JSON object.' }); }
    const sessionId = req.headers.cookie?.split(';').map(part => part.trim())
      .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (loginRoutes.has(url.pathname) || url.pathname === '/api/MemberLogin/RegisterMember') {
      if (sessionId) sessions.delete(sessionId);
      res.setHeader('Set-Cookie', sessionCookie('', 0));
    }
    if (url.pathname === '/api/MemberDetails/GetMemberDetails') {
      const session = sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return reply(401, { message: 'Please sign in again.' });
      }
      if (body.PhoneNumber && canonicalPhone(body.PhoneNumber) !== canonicalPhone(session.phone)) {
        return reply(403, { message: 'You can only load your own member profile.' });
      }
      body = { PhoneNumber: session.phone };
    }
    try {
      // The existing frontend uses PhoneNumber/OtpCode; Swagger LoginData uses Phone/OTP.
      let upstreamBody = body;
      if (loginRoutes.has(url.pathname)) {
        if (!canonicalPhone(body.PhoneNumber) || !body.OtpCode) {
          return reply(400, { message: 'Phone number and OTP are required.' });
        }
        upstreamBody = { Phone: body.PhoneNumber, OTP: String(body.OtpCode), FirstLogin: false, DeviceId: body.DeviceId || '' };
      }
      if (url.pathname === '/api/MemberLogin/RegisterMember') {
        // RegisterMember has no OTP field in Swagger. Do not treat registration
        // as an authenticated member session; require a subsequent real OTP login.
        upstreamBody = { PhoneNumber: body.PhoneNumber, ReferralBy: body.ReferralCode || '' };
      }
      const upstream = await auth.post(url.pathname.slice(4), upstreamBody);
      if (upstream.status === 401) {
        return reply(502, { message: 'Loyalty API rejected backend authorization. Check credentials or replace the configured Token.' });
      }
      const raw = await upstream.text();
      let value;
      try { value = raw ? JSON.parse(raw) : {}; }
      catch { return reply(502, { message: 'Loyalty API returned an unexpected response.' }); }
      if (loginRoutes.has(url.pathname) && upstream.ok) {
        if (!canonicalPhone(body.PhoneNumber) || !body.OtpCode || !confirmsLogin(value, body.PhoneNumber)) {
          return reply(502, { message: 'Login was not confirmed by Loyalty API. Check the login response format with the API owner.' });
        }
        const now = Date.now();
        for (const [id, session] of sessions) if (session.expiresAt <= now) sessions.delete(id);
        const id = randomBytes(32).toString('hex');
        sessions.set(id, { phone: body.PhoneNumber.trim(), expiresAt: now + 3_600_000 });
        res.setHeader('Set-Cookie', sessionCookie(id, 3600));
      }
      if (url.pathname === '/api/MemberDetails/GetMemberDetails' && upstream.ok) {
        const envelope = lowerKeys(value);
        if (envelope.success === false || envelope.issuccess === false) {
          return reply(502, { message: 'Unable to load your member profile.' });
        }
        const profile = lowerKeys(envelope.data || value);
        if (canonicalPhone(profile.phonenumber) !== canonicalPhone(body.PhoneNumber)) {
          return reply(502, { message: 'Loyalty API returned a profile for a different member or an unsupported profile format.' });
        }
        // Only display fields leave the backend; never expose Password or DeviceId.
        const fields = ['Name', 'PhoneNumber', 'Email', 'Tier', 'Balance', 'Point', 'TotalStamp', 'ReferralCode'];
        return reply(200, Object.fromEntries(fields.map(key => [key, profile[key.toLowerCase()] ?? null])));
      }
      // OTP responses can contain the actual code. Never return it to the browser.
      const publicValue = JSON.parse(JSON.stringify(value, (key, entry) =>
        /^(otp|otpcode|token|access_token|accesstoken|jwttoken|password)$/i.test(key) ? undefined : entry));
      return reply(upstream.status, publicValue);
    } catch (error) {
      // Do not log fetch errors: their URL could contain authentication credentials.
      const message = error.message?.startsWith('Configure ') || error.message?.startsWith('Token response ') ||
        error.message === 'Loyalty API authentication failed. Check backend credentials.'
        ? error.message : 'Cannot reach Loyalty API. Check backend connectivity and configuration.';
      return reply(502, { message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = {
    baseUrl: process.env.LOYALTY_API_BASE_URL || 'https://xcodeappapi.xcode.com.my/api',
    username: process.env.LOYALTY_USERNAME,
    password: process.env.LOYALTY_PASSWORD,
    token: process.env.LOYALTY_API_TOKEN,
    secureCookies: process.env.SECURE_COOKIES === 'true',
  };
  const port = Number(process.env.PORT || 3000);
  if (!config.token && (!config.username || !config.password)) {
    console.error('Set backend credentials in server/.env before starting. See server/README.md.');
    process.exitCode = 1;
  } else {
    const server = createGateway(config);
    server.on('error', () => { console.error('Backend could not start. Check PORT and HOST.'); process.exitCode = 1; });
    server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`OTP backend listening on port ${port}`));
  }
}
