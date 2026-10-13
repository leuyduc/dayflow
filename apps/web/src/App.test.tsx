// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "./App";
import {
  clearTestOfflineData,
  enqueueTaskChange,
  pendingOperationCount,
  queuedTask,
} from "./offline-store";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DayFlow app shell", () => {
  it("shows Today by default and changes sections through desktop navigation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<App />);

    expect(screen.getByRole("heading", { name: "Hôm nay", level: 1 })).toBeTruthy();
    const desktopNav = screen.getByRole("navigation", { name: "Các màn hình" });
    fireEvent.click(within(desktopNav).getByRole("button", { name: "Công việc" }));
    expect(screen.getByRole("heading", { name: "Công việc", level: 1 })).toBeTruthy();
    expect(
      within(desktopNav).getByRole("button", { name: "Công việc" }).getAttribute("aria-current"),
    ).toBe("page");
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("đã kết nối"));
  });

  it("supports the mobile navigation without losing selected page", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<App />);

    const mobileNav = screen.getByRole("navigation", { name: "Điều hướng điện thoại" });
    fireEvent.click(within(mobileNav).getByRole("button", { name: "Lịch" }));
    expect(screen.getByRole("heading", { name: "Lịch", level: 1 })).toBeTruthy();
    expect(
      within(mobileNav).getByRole("button", { name: "Lịch" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("displays an accurate offline status if health check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unavailable")));
    render(<App />);

    await waitFor(() =>
      expect(
        screen
          .getAllByRole("status")
          .some((element) => element.textContent?.includes("chưa kết nối")),
      ).toBe(true),
    );
  });

  it("requires login before displaying private tasks", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((uri: string) =>
          Promise.resolve({ ok: uri === "/api/health", status: uri === "/api/health" ? 200 : 401 }),
        ),
    );
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("form", { name: "Đăng nhập DayFlow" })).toBeTruthy(),
    );
    expect(screen.queryByLabelText("Ghi nhanh công việc")).toBeNull();
  });
});

describe("G7 offline sign-out safety", () => {
  it("requires explicit confirmation for pending updates/deletes and keeps them on cancel", async () => {
    await clearTestOfflineData();
    vi.stubGlobal("crypto", {
      randomUUID: () => "00000000-0000-4000-8000-000000000001",
    });
    const ownerId = "33333333-3333-4333-8333-333333333333";
    const item = {
      ...queuedTask({
        clientMutationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ownerId,
        taskId: "44444444-4444-4444-8444-444444444444",
        title: "Không xóa thao tác offline",
        createdAt: "2026-10-13T00:00:00.000Z",
        state: "pending",
      }),
      revision: 1,
    };
    await enqueueTaskChange(ownerId, item, "delete");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const fetchMock = vi.fn(async (uri: string) => {
      if (uri === "/api/health") return { ok: true };
      if (uri === "/api/auth/me")
        return {
          ok: true,
          json: async () => ({
            user: { id: ownerId, email: "offline-owner@example.test" },
            csrfToken: "test-csrf",
          }),
        };
      throw new Error("No unexpected API calls allowed while offline");
    });
    vi.stubGlobal("fetch", fetchMock);
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    const signOut = await screen.findByRole("button", { name: "Đăng xuất" });
    fireEvent.click(signOut);
    await waitFor(() => expect(confirmMock).toHaveBeenCalledOnce());
    expect(String(confirmMock.mock.calls[0]![0])).toMatch(/thao tác chưa đồng bộ/);
    expect(await pendingOperationCount(ownerId)).toBe(1);
    expect(fetchMock.mock.calls.filter(([uri]) => uri === "/api/auth/logout")).toHaveLength(0);
  });
});

describe("G7 session identity across tabs", () => {
  it("hides the previous owner's private workspace after the cookie owner changes", async () => {
    await clearTestOfflineData();
    const firstOwner = "33333333-3333-4333-8333-333333333333";
    const nextOwner = "55555555-5555-4555-8555-555555555555";
    let cookieOwner = firstOwner;
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const fetchMock = vi.fn(async (uri: string) => {
      if (uri === "/api/health") return { ok: true };
      if (uri === "/api/auth/me") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            user: { id: cookieOwner, email: "owner@example.test" },
            csrfToken: "csrf-token",
          }),
        };
      }
      if (uri === "/api/sync/bootstrap") {
        return { ok: true, json: async () => ({ tasks: [], cursor: 0 }) };
      }
      if (uri.startsWith("/api/sync/pull?")) {
        return {
          ok: true,
          json: async () => ({ changes: [], nextCursor: 0, hasMore: false }),
        };
      }
      throw new Error("Unexpected request: " + uri);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByLabelText("Ghi nhanh công việc");
    cookieOwner = nextOwner;
    fireEvent(window, new Event("focus"));
    await screen.findByRole("form", { name: "Đăng nhập DayFlow" });
    expect(screen.queryByLabelText("Ghi nhanh công việc")).toBeNull();
    expect(screen.getByText(/Tài khoản đăng nhập đã thay đổi/)).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([uri]) => uri === "/api/auth/me").length).toBeGreaterThan(
      1,
    );
  });
});
