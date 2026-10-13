# DAYFLOW V2 — BIÊN BẢN TRIỂN KHAI STAGING TRÊN LINUX

Ngày kiểm chứng: **13/10/2026** (Asia/Bangkok)
Trạng thái: **LINUX PRIVATE STAGING RUNNING / E2E PASS — NOT PUBLIC PRODUCTION**
Nguồn: Windows `D:\projects\dayflow`, nhánh `feat/g5-online-sync`, HEAD `2cae801` + toàn bộ thay đổi local chưa commit.
**Không coi thư mục GitHub tại HEAD cũ là thành phẩm đã deploy.**

## 1. Triển khai đã thực hiện

- SSH kết nối bằng **tài khoản không đặc quyền `dayflow-dev`**, host key đã có từ bước kiểm tra cũ và `StrictHostKeyChecking=yes`. Không sử dụng root, sudo, Docker hệ thống hay credential production.
- Server: Ubuntu 22.04.5 LTS / x86_64; Node.js v26.7.0, npm v11.19.0. Lúc kiểm tra còn ~99 GB trống và ~10.8 GB RAM khả dụng.
- Gói ZIP nguồn được tạo lại ở chuẩn đường dẫn POSIX `/`; SHA-256 xác minh trên hai máy:
  `2f1aacd9f96789f063adf5444f89ec1fa7b297c91949618eee412e7c6a6b1390`.
- `npm ci --ignore-scripts`, TypeScript/Vite production **build PASS ngay trên Linux**. Package PostgreSQL test được cài riêng dưới home `dayflow-dev`, không cấu hình APT/system service.
- Giải quyết `libicuuc.so.60` chỉ bằng tạo ba **symlink libicu*.so.60** tới các `libicu*.so.60.2` **có sẵn trong package PostgreSQL** tại staging. Kiểm tra `ldd` không còn thiếu thư viện; không thay đổi `/usr/lib`, apt sources hay library toàn hệ thống.
- Chạy PostgreSQL sandbox **riêng của DayFlow**, dữ liệu/owner demo tiếng Việt, định dạng UTF-8. Database persist qua restart.
- Chạy bản React/PWA build thật + authenticated Fastify API qua Vite preview same-origin, **chỉ bind 127.0.0.1**.

## 2. Bố trí an toàn trên Linux

| Thành phần | Phạm vi và vị trí |
|---|---|
| Tài khoản | `dayflow-dev`, không thuộc nhóm sudo/docker |
| Release cụ thể | `$HOME/dayflow-staging/releases/20261013-2f1aacd9/` |
| Current symlink | `$HOME/dayflow-staging/current` |
| Dữ liệu chung | `$HOME/dayflow-staging/shared/artifacts/` (riêng tư) |
| PostgreSQL staging | `127.0.0.1:55435`, database `dayflow_test_local_preview` |
| Web/API staging | `127.0.0.1:5183` (Linux localhost) |
| PID và log | `$HOME/dayflow-staging/run/` và `logs/` |
| Credentials staging | `shared/artifacts/dayflow-local-preview/LOGIN-LOCAL-ONLY.txt` (không commit, không in nội dung); local-secrets.json mode `600` |

Tài sản bên trong `$HOME/dayflow-staging/` **không thuộc Nginx, Cloudflare, Docker hoặc production hiện có**. Không cài service hệ thống, không expose LAN/Internet, không sửa cấu hình SSH/Nginx/firewall/DNS.

Bản ZIP đầu tiên từ Windows có backslash trong entry và được giữ ở phần incoming/failed release để phục vụ chẩn đoán; gói POSIX đã thay thế và checksum PASS. Các log failed start do thiếu ICU cũng được lưu riêng, không ghi đè.

## 3. Truy cập giao diện từ Windows

Đã tạo tệp **chỉ trên máy Windows, bị Git ignore**:

`D:\projects\dayflow\.artifacts\deploy\CONNECT_DAYFLOW_LINUX.bat`

Mở tệp này để thiết lập SSH tunnel qua tài khoản `dayflow-dev`. Giữ cửa sổ tunnel đang chạy, rồi truy cập:

**http://127.0.0.1:5183**

Đăng nhập bằng file local chỉ để test:

`D:\projects\dayflow\.artifacts\deploy\LOGIN_DAYFLOW_LINUX_STAGING.txt`

Tệp này được chuyển trực tiếp qua SCP/SFTP có SSH host verification, không in mật khẩu trong chat, không commit hoặc đóng gói công khai. Không đăng nhập vào dịch vụ production bằng tài khoản demo.

