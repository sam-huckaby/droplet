import { exportJWK, generateKeyPair } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthRedirect, handleAuthCallback, verifyAppSession } from "../src/client/worker";
import { publicJwksFromPrivateSecret, signAppSession } from "../src/crypto/signing";

describe("worker client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates auth redirects", () => {
    const response = createAuthRedirect(new Request("https://photos.example.com/private"), {
      appId: "photos",
      authOrigin: "https://auth.example.com",
    });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin).toBe("https://auth.example.com");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("app")).toBe("photos");
    expect(location.searchParams.get("returnTo")).toBe("https://photos.example.com/private");
  });

  it("exchanges callback codes and sets an app session cookie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ session: "token", expiresAt: "2030-01-01T00:00:00.000Z" })),
    );
    const response = await handleAuthCallback(new Request("https://photos.example.com/?code=abc"), {
      appId: "photos",
      authOrigin: "https://auth.example.com",
    });
    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe("https://photos.example.com/");
    expect(response?.headers.get("set-cookie")).toContain("pg_session=token");
  });

  it("verifies app session JWTs with remote JWKS", async () => {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    const jwk = await exportJWK(privateKey);
    jwk.kid = "default";
    jwk.alg = "ES256";
    jwk.use = "sig";
    const secret = JSON.stringify(jwk);
    const token = await signAppSession(secret, { iss: "https://auth.example.com", aud: "photos", sub: "pk_1", email: "sam@example.com", isAdmin: false }, new Date(Date.now() + 60_000));
    const jwks = await publicJwksFromPrivateSecret(secret);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(jwks)));
    const session = await verifyAppSession(new Request("https://photos.example.com/", { headers: { cookie: `pg_session=${token}` } }), {
      appId: "photos",
      authOrigin: "https://auth.example.com",
    });
    expect(session?.sub).toBe("pk_1");
    expect(session?.email).toBe("sam@example.com");
  });

  it("returns null for missing sessions", async () => {
    await expect(verifyAppSession(new Request("https://photos.example.com/"), { appId: "photos", authOrigin: "https://auth.example.com" })).resolves.toBeNull();
  });
});
