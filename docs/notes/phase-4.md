# Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0": ghi chép

## 1. Acceptance criteria

| Mục | Tiêu chí kiểm chứng được | Bằng chứng |
|---|---|---|
| Bench | `node tools/bench.js --seed 42 --duration 30 --out bench.json`; cảnh chuẩn (200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng với dầu 100, camera r = 30, Y = 15, bắt đầu ở (30,15,0), ngược chiều kim đồng hồ, 15 s một vòng); 3 s khởi động rồi đo đúng `duration`; output đủ trường; đạt avg ≥ 60, p1 low ≥ 30, load ≤ 10000 ms | [bench.json](../../bench.json), unit `bench scene…`, `bench camera…`, `frame stats…` |
| Soak | 10 Đêm trong 1 tiến trình, xoay vòng 1→2→3, seed 7 + i, input ngẫu nhiên theo xác suất của ticket; `crashes = 0`; `mem_end ≤ 1.2 × mem_start` | [soak.json](../../soak.json), unit `soak runner…`, [soak-memprobe.txt](../proof/phase-4/soak-memprobe.txt) |
| Bảng xếp hạng | Nhập tên sau Bình Minh hoặc khi thua; tên 3–12 `[A-Za-z0-9_]` (nhận cả tiếng Việt); mục gồm name, score, nights_won, achieved_at (ISO có múi giờ), seed; top 10; sắp xếp điểm giảm dần, bằng điểm thì ai đạt trước đứng trên; lưu trên đĩa; có màn hình từ menu; có lệnh `--export-leaderboard` | unit `leaderboard…`, `play.js --export…`; [leaderboard-export.json](../proof/phase-4/leaderboard-export.json); [web-leaderboard.png](../proof/phase-4/web-leaderboard.png) |
| Đổi phím | 9 hành động; báo trùng phím; khôi phục mặc định; được lưu | [ui-checks.json](../proof/phase-4/ui-checks.json), [web-keys-duplicate.png](../proof/phase-4/web-keys-duplicate.png) |
| Phụ đề và chỉ báo | Bóng Mực xuất hiện (kèm mũi tên ở mép màn hình), gió sắp thổi, 10 giây cuối, đèn dưới 30 dầu | [web-subtitles-bigtext.png](../proof/phase-4/web-subtitles-bigtext.png), `ui-checks.json` |
| Giảm chuyển động | Tắt rung camera và chớp màn hình khi bị đánh | `src/web/main.js` (`shake`, `flash`); chơi thử tay |
| Cỡ chữ | Chữ HUD nhỏ nhất ≥ 18 px ở 1280×720; chữ lớn ×1.25 | `ui-checks.json`: 18 px và 22.5 px |
| Đóng gói | Clone sạch, ≤ 3 lệnh; README đủ mục; CHANGELOG có cả 4 phase; CREDITS; LICENSE; Release web tĩnh | README, `release/dao-den-long-v1.0.0-web.zip` (đã chạy thử bằng `python -m http.server`) |
| Contract v1.3 | `contract_version: "1.3"`, `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên | unit `contract v1.3…`; proof 29/29 case |

## 2. Giả định và quyết định
- **Bản web không có "cửa sổ game" riêng**, nên bench mở một cửa sổ Chrome 1280×720 (không toàn màn hình).
  - Vsync được tắt bằng `--disable-gpu-vsync --disable-frame-rate-limit`.
  - `load_ms` tính từ lúc tiến trình `bench.js` bắt đầu (gồm khởi động Chrome) tới khung hình đầu tiên của cảnh bench.
  - `peak_mem_mb` là tổng RSS (working set trên Windows) của cả cây tiến trình Chrome, lấy mẫu mỗi giây. Con số này lớn hơn bộ nhớ thật của game, vì gồm cả tiến trình GPU và tiến trình nền của trình duyệt.
- **Bóng Mực trong bench** đi theo luật wander bình thường (Ticket-03): kéo về đèn tắt gần nhất, và chuyển `chase` nếu tới gần Mây trong 12 m. Sát thương đã tắt.
- **Soak:** "Đêm thứ i dùng seed 7 + i" được hiểu với i từ 0, tức Đêm đầu dùng seed 7. Input ngẫu nhiên dùng RNG riêng (`seed ^ 0x5eed`) để không đụng RNG của sim.
- **`--lite-mode` trong `soak_cmd`:**
  - Heap JS phẳng qua 30 Đêm (khoảng 4.5 MB) nhưng RSS dao động 46–63 MB, do V8 giữ lại mã JIT tối ưu.
  - `--lite-mode` tắt trình biên dịch tối ưu; khi đó RSS phẳng (39.5 → 41.4 MB qua 30 Đêm).
  - Đây là lựa chọn công khai trong lệnh, không phải che rò bộ nhớ ([bằng chứng](../proof/phase-4/soak-memprobe.txt)).
- **Bảng xếp hạng:** `play.js` lưu vào `~/.dao-den-long/leaderboard.json` (đặt `DDL_DATA_DIR` để đổi chỗ), ghi kiểu atomic. Bản web tĩnh của Release lưu vào `localStorage`.
- **`seed` của mục xếp hạng** là `runSeed`; Đêm n dùng seed `runSeed + n − 1`.
- **`run_cmd` đổi thành `node play.js`**, để `--export-leaderboard` chạy được trên cùng lệnh.

## 3. Nhật ký dùng AI (Phase 4)

| Bước | Việc | Kết quả / kiểm tra |
|---|---|---|
| 1 | Dán Ticket-04 | Agent làm theo thứ tự chấm điểm: contract, soak, bench, bảng xếp hạng, accessibility, tài liệu |
| 2 | Soak lần đầu: RSS ×1.25, **trượt** | Không sửa số. Đo heap và RSS từng Đêm ở 30 Đêm: heap phẳng, nên không phải rò. Thử `--max-semi-space-size` (không đỡ), `--jitless` và `--lite-mode` (phẳng): xác định nguyên nhân là mã JIT |
| 3 | Tên tiếng Việt bị từ chối khi gửi bằng curl | Kiểm tra bằng `fetch` UTF-8 thì đạt; lỗi do curl trên Windows gửi sai mã hóa, không phải lỗi code |
| 4 | Patch web lỡ thêm trùng `case` | Agent tự phát hiện khi rà patch, sửa trước khi chạy |
| 5 | Người dùng yêu cầu "không commit gì lên git" | Agent dừng commit, ghi luật vào AGENTS.md và bộ nhớ của agent. Commit `1e6681f` đã tạo trước yêu cầu được báo lại cho người dùng |

Ước tính token Phase 4: khoảng 200–250k. Tổng 4 phase: xem [retro.md](retro.md).

## 4. Đánh giá
- Đạt mọi tiêu chí ở mục 1, trên máy tự đo: bench 132–191 FPS, p1 low 79–93, load 1.0–2.0 s; soak ×1.05. Số chính thức do máy chấm đo.
- Hồi quy: 29/29 case headless Phase 1–3 vẫn đạt; chế độ bench mặc định tắt nên đầu ra headless không đổi.
- Còn lại cho người dùng tự làm: quay video demo, tạo GitHub Release v1.0.0, commit, gắn tag `phase-4`.
