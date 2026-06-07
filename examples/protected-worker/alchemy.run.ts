import alchemy from "alchemy";
import { Worker } from "alchemy/cloudflare";

const app = await alchemy("passkey-gate-protected-worker");

export const worker = await Worker("protected-worker", {
  entrypoint: "./src/index.ts",
  bindings: {
    AUTH_ORIGIN: process.env.AUTH_ORIGIN ?? "https://auth.example.com",
    APP_ID: process.env.APP_ID ?? "photos",
  },
  compatibilityDate: "2026-06-06",
  compatibilityFlags: ["nodejs_compat"],
});

console.log(`protected worker: ${worker.name}`);

await app.finalize();
