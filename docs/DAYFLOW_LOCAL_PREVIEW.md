# DayFlow V2 — Bản dùng thử chạy được trên Windows

Ngày bàn giao: 13/10/2026
Thư mục nguồn và ứng dụng: `D:\projects\dayflow`
Loại thành phẩm: **Local Review / MVP demonstration**, không phải bản production.

## 1. Khởi chạy trong một lần bấm

**Trên chính máy Windows có repo DayFlow:**

1. Mở thư mục `D:\projects\dayflow`.
2. Nhấp đúp `START_DAYFLOW_LOCAL.bat`. Cần Node.js >= 22.12 và npm; nếu thiếu dependency, file sẽ cài trong workspace hoặc trong sandbox local.
3. File .bat tự build React/Vite/TypeScript, khởi tạo (hoặc mở lại) PostgreSQL dành riêng cho DayFlow, khởi động API Fastify, chạy trang web được build thật và mở trình duyệt.
4. Nếu cửa sổ trình duyệt không tự mở, truy cập **http://127.0.0.1:5180**.
5. Đăng nhập theo thông tin trong file **`D:\projects\dayflow\.artifacts\dayflow-local-preview\LOGIN-LOCAL-ONLY.txt`**. Mật khẩu demo được sinh ngẫu nhiên lần đầu, không ghi vào tài liệu này hay Git.

**Giữ cửa sổ CMD chạy.** Để dừng, nhấn `Ctrl+C` hoặc gõ `q` rồi Enter. Lần sau mở lại file .bat; công việc và cài đặt trên database demo vẫn còn.

> Không gửi file LOGIN-LOCAL-ONLY.txt hay thư mục .artifacts cho người khác. Đây là dữ liệu/credential TEST, lưu local và bị Git ignore; không được dùng tài khoản này cho production.

## 2. Có gì để trải nghiệm?

| Khu vực | Tính năng |
|---|---|
| Đăng nhập | Account owner riêng trong database test, session cookie, CSRF, logout |
| Hôm nay | Công việc đã xếp, quá hạn, chưa xếp; duyệt theo ngày |
| Công việc | Ghi nhanh; sửa, hoàn thành, mở lại, xóa; tìm kiếm, lọc, sắp xếp, ưu tiên, ngày đến hạn, thẻ, thời lượng, việc con |
| Lịch | Chế độ ngày/tuần/tháng, xếp giờ thủ công, xem trước gợi ý lịch, duyệt hoặc bỏ đề xuất |
| Đồng bộ | Online change feed; thao tác tạo/sửa/xóa có UUID bền vững trong Dexie trước khi gửi, tránh nhân đôi sau lỗi phản hồi |
| Offline/PWA | Khi đã đăng nhập và ứng dụng còn mở, tạo/sửa/xóa offline và gửi lại khi có mạng; static shell PWA có thể tải lại nhưng không lộ dữ liệu cá nhân khi chưa xác thực |
| Settings | Múi giờ, ngày/giờ làm việc, độ dài khối, buffer, ngày đầu tuần, giao diện |
| Sao lưu ứng dụng | Xuất JSON và nhập với preview/validation/merge transaction |

**Dữ liệu mẫu:** lần khởi tạo đầu có 5 việc tiếng Việt về lập kế hoạch, theo dõi tiến độ, báo cáo và học tính năng; có ưu tiên, thời lượng, hạn hoàn thành và một việc đã xong. Việc đã tạo trên database demo không bị tự thêm lại sau khi bạn xóa hoặc sau khi khởi động lại.

Bạn có thể mở nhiều tab cùng `http://127.0.0.1:5180` để thử đồng bộ trong trình duyệt. Địa chỉ **127.0.0.1 chỉ truy cập được trên máy Windows đó**, không mở cổng ra mạng LAN/Internet. Muốn dùng trực tiếp từ điện thoại qua mạng cần xây dựng staging/production riêng sau kiểm tra G1 bảo mật và phê duyệt.

## 3. Thư mục và tài sản thành phẩm

- **File một lần bấm:** `D:\projects\dayflow\START_DAYFLOW_LOCAL.bat`
- **Lệnh khởi chạy:** `npm run demo:local`
- **Kiểm thử Chrome + database:** `npm run demo:smoke` hoặc `START_DAYFLOW_LOCAL.bat --smoke` trong CMD
- **Lệnh tạo ZIP chuyển máy:** `npm run demo:package`
- **Gói ZIP:** `.artifacts/releases/DayFlow_V2_Local_Review_20261013.zip`. Chứa source cần thiết, bản web/API đã build, file BAT và hướng dẫn; **không chứa database, file login, secrets hoặc node_modules**. Giải nén đầy đủ rồi chạy file BAT trên Windows x64 với Node/npm; BAT sẽ cài dependency cần thiết tại máy mới.
- **Script backend/preview:** `scripts/start-local-preview.mjs`
- **Bản web thật:** `apps/web/dist/` (tự build mỗi lần khởi chạy)
- **PostgreSQL local có lưu dữ liệu:** `.artifacts/dayflow-local-preview/postgres-data/`
- **Thông tin login:** `.artifacts/dayflow-local-preview/LOGIN-LOCAL-ONLY.txt` (giữ bí mật)
- **Screenshots sau smoke test:** `.artifacts/dayflow-local-preview/DAYFLOW_CALENDAR_DESKTOP.png` và `DAYFLOW_CALENDAR_MOBILE.png`
- **Cấu hình demo local:** `.artifacts/dayflow-local-preview/local-secrets.json` (giữ bí mật)

