import { createAuthRedirect, handleAuthCallback, verifyAppSession } from "../../../src/client/worker";

interface Env {
  AUTH_ORIGIN: string;
  APP_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const callback = await handleAuthCallback(request, { appId: env.APP_ID, authOrigin: env.AUTH_ORIGIN });
    if (callback) return callback;

    const session = await verifyAppSession(request, { appId: env.APP_ID, authOrigin: env.AUTH_ORIGIN });
    if (!session) return createAuthRedirect(request, { appId: env.APP_ID, authOrigin: env.AUTH_ORIGIN });

    return new Response(`Hello ${session.email}`);
  },
};