Khi cửa sổ SSH tunnel đóng, đường dẫn trên Windows sẽ không còn hoạt động cho tới khi mở tunnel lại. Máy Linux vẫn tiếp tục chạy staging nếu tiến trình `dayflow-dev` còn sống.

## 4. Bằng chứng QA đã thực thi

| Hạng mục | Kết quả |
|---|---|
| ZIP chuẩn POSIX + SHA-256 hai đầu | **PASS** |
| Build React, Fastify, domain trên Linux | **PASS** |
| PostgreSQL ICU package symlinks local, không sửa hệ thống | **PASS** |
| API health trên Linux và qua Windows tunnel | **HTTP 200 PASS** |
| API session chưa đăng nhập | **HTTP 401 đúng kỳ vọng** |
| PID tồn tại sau khi ngắt/kết nối SSH lại | **PASS** |
| Cổng 5183 và 55435 chỉ lắng nghe `127.0.0.1` | **PASS** |
| Quyền file bí mật staging | **600 PASS** |
| Chrome trên Windows qua tunnel: login + dữ liệu tiếng Việt | **PASS** |
| Tạo việc online, reload, thấy dữ liệu từ PostgreSQL | **PASS** |
| Tạo việc offline, reconnect, reload, dữ liệu tồn tại | **PASS** |
| Calendar desktop và mobile 390px không tràn ngang | **PASS** |
| Settings hiển thị và có trường múi giờ | **PASS** |
| Xóa các công việc fixture sau E2E | **PASS** |
| Dừng riêng staging (web và DB ports rảnh, postmaster.pid vắng mặt) | **PASS** |
| Khởi động lại staging với database cũ (`POSTGRES_REUSED=PASS`) | **PASS** |
| Chrome E2E chạy lại sau restart | **PASS** |

Đã chụp screenshots trong Git-ignored Windows `.artifacts/deploy/`:
`LINUX_STAGE_CALENDAR_DESKTOP.png`, `LINUX_STAGE_CALENDAR_MOBILE.png`.

**Ghi chú dừng/restart:** Khi gửi SIGTERM cho riêng PID của DayFlow, node và PostgreSQL dừng, hai port được giải phóng và không còn `postmaster.pid`; log Node lần dừng đầu không có marker callback stop nên không được dùng marker này làm bằng chứng. Log cũ và PID được archive, sau đó chạy lại staging và PostgreSQL reused PASS. Không kill process khác.

## 5. Hạn chế và hành động chưa được phép

- **Đây KHÔNG phải website công khai hoặc production release.** Chưa cấu hình DNS/HTTPS, Nginx hay Cloudflare cho DayFlow.
- Chưa cài Linux systemd/auto-restart sau reboot. Phiên staging hiện chạy bằng `nohup` dưới `dayflow-dev`; nếu host reboot sẽ cần vận hành khởi động lại bằng quy trình kiểm tra PID/port/data tương ứng.
- G1-A: khóa SSH root cũ đã lộ chưa được xác nhận thu hồi. G1-C: dev/prod network isolation chưa chứng minh an toàn. **G1 NOT PASSED.**
- G8: chưa có encrypted off-host PostgreSQL backup và thử restore từ ngoài host. JSON export khác với DB disaster recovery.
- G7: offline cold restart không xác thực lại owner; không phát hành tính năng truy cập cached private data offline lạnh nếu không có thiết kế mã hóa/unlock.
- Full dev dependency audit còn cảnh báo; production dependency audit local trước đó không tìm thấy vấn đề mức moderate trở lên.
- Không có CI exact SHA cho dirty local code. GitHub/main chưa được cập nhật, không được tự coi việc SCP ZIP thành production release.

**Điều kiện cần để mở public URL:** operator duyệt kế hoạch khắc phục G1-A/G1-C, off-host DB backup/restore G8, staging security/a11y/load/monitoring/TLS, CI/commit review và Gate G9. Không tự sử dụng root key hoặc sửa các dịch vụ đang sống.

## 6. Continuity và cách làm việc

Mỗi lần mở chat mới: đọc `D:\projects\dayflow\.chatgpt\STATE.md`, JOURNAL và actual Git status/HEAD trên ổ D. Sau đó kiểm tra staging qua tài khoản `dayflow-dev` ở chế độ read-only trước bất kỳ thay đổi nào. Giữ nguyên release và shared database; không reset GitHub lên Windows hoặc dùng dữ liệu demo này làm production.

