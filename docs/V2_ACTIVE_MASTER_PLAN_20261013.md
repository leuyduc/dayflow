# DAYFLOW V2 — KẾ HOẠCH TỔNG THỂ ĐANG ÁP DỤNG

Cập nhật: 2026-10-13 (Asia/Bangkok)
Trạng thái: Kế hoạch thực thi dựa trên bằng chứng QA local và feature commit GitHub đã push; **không phải nghiệm thu Gate hoặc phê duyệt production**.
Mục đích: lộ trình thực thi thực tế từ hiện trạng code trên Windows đến nghiệm thu và phát hành an toàn.
Thư mục làm việc duy nhất: `D:\projects\dayflow`.
Git: nhánh `feat/g5-online-sync` đã đẩy code G6/G7/G8 và host allowlist lên GitHub tại feature commit `a10afb6`. Đọc `git rev-parse HEAD` và remote ref để biết SHA hiện tại; **không merge `main`**.
Điểm khôi phục luôn phải đọc trước: `.chatgpt/STATE.md`. Sau đó xem JOURNAL/LESSONS và Git thực tế.
Tài liệu này **bổ sung/cập nhật phần trạng thái và quy trình** của `V2_MASTER_PLAN.md` bản 2026-10-12. Quy tắc sản phẩm, đồng bộ, dữ liệu và an toàn trong các tài liệu V2 gốc vẫn có hiệu lực, trừ những chỗ bị chỉ thị vận hành mới thay thế.

## 1. Đích đến và phạm vi MVP

DayFlow V2 là công cụ kế hoạch cá nhân responsive trên desktop/mobile: một tài khoản chủ sở hữu, login/session an toàn, công việc/subtasks/tags/deadline/duration/priorities, Today/Inbox/lọc/tìm, lịch ngày-tuần-tháng, gợi ý kế hoạch có giải thích và chỉ lưu khi được chấp nhận, đồng bộ đa thiết bị, tạo/sửa/xóa offline theo outbox, settings, JSON import/export, dữ liệu PostgreSQL có khôi phục thảm họa.

Kiến trúc: React/Vite/TypeScript web; Fastify/Zod API; PostgreSQL/Drizzle là nguồn dữ liệu chính; Dexie/IndexedDB theo owner chứa cache và hàng đợi mutation có ID cố định; PWA service worker chỉ cache tài sản công khai. Không nhúng AI vào sản phẩm, không signup công khai, collaboration, billing, tích hợp calendar ngoài hay recurrence phức tạp trong MVP.

**Cách triển khai thay thế tài liệu cũ:** ChatGPT trực tiếp code/QA qua Windows MCP; không chuyển cho Muse/OpenCode/DS. Windows là nơi phát triển hiện hành. Linux production không được dùng làm môi trường thử nghiệm hay cho agent thực thi khi G1 chưa đạt.

## 2. Tình trạng Gate đã xác minh

| Gate | Hiện trạng kỹ thuật | Điều kiện còn thiếu để đóng Gate |
|---|---|---|
| G0 — Kiểm toán | AUDITED theo hồ sơ 2026-10-12 | Giữ hồ sơ audit; không tự coi audit cũ là kiểm tra hôm nay |
| G1 — Phân quyền, SSH, cách ly | **NOT PASSED**: G1-A khóa root cũ lộ; G1-C không cô lập dev khỏi host loopback/private services | Xoay/thu hồi khóa sau khi bảo đảm phương án recovery; phân vùng dev/prod và thực hiện negative tests; ký nghiệm thu |
| G2 — Full-stack nền tảng | Code, lệnh test, health, monorepo tồn tại; QA local PASS | Đối chiếu tiêu chí Gate và review commit/CI |
| G3 — Auth, DB, ownership | Code login, CSRF, Argon2id, owner scoping, migration và nhiều kiểm thử | Formal review tiêu chí bảo mật và staging DB |
| G4 — Quản lý công việc | Code CRUD/UI; ghi nhận chấp thuận kỹ thuật lịch sử `655d15e` | Bảo toàn acceptance và regression sau tích hợp |
| G5 — Đồng bộ online | Code revision, tombstone, change cursor, idempotency và xung đột qua `2cae801` | Kiểm chứng CI/PR của các thay đổi mới, review owner isolation |
| G6 — Calendar + scheduler | Code và Chrome→Fastify→PostgreSQL E2E local PASS | DST/timezone/deadline edge cases, accessibility + human Gate acceptance |
| G7 — Offline queue + PWA | Code Dexie owner-scoped create/update/delete (kể cả **online** form, status, xóa) có persist-before-send; real Chrome E2E PASS; static PWA offline shell PASS | Cold-offline xác thực chủ sở hữu an toàn, quota/eviction/crash, privacy/security review, human acceptance |
| G8 — Settings, JSON import/export và DR | Settings/JSON transactional + real Chrome/PostgreSQL E2E PASS | Encrypted off-host DB backup, restore drill xác thực record, operator acceptance |
| G9 — Public staging/production release | **NOT STARTED / BLOCKED** | Đã deploy **staging nội bộ loopback-only trên Linux** và Chrome E2E PASS ngày 13/10; chưa mở domain/TLS, chưa đạt G1/G8/CI/monitoring/rollback, chưa được nghiệm thu public release. Xem `docs/DAYFLOW_LINUX_STAGING_20261013.md` |

