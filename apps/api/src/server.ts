import { buildApp } from "./app.js";

const app = buildApp();
const port = Number(process.env.DAYFLOW_API_PORT ?? "3002");
const host = process.env.DAYFLOW_API_HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
