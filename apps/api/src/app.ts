import Fastify from "fastify";
import { registerAuth, type AuthConfig } from "./auth/routes.js";

export interface AppOptions {
  auth?: AuthConfig;
}

/** Construct an API without binding any port. Authentication is opt-in and fails closed. */
export function buildApp(options: AppOptions = {}) {
  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024,
  });

  app.get("/api/health", async () => ({
    status: "ok" as const,
    service: "dayflow-api" as const,
    version: "0.1.0",
  }));

  if (options.auth) {
    void app.register(registerAuth, options.auth);
  }
  return app;
}