**Bằng chứng hiện hành, không phải Gate sign-off:** lần chạy tổng hợp 2026-10-13 đạt `103/103` unit tests trong 17 file; Prettier, ESLint, TypeScript, build, Chrome/PostgreSQL G6/G7/G8, PWA shell offline, production-only npm audit và `git diff --check` PASS. Hai PostgreSQL sandbox localhost đã dừng. Đã push code lên **nhánh feature** GitHub; CI cho exact SHA cần kiểm tra độc lập. `main` chưa thay đổi. Full `npm audit` còn 7 cảnh báo dependency phát triển (2 critical, 5 moderate); không `npm audit fix --force` nếu chưa kiểm chứng bản tương thích.

Hồ sơ QA: `docs/V2_G6_G8_LOCAL_E2E_20261013.md`, `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`.

## 3. Luồng công việc ưu tiên, không lặp lại Gate đã code

Các pha A–E bên dưới là **thứ tự ưu tiên và mối phụ thuộc**, không phải cam kết thời lượng hay cho phép triển khai production.

### Pha A — Đóng gói hiện trạng local và chứng cứ nguồn (làm đầu tiên)

- So sánh `git diff`, file tracked/untracked và phạm vi mỗi Gate; review dữ liệu nhạy cảm trước khi đưa vào Git. Không reset `D:\projects\dayflow` bằng GitHub/ổ C.
- Đồng bộ STATE, JOURNAL, LESSONS, active plan và evidence; cập nhật thông tin sai lệch trong tài liệu master cũ (không xóa lịch sử).
- Chạy chuỗi QA local đầy đủ từ worktree thật. Chia phần đã làm thành commit/PR nhỏ **chỉ khi người dùng cho phép commit/push**; review CI theo exact SHA sau push.
- Đầu ra: working tree có thể khôi phục, bản diff được kiểm tra, bằng chứng QA có thể chạy lại, không thay đổi `main` hoặc Linux.

### Pha B — Chốt chất lượng ứng dụng G6/G7 và chính sách dữ liệu offline (code/test local được phép)

- G6: kiểm tra DST (giờ không tồn tại/lặp), chuyển timezone/working days, hạn hoàn thành khác giờ scheduled, buffer và collision dưới cạnh tranh, keyboard/mobile/accessibility.
- G7: quota full/IndexedDB write failure, storage eviction, kill/restart Chrome, hai tab cùng thao tác, mất phản hồi sau COMMIT, API 401/403, logout/login tài khoản khác, request race và giữ draft conflict. Không xóa outbox trên lỗi hay đăng xuất.
- **Quyết định bảo mật G7:** mặc định giữ *login-gated cold offline*: PWA shell có thể mở offline nhưng không hiện nội dung owner khi chưa xác thực. Muốn xem/sửa dữ liệu sau cold restart offline cần đặc tả riêng cơ chế unlock thiết bị + mã hóa/kiểm thử dữ liệu at rest, recovery và quyền truy cập tài khoản. Không triển khai giải pháp giả bằng localStorage token hoặc hiển thị cache plaintext.
- Đầu ra: ma trận QA bổ sung, lỗi được sửa, kịch bản regression Chrome/IndexedDB/PostgreSQL có bằng chứng, lựa chọn offline được người dùng chốt. G7 chỉ được đề xuất nghiệm thu sau đủ tiêu chí.

