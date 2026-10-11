import Fastify from "fastify";

/** Construct the API without opening a port, for test isolation. */
export function buildApp() {
  const app = Fastify({ logger: false });

  app.get("/api/health", async () => ({
    status: "ok" as const,
    service: "dayflow-api" as const,
    version: "0.1.0",
  }));

  return app;
}
