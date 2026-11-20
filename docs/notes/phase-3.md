# Phase 3 — Ticket-03 "Đèn cạn dầu": ghi chép

Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md) · Breaking changes: [CHANGELOG.md](../../CHANGELOG.md)

## 1. Acceptance criteria

| Mục | Tiêu chí kiểm chứng được | Bằng chứng |
|---|---|---|
| Nhiên liệu | Vừa thắp → 100; hao 1/s (1/60 mỗi tick); hết (≤ 0) → `lantern_out`, tắt, `deposited = 0`, `ever_lit = true` | `p3-fuel-out`, unit `fuel decays…` |
| Châm dầu | `used = min(mang, ceil((100 − fuel)/10))`, +10 dầu mỗi đom đóm, +5 điểm; `refuel {lantern_id, amount, fuel}` | `p3-refuel`, unit `refuel…` |
| Chọn đèn | Đèn chưa sáng hoặc sáng chưa đầy; gần nhất, bằng nhau thì id nhỏ hơn | unit `interact picks…` |
| Thắp lại | `ever_lit` cần 5; `lantern_lit.relight = true`; +40; `relit_count` +1 | `p3-relight` |
| Vùng an toàn | Đèn có fuel < 30 mất vùng an toàn, đúng 30 vẫn còn | unit `exactly 30…`, `p3-drain` |
| Hút dầu | `wander` đi tới đèn yếu gần nhất; ≤ 2 m → `drain` (5/s, cộng dồn); `fuel_drain` mỗi 60 tick | `p3-drain` (tick 46, 106, 166) |
| Thoát drain | Mây ≤ 6 m → chase; Tỏa Sáng → stunned (+15); đèn ≥ 30 sau châm → đẩy ra 6 m trong 30 tick, không sát thương; hết choáng → wander | `p3-drain-expel`, `p3-pulse-drain`, unit `drain -> chase…` |
| Luật thắng | Không thắng sớm; bình minh với ≥ 3/5, 4/6, 5/7 đèn → `dawn_survived`; thiếu → `dawn`; hết lửa luôn `no_flames` trước | `win-all-lit`, `p3-dawn-win`, `p3-dawn-lose`, `p2-night3-win-dawn-tick`, unit `no_flames beats…` |
| Thời lượng | 240 / 270 / 300 s | `full-night-idle` (bình minh ở tick 14400), `p2-pause` |
| Sức chứa | 10 + 2 × lần thắp thành công, tối đa 20; đèn đặt sẵn không tính | `p3-capacity`, `p3-relight`, unit `relight…` |
| Điểm | +5/đom đóm nạp, +100 thắp lần đầu, +40 thắp lại, +5/+15 Tỏa Sáng, bình minh +50 + floor(fuel) mỗi đèn sáng, +50 mỗi lửa | `p3-dawn-win` (597), `p2-night3-win-dawn-tick` (895) |
| Mù màu | Cài đặt được lưu; viền/mắt Bóng Mực #00B3FF; cảnh báo UI #FFFFFF + ⚠; đèn tắt xẹp 20% + vết rách; đèn yếu nhấp nháy 1 Hz | `src/web/main.js` (`applyPalette`, draw), chơi thử tay |
| Contract v1.2 | Tuning mới; snapshot `fuel` (1 chữ số thập phân), `ever_lit`, `relit_count`, `capacity`; scenario `fuel`, `ever_lit`, `successful_lights`, `target_lantern_id` | `tests/headless.test.js`, unit `contract tuning…` |

## 2. Giả định

| Chủ đề | Giả định |
|---|---|
| Wander đi tới đèn | Đi với tốc độ Bóng Mực của Đêm (4 / 4.5 m/s), dừng cách đèn 2 m; không có đèn tắt hoặc yếu thì lượn quanh nhà như Phase 2 |
| Điểm khóa mới | `per_relight` 40, `per_stun_draining` 15, `per_lit_lantern_dawn` 50 thêm vào `score`; `per_second_left` = 0 |
| Đèn "đầy" | Theo đúng thứ tự tick, đèn hao ở bước 2 trước khi tương tác ở bước 5, nên lúc tương tác đèn hiếm khi đúng 100. Không thêm ngoại lệ (xem ADR) |
| `fuel_drain.fuel` | Giá trị sau khi trừ ở tick đó, 1 chữ số thập phân |
| `target_lantern_id` | Dùng làm mục tiêu ưu tiên khi đèn đó hợp lệ (yếu, hoặc tắt nếu không có đèn yếu) |
| Scenario `lit: true` | Mặc định `ever_lit = true`, `fuel = 100`; `deposited` = chi phí thắp |
| Snapshot Bóng Mực | Thêm `target_lantern_id` (null nếu không có) |

## 3. Test bị luật mới làm sai và cách xử lý

| Test | Xử lý | Lý do |
|---|---|---|
| unit `contract tuning matches…` | Sửa | Thời lượng, khóa và điểm mới (§3, §5, §7) |
| unit `deposit…` | Sửa: +5 mỗi đom đóm | §5 |
| unit `pause…` | Sửa: time_left theo 240 s | §3 |
| unit `win even on the exact dawn tick` | **Xóa**, thay bằng `no early win`, `dawn: win…`, `no_flames beats…` | §3 bỏ thắng sớm `all_lit` |
| case `win-all-lit` | Sửa: thắp hết đèn vẫn `playing`, điểm 150 | §3, §5 |
| case `full-night-idle` | Sửa: bình minh ở tick 14400 | §3 |
| case `p2-pause`, `p2-safe-expel` | Sửa: thời gian và điểm | §3, §5 |
| case `p2-night3-win-dawn-tick` | Thay: thắng `dawn_survived` với 5/7 đèn, điểm 895 | §3 |

## 4. Nhật ký dùng AI (Phase 3)

| Bước | Việc | Kết quả / kiểm tra |
|---|---|---|
| 1 | Dán Ticket-03, "làm phase 3" | Agent đọc lại các đoạn sim cần sửa, viết patch có kiểm tra (assert chuỗi gốc tồn tại) |
| 2 | Chạy test cũ ngay sau patch | Đỏ đúng 4 test của các luật bị thay, đúng như dự đoán; không đỏ test nào khác |
| 3 | Test mới `weak lantern… drains` đỏ | **Lỗi của AI trong code**: `wanderMove(s, sv)` truyền tốc độ đã chia 60 rồi lại chia 60 lần nữa, nên Bóng Mực đi 0.001 m/tick. Test tính tay phát hiện; sửa thành `this.shadeSpeed` |
| 4 | `bench.js` ghi sai đường dẫn | **Lỗi của AI**: dùng `'...${PHASE}'` (nháy đơn). Sửa sang backtick và chạy lại đo thật, không ghi tay |

Ước tính token Phase 3: khoảng 120–150k. Tiết kiệm: patch bằng script có kiểm tra, chỉ đọc các đoạn code cần sửa, đầu ra test luôn được lọc.

## 5. Đánh giá

- Đạt mọi tiêu chí ở mục 1 bằng headless (29 case), unit test (48) và ảnh. Phần mù màu và nhấp nháy chỉ kiểm bằng chơi tay.
- Hồi quy: các case Phase 1–2 không bị luật mới thay thế vẫn đạt mà không phải sửa (dash, charm, drifter, fall, pad, wind, spawn, pulse, shade-hit…).
- Hiệu năng: headless chạy trọn một Đêm dưới 0.5 s; web khoảng 114–118 FPS ([fps.json](../proof/phase-3/fps.json)).
- Rủi ro với test ẩn: các giả định ở mục 2, đặc biệt tốc độ đi tới đèn khi đang `wander`.
