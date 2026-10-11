import { describe, expect, it } from "vitest";
import { assertLocalDevelopmentDatabase } from "./development-guard.js";

const local = "postgres://dayflow_dev:only-test@127.0.0.1:5432/dayflow_dev";

describe("development DB safety guard", () => {
  it("allows a loopback-only isolated development database", () => {
    expect(() => assertLocalDevelopmentDatabase(local, "development")).not.toThrow();
  });

  it("refuses missing authorization, remote hosts, and production database names", () => {
    expect(() => assertLocalDevelopmentDatabase(local, undefined)).toThrow();
    expect(() =>
      assertLocalDevelopmentDatabase(
        "postgres://dayflow_dev:x@internal.example:5432/dayflow_dev",
        "development",
      ),
    ).toThrow(/loopback/);
    expect(() =>
      assertLocalDevelopmentDatabase(
        "postgres://dayflow_dev:x@localhost:5432/dayflow_production",
        "development",
      ),
    ).toThrow();
    expect(() =>
      assertLocalDevelopmentDatabase(
        "postgres://postgres:x@localhost:5432/dayflow_dev",
        "development",
      ),
    ).toThrow();
  });
});
