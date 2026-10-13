import { useEffect, useState, type FormEvent } from "react";
import { BackupPanel } from "./BackupPanel";
import { CalendarPanel } from "./CalendarPanel";
import { SettingsPanel } from "./SettingsPanel";
import { TaskWorkspace, type Page } from "./TaskWorkspace";
import { pendingOperationCount } from "./offline-store";

type ApiStatus = "checking" | "online" | "offline";
type User = { id: string; email: string };
type AuthResponse = { user: User; csrfToken: string };

const pages: ReadonlyArray<{ id: Page; title: string; icon: string }> = [
  { id: "today", title: "Hôm nay", icon: "◉" },
  { id: "inbox", title: "Công việc", icon: "☷" },
  { id: "calendar", title: "Lịch", icon: "▦" },
  { id: "settings", title: "Cài đặt", icon: "⚙" },
];
const hints: Record<Page, string> = {
  today: "Một nơi rõ ràng để bắt đầu ngày mới.",
  inbox: "Ghi lại, sắp xếp và theo dõi công việc.",
  calendar: "Xem kế hoạch của bạn theo ngày, tuần và tháng.",
  settings: "Tùy chỉnh trải nghiệm làm việc của bạn.",
};

function LoginPanel({ onLogin }: { onLogin: (value: AuthResponse) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok)
        throw new Error(
          res.status === 401
            ? "Email hoặc mật khẩu không đúng."
            : res.status === 429
              ? "Thử đăng nhập quá nhiều lần. Hãy thử lại sau."
              : "Chưa thể đăng nhập. Kiểm tra API và cấu hình tài khoản.",
        );
      const body = (await res.json()) as AuthResponse;
      setPassword("");
      onLogin(body);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="login-panel" aria-label="Đăng nhập DayFlow">
      <h2>Đăng nhập DayFlow</h2>
      <p>
        Tài khoản chủ sở hữu được tạo riêng trong môi trường phát triển. Không có đăng ký công khai.
      </p>
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email tài khoản"
      />
      <label htmlFor="login-password">Mật khẩu</label>
      <input
        id="login-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error && (
        <p role="alert" className="task-error">
          {error}
        </p>
      )}
      <button disabled={busy} type="submit">
        {busy ? "Đang xác thực..." : "Đăng nhập"}
      </button>
    </form>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("today");
  const [api, setApi] = useState<ApiStatus>("checking");
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((response) => setApi(response.ok ? "online" : "offline"))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setApi("offline");
      });
    fetch("/api/auth/me", {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as AuthResponse;
        if (!controller.signal.aborted) setSession(body);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setAuthReady(true);
      });
    return () => controller.abort();
  }, []);

  // A different tab can replace the same-origin session cookie without
  // causing this React tree to unmount. Verify the active owner on focus/
  // reconnect and immediately hide old private UI if identity changed.
  // Offline/network failures do not destroy unsent IndexedDB work.
  useEffect(() => {
    if (!session) return;
    const ownerAtMount = session.user.id;
    const csrfAtMount = session.csrfToken;
    let active = true;
    let checking = false;
    async function verifyOwner() {
      if (!active || checking || !navigator.onLine) return;
      checking = true;
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!active) return;
        if (response.status === 401) {
          setSession(null);
          setPage("today");
          setAuthError(
            "Phiên đăng nhập đã hết hạn. Công việc offline vẫn được giữ theo tài khoản.",
          );
          return;
        }
        if (!response.ok) return;
        const verified = (await response.json()) as AuthResponse;
        if (!active) return;
        if (!verified.user || verified.user.id !== ownerAtMount) {
          setSession(null);
          setPage("today");
          setAuthError(
            "Tài khoản đăng nhập đã thay đổi. Hãy đăng nhập lại để bảo vệ dữ liệu riêng.",
          );
        } else if (verified.csrfToken !== csrfAtMount) {
          setSession(verified);
        }
      } catch {
        // A network error does not imply logout; keep pending work intact.
      } finally {
        checking = false;
      }
    }
    const onFocus = () => void verifyOwner();
    const onOnline = () => void verifyOwner();
    const onVisible = () => {
      if (document.visibilityState === "visible") void verifyOwner();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session?.user.id, session?.csrfToken]);

  async function logout() {
    if (!session) return;
    setAuthError("");
    try {
      // Pending work is owner-scoped and retained in IndexedDB, not silently wiped.
      const pending = await pendingOperationCount(session.user.id);
      if (
        pending > 0 &&
        !window.confirm(
          "Còn " +
            pending +
            " thao tác chưa đồng bộ. Đăng xuất sẽ giữ hàng chờ trên thiết bị này, nhưng chỉ gửi lại sau khi đăng nhập đúng tài khoản. Vẫn đăng xuất?",
        )
      ) {
        return;
      }
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Dayflow-CSRF": session.csrfToken },
      });
      if (!res.ok) throw new Error("Không thể đăng xuất. Vui lòng thử lại.");
      setSession(null);
      setPage("today");
    } catch (issue) {
      setAuthError(issue instanceof Error ? issue.message : "Không thể đăng xuất.");
    }
  }

  const current = pages.find((item) => item.id === page) ?? pages[0]!;

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Điều hướng chính">
        <div className="brand">
          <span className="brand-mark">D</span>DayFlow
        </div>
        <p className="sidebar-caption">Không gian làm việc cá nhân</p>
        <nav className="nav-list" aria-label="Các màn hình">
          {pages.map((item) => (
            <button
              key={item.id}
              type="button"
              className={"nav-link" + (page === item.id ? " active" : "")}
              onClick={() => setPage(item.id)}
              aria-current={page === item.id ? "page" : undefined}
            >
              <span aria-hidden="true" className="nav-icon">
                {item.icon}
              </span>
              {item.title}
            </button>
          ))}
        </nav>
        <div className="side-footer">DayFlow V2 · Development</div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <span className="topbar-title">Tổng quan</span>
          <div className="header-right">
            <span className={"api-status " + api} role="status">
              <span className="status-dot" aria-hidden="true" />
              API{" "}
              {api === "checking"
                ? "đang kiểm tra"
                : api === "online"
                  ? "đã kết nối"
                  : "chưa kết nối"}
            </span>
            {session && (
              <button className="signout" onClick={() => void logout()}>
                Đăng xuất
              </button>
            )}
          </div>
        </header>
        <main className="content" id="main-content">
          <div className="section-eyebrow">DAYFLOW / QUẢN LÝ CÔNG VIỆC</div>
          <h1>{current.title}</h1>
          <p className="subtitle">{hints[page]}</p>
          {authError && (
            <p role="alert" className="task-error">
              {authError}
            </p>
          )}
          {!authReady ? (
            <p role="status">Đang kiểm tra tài khoản...</p>
          ) : session ? (
            page === "calendar" ? (
              <CalendarPanel key={session.user.id} csrfToken={session.csrfToken} />
            ) : page === "settings" ? (
              <>
                <SettingsPanel
                  key={session.user.id + ":" + settingsVersion}
                  csrfToken={session.csrfToken}
                />
                <BackupPanel
                  csrfToken={session.csrfToken}
                  onImported={() => setSettingsVersion((version) => version + 1)}
                />
              </>
            ) : (
              <TaskWorkspace
                key={session.user.id}
                ownerId={session.user.id}
                csrfToken={session.csrfToken}
                page={page}
              />
            )
          ) : (
            <>
              {api === "offline" && (
                <p role="status" className="subtitle">
                  Chưa kết nối được máy chủ. Giao diện có thể mở ngoại tuyến, nhưng cần kết nối để
                  xác thực tài khoản và đồng bộ. Công việc đã lưu chờ trên thiết bị không bị xóa.
                </p>
              )}
              <LoginPanel onLogin={(value) => setSession(value)} />
            </>
          )}
        </main>
        <nav className="bottom-nav" aria-label="Điều hướng điện thoại">
          {pages.map((item) => (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? "active" : ""}
              onClick={() => setPage(item.id)}
              aria-current={page === item.id ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.title}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
