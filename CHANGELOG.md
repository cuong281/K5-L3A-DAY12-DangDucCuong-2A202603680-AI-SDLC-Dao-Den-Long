# Changelog

## [v1.0.0 / phase-4] — Contract v1.3, Ticket-04 "Bình minh: phát hành v1.0.0"

### Added
- **Benchmark** `node tools/bench.js --seed 42 --duration 30 --out bench.json`:
  - Cảnh chuẩn: Đêm 1, 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng với dầu 100, camera bay vòng r = 30 m, Y = 15 m.
  - Chrome 1280×720, vsync tắt. Đo `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `load_ms`, `peak_mem_mb` đúng định nghĩa của ticket.
  - Thêm chế độ `bench` trong sim: tắt sinh thêm, sát thương, nhặt, hao dầu và kết thúc Đêm. Chế độ này mặc định tắt, nên headless không đổi.
- **Soak** `node --expose-gc --lite-mode tools/soak.js --seed 7 --nights 10 --out soak.json`: chạy 10 Đêm xoay vòng 1→2→3 với input ngẫu nhiên theo seed, đo RSS lúc đầu và lúc cuối.
- **Bảng xếp hạng cục bộ:**
  - Top 10, tên 3–12 ký tự `[A-Za-z0-9_]`, nhận cả tiếng Việt có dấu.
  - Lưu trên đĩa qua `play.js` tại `~/.dao-den-long/leaderboard.json`; khi chạy bản web tĩnh thì dùng `localStorage`.
  - Xuất bằng `node play.js --export-leaderboard out.json`. Có màn hình Bảng xếp hạng từ menu.
- **Accessibility:**
  - Đổi phím cho mọi hành động, báo trùng phím, nút khôi phục mặc định.
  - Phụ đề và chỉ báo hình ảnh: Bóng Mực xuất hiện (kèm mũi tên ở mép màn hình), gió sắp thổi, 10 giây cuối, đèn dưới 30 dầu.
  - Giảm chuyển động: tắt rung camera và chớp màn hình khi bị đánh.
  - Chữ UI tối thiểu 18 px; tùy chọn chữ lớn ×1.25.
- **`play.js` (run_cmd mới):** tự build, phục vụ bản web, mở trình duyệt.
- Retro [docs/notes/retro.md](docs/notes/retro.md); bản Release web tĩnh.

### Changed
- `contract_version` thành 1.3; thêm `bench_cmd` và `soak_cmd`. `run_cmd` đổi từ `npm run dev` sang `node play.js`.
- Script đo FPS cũ của Phase 2–3 đổi tên thành `tools/fps-check.js` (`npm run fps-check`).
- Luật, số liệu và đầu ra headless của v1.0–v1.2 **không đổi**: 29/29 case cũ vẫn đạt.

## [phase-3] — Contract v1.2, Ticket-03 "Đèn cạn dầu"

### ⚠ Breaking changes
- **Luật thắng:** bỏ thắng sớm (`all_lit`). Chỉ thắng lúc bình minh nếu còn sống và số đèn đang sáng ≥ `ceil(0.6 × n)`; khi đó `game_over.reason = "dawn_survived"`. Thắp đủ đèn không còn kết thúc Đêm.
- **Thời lượng Đêm:** 300 / 330 / 360 s → **240 / 270 / 300 s**.
- **Điểm:**
  - Mỗi đom đóm nạp: +10 → **+5**.
  - Thắp lại: **+40**. Tỏa Sáng trúng Bóng Mực đang drain: **+15**.
  - Bình minh: **+50 + floor(fuel)** mỗi đèn sáng.
  - Bỏ thưởng thời gian (`per_second_left = 0`).
- **Đèn sáng có thể tắt:** hao 1 dầu/s. Hết dầu thì phát `lantern_out`, đèn về trạng thái tắt với `deposited = 0`. Thắp lại đèn đã từng sáng chỉ cần 5 đom đóm.
- **Đèn đang sáng nhận đom đóm để châm dầu** (sự kiện `refuel`). Tương tác chọn đèn chưa sáng *hoặc* đèn sáng chưa đầy dầu.
- **Vùng an toàn:** chỉ đèn sáng có fuel ≥ 30 mới có vùng. Bóng Mực được vào gần đèn yếu.
- **Bóng Mực:**
  - Thêm trạng thái `drain`.
  - `wander` giờ đi tới đèn yếu, nếu không có thì tới đèn tắt gần nhất.
  - Hết choáng luôn về `wander` (trước: `chase` hoặc `wander` tùy khoảng cách).
- **Sức chứa:** 10 + 2 × số lần thắp thành công, tối đa 20 (trước: luôn 10).
- **Contract v1.2:**
  - Tuning thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
  - Snapshot: đèn thêm `fuel`, `ever_lit`, `relit_count`; player thêm `capacity`.
  - Sự kiện mới: `refuel`, `lantern_out`, `fuel_drain`. `lantern_lit` thêm trường `relight`.
  - Scenario: đèn thêm `fuel`, `ever_lit`; player thêm `successful_lights`; Bóng Mực thêm `target_lantern_id`.

### Added
- Chế độ "Bảng màu dễ phân biệt" (được lưu): viền và mắt Bóng Mực màu #00B3FF, cảnh báo UI màu trắng kèm ⚠.
- Đèn tắt xẹp 20% và có vết rách; đèn sắp hết dầu nhấp nháy 1 Hz.
- Thanh dầu trên đèn. HUD hiện đang mang / sức chứa và số đèn cần giữ sáng tới bình minh.
- ADR [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md).

### Tests
- Tôi sửa 4 unit test và 5 case headless có luật bị Ticket-03 thay thế. Lý do ghi bằng `[P3 updated]`/`[P3 replaced]` trong test và `[P3 cập nhật]`/`[P3 thay]` trong `why` của case.
- Thêm 10 unit test và 9 case cho luật mới. Không test nào bị skip.

## [phase-2] — Contract v1.1, Ticket-02 "Ba hòn đảo"
### ⚠ Breaking changes
- Thay toàn bộ số tự chọn của Phase 1 bằng số chuẩn:
  - Chi phí thắp 5 → 10; nhặt 1.2 → 1.0 m; tương tác 2.5 → 2.0 m.
  - Tỏa Sáng: 3 đom đóm, bán kính 5 m tính theo khoảng cách 3D.
  - Bóng Mực chạy 4 m/s; điểm được cộng khi nạp đom đóm, không còn cộng khi nhặt.
- Thứ tự xử lý tick chuẩn gồm 12 bước. Bóng Mực có 5 trạng thái; Bóng Mực chỉ sinh từ tick 300.
- Bật rơi khỏi đảo (`fall_enabled: true`). Đom đóm rơi khi bị chạm giờ nằm lại trên mặt đất trong 480 tick.
### Added
- 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông).
- Lướt, Bùa Gió, Gió Lạc, tạm dừng, gió Đêm 3, bục nhảy, địa hình nhiều tầng.
- Chuỗi Đêm có menu, màn giới thiệu với lời Ông Đăng, màn Bình Minh.
- Cài đặt, HUD đầy đủ, bảng màu chuẩn, nhạc nền và hiệu ứng âm thanh.
- Contract v1.1: `--night 1..3`, snapshot và sự kiện mới.

## [phase-1] — Contract v1.0, PRD-0
### Added
- Đêm 1 chơi được trên web (Three.js): Mây đội nón lá, đom đóm, 5 đèn, Bóng Mực, Tỏa Sáng, HUD, thắng/thua, chơi lại.
- Chế độ headless tất định (`headless.js`), `game.contract.json`, unit test, scenario và harness AI (AGENTS.md, Stop hook, skill, CI).
