import { sha256Base64Url } from "../crypto/hashing";
import { signAppSession } from "../crypto/signing";
import { id } from "../crypto/random";
import type { AppConfig, Env } from "../types";
import { getState, json, readJson, requestMeta } from "./helpers";

export async function handleTokenExchange(request: Request, env: Env, config: AppConfig): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await readJson<{ code: string; appId: string }>(request);
  if (!config.allowedApps[body.appId]) return json({ ok: false, error: "Invalid app or code" }, { status: 400 });
  const code = await getState(env).consumeAuthCode(await sha256Base64Url(body.code ?? ""), body.appId);
  if (!code) return json({ ok: false, error: "Invalid app or code" }, { status: 400 });
  const passkey = await getState(env).getPasskey(code.passkeyId);
  if (!passkey || passkey.revokedAt) return json({ ok: false, error: "Invalid app or code" }, { status: 403 });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const session = await signAppSession(
    env.AUTH_PRIVATE_KEY,
    { iss: config.authOrigin.origin, aud: body.appId, sub: passkey.id, email: passkey.email, isAdmin: passkey.isAdmin },
    expiresAt,
  );
  await getState(env).addAuditEvent({ id: id("audit"), eventType: "auth_code_consumed", appId: body.appId, passkeyId: passkey.id, email: passkey.email, ...requestMeta(request) });
  await getState(env).addAuditEvent({ id: id("audit"), eventType: "session_created", appId: body.appId, passkeyId: passkey.id, email: passkey.email, ...requestMeta(request) });
  return json({ ok: true, session, email: passkey.email, passkeyId: passkey.id, isAdmin: passkey.isAdmin, expiresAt: expiresAt.toISOString() });
}
