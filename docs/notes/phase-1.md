# Phase 1 — PRD-0: ghi chép

## 1. Tiêu chí nghiệm thu (rút từ PRD-0 + Test Contract v1.0)

| # | Yêu cầu | Tiêu chí kiểm chứng được |
|---|---|---|
| R1 | Đêm 1 – Đảo Bến, đảo tròn, 5 Đèn Lồng Lớn | Snapshot tick 0 có 5 đèn L1…L5, người chơi ở (0,0,0) |
| R2 | Đi lại, nhảy, camera 3D | `move` + `cam_yaw_deg` theo công thức contract; nhảy làm y > 0 rồi về 0; web có camera góc ba xoay được |
| R3 | Đom đóm rải rác, nhặt được | Trong `pickup_radius` → `mote_picked`, `carried`+1, tối đa `carry_capacity` |
| R4 | Nạp ánh sáng thắp đèn | `interact` trong `interact_radius` → `deposit`; đủ `lantern_cost` → `lantern_lit` |
| R5 | Bóng Mực đuổi; chạm thì mất máu | Shade tiến về người chơi `shade_speed`; ≤ `shade_hit_radius` → `player_hit`, −1 lửa, rơi `hit_drop_ratio`, bất tử `invuln_s` |
| R6 | Tỏa sáng xua Bóng Mực, tốn ánh sáng | `pulse` tốn `pulse_cost`, choáng shade trong `pulse_radius` `pulse_stun_s` giây, đẩy `pulse_push_m`, hồi `pulse_cooldown_s` |
| R7 | Bóng Mực sợ đèn | Shade không vào `safe_radius` của đèn đã thắp |
| R8 | Thắng/thua/điểm | Hết đèn → `won/all_lit`; hết lửa → `lost/no_flames`; hết giờ → `lost/dawn`; điểm theo `score.*` |
| R9 | HUD, chơi lại | HUD hiện lửa, đom đóm, đèn, thời gian, điểm, trạng thái tỏa sáng; R để chơi lại |
| R10 | Headless theo contract | Tham số, tick model, JSONL, exit 0/2, tất định, làm tròn 3 số |
| R11 | Không khí đêm ấm, đảo sáng dần | Màu nền/ánh sáng tăng theo số đèn đã thắp (ảnh chụp) |

## 2. Giả định (chỗ PRD-0 mơ hồ)

| Chủ đề | Giả định của tôi | Lý do |
|---|---|---|
| "Máu" | Máu = `flames` (3 ngọn lửa). Mỗi lần chạm −1 | Contract dùng `flames` cho `player_hit` |
| Ánh sáng tỏa sáng | Tốn **đom đóm đang mang** (`pulse_cost` = 1) | PRD: "tốn ánh sáng"; không có thanh năng lượng riêng |
| Không đủ đom đóm / đang hồi | Nhấn pulse không có tác dụng, **không** phát sự kiện | Sự kiện chỉ ghi khi xảy ra |
| Pulse không trúng ai | Vẫn phát `pulse` với `stunned_ids: []`, vẫn tốn và vẫn hồi | Hành động đã xảy ra |
| Choáng lại shade đang choáng | Đặt lại thời gian choáng, đẩy tiếp, vẫn cộng `per_stun` | Đơn giản, nhất quán |
| Đẩy (`pulse_push_m`) | Dịch tức thì 4 m theo hướng từ người chơi ra shade (trùng vị trí → +X) | Tất định, dễ test |
| `safe_radius` | Chỉ áp dụng cho đèn **đã thắp**; shade bị đẩy ra mép (r + 0.01 m) | "Bóng Mực sợ những chiếc đèn" → đèn sáng; đèn tắt không có ánh sáng |
| Nạp đèn | `interact` (cạnh lên) nạp `min(carried, lantern_cost − deposited)` vào đèn **chưa thắp gần nhất** trong `interact_radius`. Không mang gì → không có sự kiện | Nạp hết một lần cho đỡ bấm nhiều |
| Đom đóm rơi khi bị chạm | `floor(carried × 0.5)` biến mất vào sương (không rơi xuống đất) | Không làm đổi `motes_active` ngoài ý muốn trong scenario |
| Rơi khỏi đảo | Không có: tường vô hình ở bán kính 40 m (`fall_enabled: false`), không phát `player_hit` by fall | Giảm phạm vi Phase 1 |
| Nhảy | Vận tốc 7 m/s, trọng lực 20 m/s². Chỉ ảnh hưởng y; mọi khoảng cách đo XZ nên nhảy không né được Bóng Mực | Contract đo XZ |
| Sinh đom đóm | `random_motes`: 30 con ngẫu nhiên (seed), con bị nhặt sinh lại sau 10 s ở chỗ ngẫu nhiên | Đủ 25 cho 5 đèn + pulse |
| Sinh Bóng Mực | `random_shades`: 2 con lúc đầu (cách người chơi ≥ 15 m, ngoài vùng an toàn), thêm 1 con mỗi 30 s (tối đa 6) → `shade_spawned`. Con lúc dựng màn không phát sự kiện | Độ khó tăng dần |
| Trạng thái shade | `chase` hoặc `stunned` | Contract chỉ bắt buộc `stunned` |
| Điểm | `per_mote` 10 khi nhặt, `per_lantern` 100 khi thắp, `per_stun` 25 mỗi shade bị choáng. **Khi thắng** cộng `per_second_left` 2 × floor(giây còn lại) + `per_flame_left` 50 × lửa còn lại. Thua không có thưởng | Khuyến khích thắng nhanh, ít bị chạm |
| Thứ tự trong một bước | input → di chuyển/nhảy → nhặt → (sinh lại đom đóm) → nạp đèn → pulse → shade di chuyển → sinh shade → va chạm → thời gian | Ghi lại để test tick chính xác |
| Thời gian | `time_left_s = time_left_s₀ − bước/60`; bước làm thời gian về ≤ 0 → `lost/dawn` | Theo contract |
| Đèn trong scenario | `lit: true` mà không có `deposited` → `deposited = lantern_cost`; id lạ bị bỏ qua | Nhất quán |
| Vị trí đèn mặc định | Vòng tròn bán kính 25 m, L1 ở (0,0,25), các đèn cách nhau 72° | Khớp ví dụ contract |
| Snapshot | Mỗi `--snapshot-every` tick tính từ 0. Khi game kết thúc giữa chừng không thêm snapshot lẻ; luôn có dòng `end` | Đúng nghĩa "mỗi N tick" |
| Lỗi CLI | Thiếu/ sai tham số → mã 1; file inputs/scenario không đọc được hoặc sai định dạng → mã 2 | Contract |

