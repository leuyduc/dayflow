# DayFlow V2 — Biên bản tiến độ và bàn giao context

**Ngày đối chiếu:** 2026-10-12 (Asia/Bangkok)  
**Repository:** [leuyduc/dayflow](https://github.com/leuyduc/dayflow)  
**Trạng thái:** Biên bản xác minh GitHub; **không phải nghiệm thu G5 hoặc giấy phép triển khai production**.  
**Workflow đang áp dụng:** ChatGPT tự thực hiện kế hoạch, code, QA và GitHub; OpenCode/Muse không còn tham gia. Sau **mỗi bước công việc độc lập**, phải đọc lại GitHub STATE + code HEAD, ghi STATE/JOURNAL, rồi đọc lại bản ghi vừa commit trước khi thực hiện bước kế tiếp. Quy trình: `docs/CHATGPT_EXECUTION_PROTOCOL.md`.

## 1. Nguồn sự thật / trạng thái Git đã xác minh

| Mục | Nhánh / tài liệu | Commit/SHA đã xác minh |
|---|---|---|
| Thiết kế + checkpoint | `design/linux-fullstack-v2` | `03cdee6d41d590698ae642864d611fd787a42c82` trước khi lập biên bản |
| Nền tảng G2 | `feat/fullstack-foundation` | `920fa74cf5ce50a8f20ffd25f8768978e0cff891` |
| Xác thực/database G3 | `feat/g3-auth-db` | `a3074d912ee93bd69e756bb1b943127ea9ddcdfc` |
| Task CRUD G4 | `feat/g4-task-crud` | `655d15ee851c965eb1b3483fc8c4fed5cc021c0c` |
| Đồng bộ online G5 | `feat/g5-online-sync` | **`2cae8015f69718bbaa857c9b0affff18f4c45d7c`** |
| Nhánh mặc định | `main` | `c8a0932c844a8b00c45c399e629bf88a1d1a71cb` (chưa merge code dự án) |

- [PR #1](https://github.com/leuyduc/dayflow/pull/1): G4 vào G3, **DRAFT/OPEN/UNMERGED**. Nội dung PR có câu chữ cũ về nghiệm thu G4, nhưng checkpoint và quyết định người dùng xác nhận **G4 đã nghiệm thu kỹ thuật**; không xem việc nghiệm thu kỹ thuật là quyền merge.
- [PR #2](https://github.com/leuyduc/dayflow/pull/2): G5 vào G4, head **`2cae8015...`**, **DRAFT/OPEN/UNMERGED**; **chưa có nghiệm thu Gate G5**.

## 2. Toàn bộ Gate G0–G9

| Gate | Phạm vi | Trạng thái được chứng thực |
|---|---|---|
| G0 | Khảo sát Linux, tài nguyên, các dịch vụ đang chạy | **AUDITED** |
| G1 | Bảo mật SSH/quyền, tách vùng dev/production | **NOT PASSED**. G1-A key root cũ chưa thu hồi; G1-B user hạn chế chỉ đạt một phần; G1-C cô lập mạng thất bại; G1-E chưa hoàn tất. G1-D OpenCode/Muse **RETIRED**, không tính PASS |
| G2 | Monorepo React/Fastify/domain/contracts, nền tảng CI | QA Windows + browser + CI đạt; **Gate chưa được nghiệm thu chính thức** |
| G3 | Owner auth, session, CSRF/Origin, PostgreSQL/Drizzle | **Đã nghiệm thu kỹ thuật**; không cấp quyền production |
| G4 | Task API/UI, CRUD, revision/tombstone | **Đã nghiệm thu kỹ thuật**; CI 3/3 PASS, PR chưa merge |
| G5 | Đồng bộ hai thiết bị online | **Đã có code, Windows QA + CI PASS; CHƯA NGHIỆM THU Gate** |
| G6 | Calendar day/week/month + deterministic scheduling | NOT STARTED |
| G7 | Offline cache/outbox, PWA, recovery | NOT STARTED |
| G8 | Settings, JSON import/export, off-host DB backups/restore | NOT STARTED |
| G9 | Staging, kiểm toán release, production rollout/rollback | NOT STARTED |

## 3. Những gì đã làm được ở G5

**Backend và dữ liệu:** Drizzle/PostgreSQL có `sync_state`, `change_log`, `processed_mutations`; mọi task write dùng chung giao dịch lock từng owner để đảm bảo cursor phản ánh thứ tự commit, chống áp dụng lại mutation UUID, hỗ trợ owner scope, `expectedRevision`, conflict và tombstone.

**API:** `POST /api/sync/push`, `GET /api/sync/bootstrap`, `GET /api/sync/pull?cursor=N`; đăng nhập theo session, kiểm tra Origin + CSRF trên writes, cursor theo owner, phân trang và xử lý cursor không hợp lệ.

**React online:** Tải snapshot+cursor lúc mở, sau đó pull delta khi focus, tab visible, reconnect, định kỳ và nút **Đồng bộ ngay**; phân trang 100 bản ghi, thêm/sửa/xóa theo tombstone, phản hồi 409 chuyển sang bootstrap. Pull lỗi không được xoá danh sách hoặc đánh dấu đã đồng bộ.

**Xử lý conflict edit:** Giữ nội dung chưa lưu của người dùng, hiển thị server version, cho chọn bản máy chủ hoặc gửi **mutation UUID mới** để áp dụng bản của mình lên phiên bản mới. Không tự động last-writer-wins.

**Hai trình duyệt thật:** Hai Chrome context độc lập đăng nhập cùng owner trên PostgreSQL test; thiết bị B thắng trước, A chọn giữ server thì SQL vẫn revision 2; lần khác A xác nhận ghi bản của mình sau conflict và SQL đạt revision 4. Đây là test thật qua Chrome → Fastify → PostgreSQL, không phải mock UI.

## 4. Bằng chứng CI — đúng commit G5 cuối

SHA: `2cae8015f69718bbaa857c9b0affff18f4c45d7c`

- [GitHub Actions push #38199682438](https://github.com/leuyduc/dayflow/actions/runs/38199682438): **completed / success, 3/3 jobs PASS**.
- [GitHub Actions PR #38199686885](https://github.com/leuyduc/dayflow/actions/runs/38199686885): **completed / success, 3/3 jobs PASS**.
- Mỗi run gồm `checks` (typecheck, lint, **32/32 Vitest**, build, format), `online-sync-postgres-integration` (PostgreSQL 17 A/B, cursor/idempotency) và `g4-browser-postgres-e2e` (Chrome thật, gồm hai trình duyệt xử lý conflict).

**Lưu ý:** CI PASS chỉ xác nhận các kịch bản đã thử; không thay thế phê duyệt của người dùng hay đánh giá bảo mật production.

## 5. Chưa hoàn thành / giới hạn quan trọng

- **G5:** UI xử lý conflict của complete/reopen/delete cần mở rộng; đánh giá cursor retention/expiry, race khi pull đồng thời, tải lớn và các ca phục hồi bổ sung trước khi đề xuất nghiệm thu cuối.
- **G7:** Không có durable offline outbox; chưa thể tuyên bố chỉnh sửa offline an toàn.
- **G1:** Old root SSH public key chưa thu hồi; tài khoản dev tiếp cận được một số socket localhost; chưa chứng minh được cô lập khỏi production; khóa admin/root cần tách khỏi công cụ tự động. Không thực thi lệnh deploy/cấu hình máy chủ ngoài phạm vi đã phê duyệt.
- `main` chưa chứa ứng dụng; các nhánh feature và PR chưa được merge. Không có bản triển khai cá nhân/production được xác minh trong biên bản này.
- Một số tài liệu lịch sử/G5 progress vẫn chứa kết quả ở commit cũ; **ưu tiên checkpoint mới nhất + live GitHub HEAD/CI**, không dùng dòng kết quả cũ để nâng trạng thái.

## 6. Điểm bắt đầu an toàn cho phiên ChatGPT tiếp theo

1. **Trước công việc:** đọc `.chatgpt/STATE.md` mới nhất từ nhánh `design/linux-fullstack-v2`, `docs/CHATGPT_EXECUTION_PROTOCOL.md`, phần gần nhất của JOURNAL/LESSONS; xác minh HEAD thực tế của `feat/g5-online-sync` và PR #2, cùng CI đúng SHA.
2. **Bước phát triển kế tiếp có thể thực hiện trong quyền Windows G5 đã cấp:** review/cải thiện UI conflict cho complete/reopen/delete, thêm kiểm thử race + không mất dữ liệu. Không mở G6/G7 hay thao tác Linux/production nếu chưa có phạm vi mới.
3. Chạy kiểm thử thật, kiểm tra diff và CI, ghi STATE + append JOURNAL, **read-back hai nơi trước bước tiếp theo**.
4. Khi tất cả tiêu chí G5 đạt, báo người dùng nghiệm thu Gate riêng. Không tự đóng Gate, merge PR hay deploy.

**Nguyên tắc:** ChatGPT tự thực hiện; GitHub lưu context bền vững; các quyết định Gate và production vẫn do người dùng phê duyệt. Không lưu password, SSH key, access token, dữ liệu riêng tư hay chi tiết hạ tầng nhạy cảm trong public repo.
