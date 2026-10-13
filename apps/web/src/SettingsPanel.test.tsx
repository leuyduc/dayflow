// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SettingsPanel } from "./SettingsPanel";

const stored = {
  timeZone: "Asia/Ho_Chi_Minh",
  workingDays: [1, 2, 3, 4, 5],
  workingDayStart: "09:00",
  workingDayEnd: "17:00",
  defaultTaskDurationMinutes: 30,
  bufferMinutes: 10,
  weekStartsOn: 1,
  theme: "system",
  revision: 3,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe("settings panel", () => {
  it("loads planner settings and saves the edited buffer", async () => {
    const patches: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === "/api/settings" && !init?.method) {
          return { ok: true, status: 200, json: async () => ({ settings: stored }) };
        }
        patches.push(JSON.parse(init!.body as string) as Record<string, unknown>);
        return {
          ok: true,
          status: 200,
          json: async () => ({ settings: { ...stored, bufferMinutes: 20, revision: 4 } }),
        };
      }),
    );
    render(<SettingsPanel csrfToken="test-only-csrf" />);
    const buffer = await screen.findByLabelText("Nghỉ giữa các khối (phút)");
    expect(buffer).toHaveProperty("value", "10");
    fireEvent.change(buffer, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));
    await screen.findByText("Đã lưu cài đặt.");
    expect(patches[0]).toMatchObject({ expectedRevision: 3, bufferMinutes: 20 });
  });
});