## 3. Kế hoạch kiểm chứng (viết trước khi code)

- Unit test logic thuần (`tests/sim.test.js`): mỗi R3–R8 một hoặc nhiều test, giá trị kỳ vọng **tính từ tuning** trong game.contract.json.
- CLI test (`tests/headless.test.js`): định dạng JSONL, snapshot-every, dừng sớm, exit 2, làm tròn, tất định.
- Scenario có kỳ vọng tính tay (`scenarios/*/case.json`) chạy qua CLI thật 2 lần (`npm run proof`).
- Ảnh chụp bản web bằng Chrome headless cho R2, R9, R11.

## 4. Nhật ký dùng AI

Công cụ: Claude Code (model Opus) trong VS Code. Harness: `AGENTS.md` (+ `CLAUDE.md` trỏ tới), Stop hook `.claude/hooks/tests-green.js`, skill `.claude/skills/verify-headless`, CI GitHub Actions.

| Bước | Lời nhắc chính / việc | Kết quả & tôi kiểm tra gì |
|---|---|---|
| 1 | "Đọc kỹ cấu trúc thư mục và các file md, đặc biệt README; bên trên là Phase 1" | Agent tóm tắt yêu cầu, chỉ ra bẫy của contract, đề xuất giả định và công nghệ. Tôi duyệt hướng JS + Three.js |
| 2 | "OK bắt đầu theo hướng đó" | Agent viết sim + headless trước, test sau, rồi web, harness, bằng chứng |
| 3 | Agent tự chạy test, chạy headless với ví dụ contract và đối chiếu bằng tay (đom đóm z=5 → tick 38) | Khớp |
| 4 | Ảnh chụp web lần 1: Mây biến mất | **Lỗi của AI**: `dt` âm trong Chrome headless làm `hitFlash` tăng → nhân vật nhấp nháy. Sửa bằng kẹp `dt ∈ [0, 0.1]`. Phát hiện nhờ đối chiếu ảnh, không phải nhờ test |
| 5 | `node --test tests/` không chạy trên Node 22 | **Lỗi của AI**: cú pháp thư mục. Đổi sang `tests/*.test.js` |
| 6 | Kiểm tra hook bằng cách đổi `player_speed` 6→7 | Hook chặn (exit 2), xem `docs/proof/phase-1/hook-blocks.txt` |

Ước tính token Phase 1: khoảng 150–200k token (đa phần là output code + đọc 6 file tài liệu lab ~44 KB). Cách tiết kiệm: đọc tài liệu một lần bằng một lệnh; viết file trọn vẹn thay vì sửa nhiều lần; test xuất ra đã lọc (`grep not ok`); không dùng subagent.

## 5. Đánh giá Phase 1

- Đạt: R1–R11 (xem bảng truy vết `docs/proof/phase-1/README.md`).
- Chưa làm: rơi khỏi đảo (cố ý, `fall_enabled: false`), `dash`.
- Rủi ro: các giả định về `safe_radius` chỉ cho đèn đã thắp, và pulse không trúng vẫn phát sự kiện, có thể khác cách hiểu của bộ test ẩn. Đã ghi rõ ở trên.
- Harness cần chỉnh: thêm vào AGENTS.md quy tắc "renderer phải chịu được dt bất thường" nếu lỗi tương tự lặp lại.