Lưu các bước khởi tạo, kiểm tra symlinks, chạy, dừng, kiểm chứng trong thư mục Windows ignored `.artifacts/deploy/`; đây là lịch sử thao tác thực tế, không chứa production credentials. `docs/V2_ACTIVE_MASTER_PLAN_20261013.md` vẫn điều phối các Gate G0–G9.

## 7. Tiếp tục kiểm tra và chuẩn bị vận hành sau triển khai

**Kiểm chứng bổ sung 13/10/2026:** một lượt Chrome E2E mới qua tunnel đến Linux staging kết thúc exit 0 với:
- `LINUX_STAGE_REAL_CHROME_LOGIN_AND_UNICODE_TASKS=PASS`
- `LINUX_STAGE_REAL_CHROME_CREATE_PERSIST_RELOAD=PASS`
- `LINUX_STAGE_REAL_CHROME_OFFLINE_RECONNECT_POSTGRES=PASS`
- `LINUX_STAGE_REAL_CHROME_CALENDAR_DESKTOP_MOBILE=PASS`
- `LINUX_STAGE_G8_JSON_EXPORT_WITH_SETTINGS=PASS` — tải xuống JSON của owner demo với version1, dữ liệu tiếng Việt, các công việc test và timezone đã lưu
- `LINUX_STAGE_TEST_FIXTURES_REMOVED=PASS`
- `LINUX_STAGE_REAL_BROWSER_E2E_RESULT=PASS`

Bài test nằm tại file Windows **gitignored** `.artifacts/deploy/browser-linux-staging.mjs`. Download JSON chỉ nằm trong thư mục tạm do Chrome tạo, không tải lên Git hoặc in dữ liệu owner ra log.

**Vận hành staging:** đã kiểm tra `systemctl --user is-system-running` trả `degraded` và `loginctl show-user dayflow-dev -p Linger` là `no`. Không tự giả định DayFlow sẽ sống sau reboot; chưa tạo systemd service/cron/linger. Đã soạn `scripts/dayflow-staging-ops.sh` để quản lý an toàn với xác minh PID, thư mục release và hai cổng nội bộ; kiểm tra cú pháp shell tại Windows PASS. **Script chưa được cài/kích hoạt trên máy Linux**, vì thao tác chuẩn bị từ xa không được công cụ thực hiện. Hiện tại staging giữ nguyên `nohup`; khi reboot cần dùng quy trình khởi chạy được nghiệm chứng hoặc cấu hình supervisor sau kiểm toán và phê duyệt.

**Database G8:** thư mục native PostgreSQL 17 ở staging chỉ chứa `postgres`, `initdb`, `pg_ctl`; `pg_dump` hiện có của Ubuntu là **14.24**. Chưa thể diễn tập `pg_dump` của PG17: cần chuẩn bị client17 được xác thực chữ ký và kiểm tra compatibility, không tự cài vào global host hoặc lấy từ production. File tiếp nối: `docs/DAYFLOW_G8_DB_RESTORE_PLAN_20261013.md`. Do đó encrypted off-host DB backup/restore **NOT VERIFIED**.

Các lỗi/chặn này không làm mất staging hiện hành: kiểm tra HTTP tunnel gần nhất trả 200, E2E login/CRUD/offline/Calendar/Settings/JSON export PASS. Bản staging này vẫn chưa đủ điều kiện public release.

## 8. Vite Host header cho tên miền `dayflow.liuduc.site`

- Khi proxy gửi `Host: dayflow.liuduc.site` tới `vite preview`, Vite có thể trả `403 Blocked request` nếu hostname chưa có trong danh sách.
- Nguồn Windows trên nhánh `feat/g5-online-sync` đã cấu hình `apps/web/vite.config.ts` với `preview.allowedHosts: ["dayflow.liuduc.site"]`, không sử dụng `true` hoặc wildcard. Lệnh `npm run test:preview:allowed-hosts` kiểm tra request Host chính xác trả HTTP 200, loopback trả 200, hostname lạ vẫn bị chặn HTTP 403.
- **Push GitHub không tự sửa tiến trình staging đang chạy.** Cần triển khai một release mới đã kiểm chứng từ commit chính xác rồi khởi động lại staging theo runbook/rollback riêng để nhận cấu hình này. Không tự thay đổi proxy, Cloudflare, TLS hoặc dịch vụ production trong bước push.
- Vite `preview` chỉ dành cho bản xem thử, không được coi là máy chủ production. Trước khi công khai hóa DayFlow cần hoàn thành G1 bảo mật, G8 khôi phục database, staging CI và release G9.