API và PostgreSQL được bind trên `127.0.0.1`; PostgreSQL dùng cổng `55434`, Vite preview web dùng `5180` và API chọn cổng loopback nội bộ tự động. Cả server và owner DB **không đọc** `DATABASE_URL` bên ngoài. Chương trình chủ động từ chối chạy nếu có `DATABASE_URL` ngoại lai hoặc `NODE_ENV=production`.

Sau khi dừng bằng Ctrl+C, script đóng web/API, ngắt kết nối và dừng PostgreSQL an toàn. Dữ liệu demo được giữ lại. Không xóa hay copy `.artifacts` khi chưa hiểu rủi ro: ở đó có database và mật khẩu demo.

## 4. Tự kiểm chứng

Từ CMD tại `D:\projects\dayflow`:

```bat
npm run demo:smoke
```

Smoke test dựng **production build** và database local, đăng nhập account test, xác minh dữ liệu mẫu tiếng Việt, tạo việc và đọc được từ PostgreSQL sau reload, thử Calendar desktop/mobile, Settings, chụp screenshot; rồi dừng đúng PostgreSQL. Chạy lại một lần nữa sẽ xác nhận cluster đã được **tái sử dụng**, không xóa công việc demo.

**Kiểm chứng gói ZIP độc lập:** đã giải nén ZIP vào thư mục kiểm thử mới, chạy `npm ci`, cài riêng PostgreSQL 17 test package rồi chạy `npm run demo:smoke` ngay trong thư mục giải nén. Build/đăng nhập/UTF-8/data persistence/Calendar/Settings/sandbox stop **PASS** trên cùng máy Windows. Đây là kiểm thử bản portable thực tế, không phải lời hứa tương thích mọi máy hay release production.

Kiểm thử repo đầy đủ:

```bat
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser:g6g8:postgres:local
npm run test:browser:g7:postgres:local
npm run test:browser:g7:pwa:local
npm audit --omit=dev --audit-level=moderate
git diff --check
```

**Không chạy `demo:smoke` khi phiên `demo:local` đang mở**, vì cùng dùng cổng/dữ liệu. Chương trình kiểm tra cổng trước; nếu có tiến trình khác, nó sẽ báo lỗi mà không dừng hoặc ghi đè dịch vụ khác.

## 5. Bảo mật và ranh giới sử dụng

1. Đây là **bản duyệt/chạy local**, không phải release staging/production. PostgreSQL cục bộ dùng credential test lưu dưới thư mục ignored; không sao chép tới môi trường thật.
2. G7 vẫn không cung cấp cơ chế xác thực lại an toàn khi mở ứng dụng hoàn toàn offline sau khi tắt trình duyệt. Khi không có kết nối để xác thực, PWA chỉ mở shell và yêu cầu đăng nhập; dữ liệu riêng không được hiện công khai.
3. PostgreSQL **demo data persistence** không thay thế quy trình backup mã hóa ngoài máy chủ. G8 off-host backup/restore drill chưa đạt; G1-A khóa SSH root cũ và G1-C dev/prod isolation chưa đạt.
4. Các bước thao tác production/SSH/firewall/secrets/migrations/đẩy `main` cần phê duyệt riêng; bộ local này không thực hiện chúng.
5. Các thay đổi ứng dụng vẫn ở `feat/g5-online-sync` trên ổ D, **chưa commit/push**. Không dùng GitHub cũ để ghi đè lên checkout.

## 6. Nếu gặp lỗi

- **Node/npm không nhận:** cài Node.js >=22.12, mở CMD mới và chạy file bat.
- **Cổng đã được sử dụng:** đóng đúng phiên DayFlow demo đang mở rồi thử lại; script không kill các process lạ.
- **Mở trang nhưng API không kết nối:** kiểm tra cửa sổ CMD có thông báo `DAYFLOW_LOCAL_PREVIEW_READY=PASS` không, đồng thời xác minh `http://127.0.0.1:5180/api/health` chỉ trả dữ liệu health công khai.
- **Không đăng nhập được:** sử dụng đúng file `LOGIN-LOCAL-ONLY.txt` được tạo sau lần chạy đầu. Không dùng credential production.
- **Thấy lỗi mã hóa tiếng Việt:** script hiện cưỡng chế PostgreSQL UTF8; database cũ có bảng mã khác sẽ bị từ chối và **không tự xóa/convert** để bảo vệ dữ liệu.
- **Quên mật khẩu hoặc muốn reset dữ liệu demo:** không xóa `.artifacts` tự động. Trước tiên sao lưu thư mục local preview; chỉ thực hiện reset sau khi xác nhận không cần dữ liệu cũ.

## 7. Staging Linux đã triển khai riêng

Ngoài bản chạy trên Windows, DayFlow đã có **staging Linux dùng PostgreSQL riêng**, chỉ bind 127.0.0.1 trên máy chủ và truy cập từ Windows bằng SSH tunnel tại `http://127.0.0.1:5183`. File tunnel và thông tin đăng nhập test chỉ nằm trong `.artifacts/deploy/` bị Git ignore. Biên bản, kiểm thử Chrome, restart và các hạn chế ở `docs/DAYFLOW_LINUX_STAGING_20261013.md`. Không nhầm staging nội bộ này với website production công khai.

## 8. Điều kiện để bước tiếp theo trở thành bản phát hành

Kiểm tra chất lượng G6 DST/accessibility, G7 quota/eviction/cold-offline security, G8 offsite encrypted backup + restore, G1 SSH/isolation, PR/CI và G9 staging/TLS/monitoring/rollback; Gate cần người vận hành nghiệm thu.

Hồ sơ trạng thái: `.chatgpt/STATE.md`, `docs/V2_ACTIVE_MASTER_PLAN_20261013.md`, `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`.
