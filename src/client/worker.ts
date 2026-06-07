import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface PasskeyGateSession extends JWTPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
}

export function createAuthRedirect(request: Request, options: { appId: string; authOrigin: string; returnTo?: string }): Response {
  const returnTo = options.returnTo ?? request.url;
  const url = new URL("/login", options.authOrigin);
  url.searchParams.set("app", options.appId);
  url.searchParams.set("returnTo", returnTo);
  return Response.redirect(url.toString(), 302);
}

export async function handleAuthCallback(request: Request, options: { appId: string; authOrigin: string; cookieName?: string }): Promise<Response | null> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return null;
  const response = await fetch(new URL("/api/token/exchange", options.authOrigin), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, appId: options.appId }),
  });
  if (!response.ok) return new Response("Unable to exchange auth code", { status: 401 });
  const body = (await response.json()) as { session: string; expiresAt: string };
  url.searchParams.delete("code");
  return new Response(null, {
    status: 303,
    headers: {
      location: url.toString(),
      "set-cookie": `${options.cookieName ?? "pg_session"}=${encodeURIComponent(body.session)}; Expires=${new Date(body.expiresAt).toUTCString()}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

export async function verifyAppSession(request: Request, options: { appId: string; authOrigin: string; cookieName?: string }): Promise<PasskeyGateSession | null> {
  const token = getCookie(request, options.cookieName ?? "pg_session");
  if (!token) return null;
  const jwks = createRemoteJWKSet(new URL("/.well-known/passkey-gate/jwks.json", options.authOrigin));
  try {
    const result = await jwtVerify(token, jwks, { issuer: options.authOrigin, audience: options.appId });
    return result.payload as PasskeyGateSession;
  } catch {
    return null;
  }
}

export async function requireLogin(request: Request, options: { appId: string; authOrigin: string; cookieName?: string }): Promise<PasskeyGateSession | Response> {
  const callback = await handleAuthCallback(request, options);
  if (callback) return callback;
  const session = await verifyAppSession(request, options);
  return session ?? createAuthRedirect(request, options);
}

export async function fetchAuthPublicKey(authOrigin: string) {
  return fetch(new URL("/.well-known/passkey-gate/jwks.json", authOrigin)).then((response) => response.json());
}

function getCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}
