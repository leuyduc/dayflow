# DayFlow V2 — Quy trình và điểm chặn G8 PostgreSQL Backup/Restore trên Linux staging

Ngày: 2026-10-13. Trạng thái: **KẾ HOẠCH CÓ BẰNG CHỨNG PRECHECK, CHƯA THỰC HIỆN PHỤC HỒI DB**.
Điểm vào: `D:\projects\dayflow\.chatgpt\STATE.md`. Linux private staging chỉ chạy dưới `dayflow-dev`; không tác động production.

## Hiện trạng đo được, KHÔNG suy đoán

- DayFlow Linux staging ở `127.0.0.1:5183` với PostgreSQL 17 staging riêng tại `127.0.0.1:55435`, database tên `dayflow_test_local_preview`, dữ liệu PostgreSQL private trong `$HOME/dayflow-staging/shared/artifacts/`. Không mở public.
- SSH bằng tài khoản không đặc quyền `dayflow-dev`; dữ liệu/credential demo riêng, không nằm trong repo, chưa dùng account/database production.
- Bộ @embedded-postgres/linux-x64 có **initdb, pg_ctl, postgres**, nhưng **không có pg_dump hoặc pg_restore**.
- Lệnh `pg_dump` trên máy Ubuntu là **14.24**; `postgresql-client-17` **không có trong APT cache hiện tại**. PostgreSQL chính thức yêu cầu dùng `pg_dump` không cũ hơn major version server. Không sử dụng bản 14 để backup PG17.
- Test Chrome qua tunnel: **G8 JSON export có settings, file version1 và dữ liệu tiếng Việt PASS**. Đây là backup ở cấp ứng dụng, không phải backup toàn bộ PostgreSQL.
- User systemd đang ở trạng thái `degraded`, và `loginctl show-user dayflow-dev -p Linger` là `no`. Không có xác nhận auto-start sau reboot, không tự bật user lingering.

Nguồn tham khảo chính thức:
- https://www.postgresql.org/docs/17/app-pgdump.html
- https://www.postgresql.org/download/linux/ubuntu/
- https://wiki.postgresql.org/wiki/Apt

## Trình tự đề xuất để làm DR drill thật sự

### 1. Chuẩn bị client PostgreSQL 17 KHÔNG can thiệp production

- Chọn client `pg_dump` và `pg_restore` **major 17** từ bản phát hành PostgreSQL/PGDG được xác thực bằng package signature và checksum.
- Ưu tiên công cụ tự chứa chạy dưới `$HOME/dayflow-staging/tools/`, không dùng `sudo apt install` trên máy Linux chung khi chưa có phép bảo trì riêng.
- Kiểm tra `pg_dump --version`, `pg_restore --version`, `ldd` và chính sách runtime trước khi dùng. Không lấy binary từ các thư mục hoặc container production.
- Nếu thiếu client hợp lệ: đánh dấu **BLOCKED**, không thay bằng SQL export thủ công rồi gọi đó là PostgreSQL DR.

### 2. Backup staging an toàn

- Xác minh host=127.0.0.1, port=55435, `dayflow_test_local_preview`, owner user staging; từ chối endpoint/DB khác.
- `pg_dump --format=custom --no-owner --no-acl` lấy snapshot nhất quán, không khóa lâu database production. **Không đưa mật khẩu vào command line, Git, log hoặc môi trường không bảo vệ.**
- Ghi archive vào private folder mode 0700, file 0600. Kiểm tra exit code, archive size, SHA-256 và `pg_restore --list` không in các giá trị nghiệp vụ.
- Mã hóa ngay bằng GPG/age với khóa độc lập quản lý ngoài host, sau đó chuyển ciphertext qua kết nối bảo mật đến kho backup ngoài host đã được phê duyệt. Khóa giải mã phải được phục hồi được khi host bị mất; không giữ duy nhất trên host được backup.
- Không dùng SQLite, JSON export ứng dụng, hoặc copy thư mục PostgreSQL **khi DB đang chạy** làm bằng chứng cho DR cấp database.

### 3. Restore drill vào database test mới

- Chỉ dùng DB đích tên `dayflow_test_dr_<ngẫu_nhiên>`, quyền owner dev riêng và cổng loopback; không có `--clean` trên database gốc.
- Giải mã vào thư mục private tạm; tạo DB scratch mới; restore với `pg_restore --no-owner --no-privileges --exit-on-error --single-transaction` và kiểm tra exit status.
- So sánh schema migration, bảng, tổng users/tasks/settings/sessions/sync log/mutations, checksum giá trị đã chuẩn hóa và bản ghi UTF-8 tiếng Việt. Tuyệt đối không xuất dữ liệu cá nhân/credential hash ra log.
- Test đăng nhập qua API scratch tách biệt nếu đủ điều kiện; không đưa scratch database vào route staging đang hoạt động.
- Thu hồi scratch DB đúng tên ngẫu nhiên sau khi kiểm chứng và sau khi xác nhận không được ứng dụng nào sử dụng. Giữ ciphertext + checksum và hồ sơ restore theo chính sách retention đã duyệt; không giữ plaintext.

### 4. Điều kiện đóng G8 và trước production

- Có **lịch backup tự động**, cảnh báo lỗi/thiếu backup, rotation/retention, theo dõi dung lượng, nơi lưu off-host, người quản lý khóa độc lập, kiểm thử khôi phục định kỳ.
- Đo và chốt RPO/RTO theo nhu cầu vận hành; test khôi phục hoàn chỉnh từ ciphertext **lấy lại từ kho ngoài máy chủ**, không chỉ file cùng host.
- Có thử nghiệm rollback migration, staging isolate, kiểm tra ownership và quyền truy cập; ký nghiệm thu G8.
- G1-A khóa root cũ và G1-C dev/prod isolation vẫn **NOT PASSED**; ngay cả khi DR drill đạt, không tự public DayFlow.
- Chỉ tiến hành cài client hệ thống, cron, off-host storage credential, firewall, public Nginx/TLS và production rollout khi có phê duyệt riêng.

## Việc đã làm trong phiên

1. Kiểm tra version PG và client, thư viện native, user systemd và loopback health: **PASS**.
2. Chạy lại Chrome real E2E staging gồm G8 JSON export với Settings: **PASS**.
3. Chuẩn bị `scripts/dayflow-staging-ops.sh` cho start/status/stop có PID guard; `sh -n` tại Windows: **PASS**.
4. **Chưa cài ops script lên Linux** vì thao tác remote chuẩn bị thư mục bị công cụ từ chối. Staging hiện vẫn chạy bằng quy trình nohup đã kiểm chứng; script local không được coi là đang active.
5. **Chưa làm pg_dump/restore thật** vì thiếu client17. Không có thay đổi SSH/root/apt/production.
