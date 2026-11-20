# Changelog

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
- Áp dụng số chuẩn; 3 Đêm, lướt, Bùa Gió, Gió Lạc, tạm dừng, gió, rơi khỏi đảo, 5 trạng thái Bóng Mực; chuỗi Đêm, cài đặt, HUD đầy đủ.

## [phase-1] — Contract v1.0, PRD-0
- Đêm 1 chơi được, có chế độ headless tất định.
