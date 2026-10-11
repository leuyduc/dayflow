import { useEffect, useState } from "react";

type Page = "today" | "inbox" | "calendar" | "settings";
type ApiStatus = "checking" | "online" | "offline";

const pages: ReadonlyArray<{ id: Page; title: string; icon: string }> = [
  { id: "today", title: "Hôm nay", icon: "◉" },
  { id: "inbox", title: "Công việc", icon: "☷" },
  { id: "calendar", title: "Lịch", icon: "▦" },
  { id: "settings", title: "Cài đặt", icon: "⚙" },
];

const hints: Record<Page, string> = {
  today: "Một nơi rõ ràng để bắt đầu ngày mới.",
  inbox: "Ghi lại, sắp xếp và theo dõi công việc.",
  calendar: "Lịch ngày, tuần, tháng sẽ được triển khai ở G6.",
  settings: "Cấu hình thời gian làm việc và đồng bộ sẽ có ở các Gate tiếp theo.",
};

export function App() {
  const [page, setPage] = useState<Page>("today");
  const [api, setApi] = useState<ApiStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        setApi("online");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setApi("offline");
        }
      });
    return () => controller.abort();
  }, []);

  const current = pages.find((item) => item.id === page) ?? pages[0]!;

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Điều hướng chính">
        <div className="brand"><span className="brand-mark">D</span>DayFlow</div>
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
              <span aria-hidden="true" className="nav-icon">{item.icon}</span>
              {item.title}
            </button>
          ))}
        </nav>
        <div className="side-footer">DayFlow V2 · Development</div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <span className="topbar-title">Tổng quan</span>
          <span className={"api-status " + api} role="status">
            <span className="status-dot" aria-hidden="true" />
            API {api === "checking" ? "đang kiểm tra" : api === "online" ? "đã kết nối" : "chưa kết nối"}
          </span>
        </header>

        <main className="content" id="main-content">
          <div className="section-eyebrow">DAYFLOW / NỀN TẢNG</div>
          <h1>{current.title}</h1>
          <p className="subtitle">{hints[page]}</p>
          <div className="message-card">
            <div className="message-icon" aria-hidden="true">✦</div>
            <div>
              <h2>Khung ứng dụng đã sẵn sàng để phát triển</h2>
              <p>G2 tạo nền tảng điều hướng và API health. Quản lý task, đăng nhập và đồng bộ chưa được triển khai; chưa lưu bất kỳ dữ liệu cá nhân nào.</p>
              <span className="stage">G2 · Foundation</span>
            </div>
          </div>
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
              <span aria-hidden="true">{item.icon}</span>{item.title}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
