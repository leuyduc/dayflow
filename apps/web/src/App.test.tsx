// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("chưa kết nối"));
  });

  it("does not present G3/G4 capabilities as implemented", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<App />);

    expect(screen.getByText(/Quản lý task, đăng nhập và đồng bộ chưa/)).toBeTruthy();
  });
});
