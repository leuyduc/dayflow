/** Versioned HTTP contract for the DayFlow foundation health check. */
export interface HealthResponse {
  status: "ok";
  service: "dayflow-api";
  version: string;
}