### Pha C — Dữ liệu và khôi phục G8 (local trước, máy chủ sau phê duyệt)

- Khóa contract backup JSON: versioning, file-size/schema validation, preview merge/duplicate, all-or-nothing import, settings consistency, owner isolation, đồng bộ delta sau import.
- Dựng diễn tập `pg_dump`/restore trong **sandbox development/test riêng** với dữ liệu giả, đối chiếu số bản ghi, checksum/migration, quyền user và quy trình phục hồi.
- Phần **off-host encrypted backups**: xác định nơi lưu, chính sách lưu/rotation/retention, mã hóa và quyền truy cập khóa, lịch tự động, failure alerts, RPO/RTO, diễn tập restore ra môi trường tách biệt. Chỉ cấu hình trên máy chủ sau khi được duyệt riêng.
- Đầu ra: runbook khôi phục và bằng chứng DR thực nghiệm; JSON export không được xem là thay thế DB backup.

### Pha D — G1 bảo mật hạ tầng (khóa cứng trước staging/prod)

- G1-A: kiểm tra khóa SSH root cũ đã lộ, xác thực khóa admin thay thế/console rollback, rồi thu hồi cũ bằng kế hoạch được duyệt. Không làm gián đoạn đường khôi phục SSH.
- G1-C: môi trường dev tách khỏi production; ưu tiên VM/host riêng hoặc sandbox đã đo kiểm filesystem/mount/network/egress, deny loopback/private/prod ports và không có sudo/root/Docker socket, prod env, DB/backup hay deploy keys.
- Thực thi negative tests dưới quyền dev và xác minh logging, resource limits, cập nhật trạng thái dịch vụ hiện hữu; không suy diễn phân tách an toàn chỉ từ tài khoản Unix khác tên.
- **Không còn G1-D Muse/OpenCode deployment:** chỉ thị mới là ChatGPT code trực tiếp trên Windows MCP, không cài lại coding agent; xóa các đầu việc agent lỗi thời khỏi điều kiện phát hành nhưng giữ yêu cầu cách ly dev/prod.
- Đầu ra: biên bản G1-A/G1-C và operator sign-off. Phải có **ủy quyền cụ thể riêng** trước khi sửa máy Linux, SSH, firewall, container hoặc production.

### Pha E — CI, staging, nghiệm thu và G9 release (phụ thuộc các Gate)

- Sau phép commit/push: CI chạy format, lint, strict TypeScript, unit/integration, build, secret/dependency scan, E2E với PostgreSQL test; xác minh đúng SHA, không đánh giá CI từ mã dirty local.
- Tạo staging tách mạng/DB/secrets/volumes và cấu hình URL/TLS/cookie/proxy hợp lệ, kiểm tra ownership, CSRF, rate limits, PWA/caching, a11y/responsive, load/resource headroom, logs/alerts, DB migrations và sức khỏe dịch vụ.
- Kiểm chứng cron backup mã hóa, storage ngoài máy chủ và test restore, xác nhận dự phòng/rollback, tài liệu runbook, monitoring, sự cố và phát hành an toàn. Không chứa dữ liệu production trong test.
- Chỉ sau khi **G1 đạt, G8 DR đạt, QA/CI/staging đạt và người dùng phê duyệt**, mới chạy controlled production deployment. `main`, production DB, firewall/DNS, TLS, migration và phát hành là hành động có Gate riêng; ChatGPT không tự mở Gate G9.
- Đầu ra: release candidate được nghiệm thu trên staging, checklist có người ký, kết quả smoke sau deploy và khả năng rollback.

## 4. Hai luồng có thể làm song song

| Luồng có thể làm local ngay | Phụ thuộc phê duyệt/hạ tầng |
|---|---|
| Rà soát/đóng gói code, chuẩn hóa hồ sơ, CI scripts | Commit/push, PR, branch protection trên GitHub |
| G6 DST, deadline, accessibility, mobile QA | Nghiệm thu Gate G6 |
| G7 quota/eviction/crash/reconnect/failure injection, security design | Quyết định offline cold-unlock + chấp thuận Gate G7 |
| G8 JSON validations và DB restore drill trong sandbox giả lập | Off-host encrypted production backup/restore, RPO/RTO |
| Dependency dev advisories: đánh giá tương thích và nâng cấp scoped | Chấp thuận nâng cấp breaking và CI |
| G1 bản thiết kế isolation/SSH change plan, read-only review | Bất kỳ thao tác thực trên Linux/prod, xoay khóa, hạ tầng |
| Tạo checklist G9, staging design/runbook | Staging và production release |

