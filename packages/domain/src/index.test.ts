import { describe, expect, it } from "vitest";
import { normalizeTaskTitle, validateTaskTitle } from "./index.js";

describe("task title", () => {
  it("normalizes whitespace", () => {
    expect(normalizeTaskTitle("  Họp   nhóm \n sáng  ")).toBe("Họp nhóm sáng");
  });

  it("rejects empty titles", () => {
    expect(() => validateTaskTitle("  \n ")).toThrow(/không được để trống/);
  });

  it("keeps valid input", () => {
    expect(validateTaskTitle(" Viết kế hoạch ")).toBe("Viết kế hoạch");
  });
});