Không sử dụng việc G6/G7/G8 local code đã có để bỏ qua G1 hoặc khâu khôi phục G8 khi phát hành.

## 5. Định nghĩa mức hoàn thành

**Local feature-ready:** source kiểm soát được; QA command/Chrome/PostgreSQL E2E xanh; chứng cứ trong `docs`; known issues rõ; Git/STATE/JOURNAL đọc lại thành công. Đây là mốc hiện đã đạt cho nhiều ca của G6/G7/G8, **chưa đóng Gate**.

**Staging-ready:** có approved commit/CI SHA, review quyền truy cập/dữ liệu offline, DR backup+restore thành công, G1 security isolation đạt, staging riêng và runbook vận hành. Chưa đạt.

**Production-ready:** staging nghiệm thu, RPO/RTO, encryption/restore monitoring, TLS, deploy/migration/rollback/smoke tests, accessibility, security sign-off, Gate G9 và phê duyệt phát hành của người dùng. Chưa đạt.

## 6. Lệnh nghiệm thu kỹ thuật local hiện hành

```sh
cd D:\projects\dayflow
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
git status --short --branch
```

Các lệnh browser/PostgreSQL chỉ dùng database tạm `dayflow_test_*`, loopback, credential sinh tạm; cần kiểm tra môi trường trước mỗi lần chạy. Không dùng production `DATABASE_URL` và không đưa secrets vào logs.

## 7. Luật tự động tiếp tục và chống mất context

1. **BEFORE:** dùng Desktop Commander MCP đọc `D:\projects\dayflow\.chatgpt\STATE.md`, đối chiếu `git status`/HEAD/remote, đọc JOURNAL/LESSONS và spec liên quan. Không dựa vào cache chat hay tài liệu design cũ.
2. **EXECUTE:** ChatGPT trực tiếp thực thi lát cắt nhỏ, không bàn giao cho Muse/OpenCode/DS, không sửa thư mục clone ổ C, không reset code chưa commit.
3. **TEST:** ghi chính xác PASS/FAIL/BLOCKED từ lệnh đã chạy. Nếu test fail, sửa và chạy lại; không giả vờ đã nghiệm thu.
4. **CHECKPOINT:** ghi STATE cho mọi G0–G9, append JOURNAL, LESSONS khi có phát hiện mới; sau đó **READ BACK** checkpoint và HEAD trước bước khác.
5. **GATE:** commit/push, merge main, staging/prod, server/SSH/DNS/firewall/secrets/DB thao tác thật và Gate acceptance chỉ sau chấp thuận tương ứng; không tự suy diễn từ “autorun”.

## 8. Quyết định cần chốt và thứ tự thực thi kế tiếp

- **Ưu tiên mặc định ngay:** Pha A → Pha B: bảo toàn/local code và làm thêm QA cho quota/eviction, app restart/session/privacy, DST + accessibility; ghi kết quả.
- **Quyết định về cold offline:** (A) chỉ hỗ trợ chỉnh offline khi tab đã đăng nhập và giữ tính riêng tư khi khởi động lại offline; hoặc (B) xây dựng offline vault với local unlock và encrypted-at-rest, phân tích threat model và recovery. Không tự kích hoạt B khi chưa được duyệt.
- **Trước staging/production:** phê duyệt phương án G1-A SSH key rotation và G1-C VM/host isolation, off-host backup storage/encryption, retention/RPO/RTO, sau đó Gate G9.
- **Git:** code còn dirty ở `feat/g5-online-sync`; cần review diff và explicit permission trước commit/push/PR. Không chạm `main` cho tới quyết định release.

Tài liệu bổ trợ: `.chatgpt/STATE.md`, `.chatgpt/JOURNAL.md`, `docs/V2_IMPLEMENTATION_PLAN.md`, `docs/V2_SYNC_PROTOCOL.md`, `docs/V2_INFRA_SECURITY.md`, `docs/V2_G1C_ISOLATION_AUDIT.md`, `docs/V2_G6_G8_LOCAL_E2E_20261013.md`, `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`.
