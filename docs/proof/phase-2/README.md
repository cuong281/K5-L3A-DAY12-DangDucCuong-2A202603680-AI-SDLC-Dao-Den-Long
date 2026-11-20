# Bằng chứng Phase 2 (Ticket-02, Contract v1.1)

Tạo lại ở tag `phase-2`: `npm install && npm test && npm run proof -- phase-2`, và FPS: `npx vite build && npx vite preview --port 4173` rồi `npm run bench`.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Số liệu chuẩn Phần 1 trong `game.contract.json` | Unit test so từng khóa với ticket | [test-output.txt](test-output.txt) (`contract tuning matches…`) | Đạt |
| Thứ tự xử lý tick (12 bước) | Các case đo đúng tick sự kiện: chạm trước rồi recoil, thả đom đóm nhặt được từ tick sau, spawn hành động từ tick sau | `p2-shade-hit`, `p2-safe-expel`, `p2-spawn-schedule` trong [headless-summary.md](headless-summary.md) | Đạt |
| Bản đồ chuẩn 3 Đêm | Unit test vị trí/số điểm; case bục nhảy; ảnh | `p2-night2-pad`, `p2-night3-pad`; [web-night1.png](web-night1.png), [web-night2.png](web-night2.png), [web-night3.png](web-night3.png) | Đạt |
| Lướt | Case + unit | `p2-dash` | Đạt |
| Đom đóm: 20 ban đầu, +1/240 tick, trần/điểm trống; rơi khi bị chạm (TTL 480) | Case + unit | `p2-spawn-schedule`, `p2-shade-hit` | Đạt |
| Đèn: chi phí 10, nạp nhiều lần, gần nhất/id nhỏ | Unit `deposit…`, `interact picks…` | [test-output.txt](test-output.txt) | Đạt |
| Vùng an toàn: chặn ở mép 6 m; đẩy ra trong 30 tick khi vừa thắp | Case | `safe-radius`, `p2-safe-expel` | Đạt |
| Tỏa Sáng: 3 / 5 m 3D / 3 s, choáng 120, đẩy 4 m trong 15 tick, +5 | Case + unit | `p2-pulse` | Đạt |
| Bóng Mực: 5 trạng thái, 12/18 m, chạm XZ ≤ 1 và chênh cao ≤ 1.5, 1 lửa/tick, recoil, lịch sinh | Case + unit | `p2-shade-hit`, `p2-spawn-schedule`, `full-night-idle` | Đạt |
| Rơi khỏi đảo | Case | `p2-fall`, `p2-fall-last-flame` | Đạt |
| Thắng/thua theo thứ tự; thắng đúng tick hết giờ | Case | `p2-night3-win-dawn-tick`, `win-all-lit`, `lose-dawn`, `lose-no-flames` | Đạt |
| Gió Lạc | Case | `p2-drifter-steal`, `p2-drifter-pulse` | Đạt |
| Bùa Gió | Case + unit | `p2-charm` | Đạt |
| Gió mạnh Đêm 3 | Case + unit (đẩy đúng 10 m trong 5 s) | `p2-night3-wind` | Đạt |
| Tạm dừng (headless) | Case + CLI test | `p2-pause` | Đạt |
| Contract v1.1: `--night`, snapshot mới, sự kiện mới, exit 2 | `tests/headless.test.js` | [test-output.txt](test-output.txt) | Đạt |
| Tất định (mọi Đêm) | Mỗi case chạy 2 lần so byte; unit 3 Đêm × 4000 tick | [headless-summary.md](headless-summary.md) | Đạt |
| Headless 1 Đêm đầy đủ ≤ 30 s | Đo thời gian 18000/19800/21600 tick | [headless-perf.txt](headless-perf.txt): 0.42 / 0.50 / 0.64 s | Đạt |
| ≥ 30 FPS @1280×720 | `tools/bench.js` (Chrome thật, 10 s/Đêm, camera xoay, 3 đèn sáng) | [fps.json](fps.json), [fps-night1.png](fps-night1.png): 114.8 / 118.4 / 118.9 FPS (AMD Radeon tích hợp, Ryzen 5 5600H) | Đạt |
| Chuỗi 3 Đêm, giới thiệu Ông Đăng, kết quả, Bình Minh | Ảnh + chơi tay | [web-menu.png](web-menu.png), [web-intro2.png](web-intro2.png) | Đạt (Bình Minh chỉ thử tay) |
| HUD đầy đủ + bảng màu | Ảnh | [web-night3.png](web-night3.png) | Đạt |
| Tạm dừng / Cài đặt / Âm thanh (web) | Chơi tay | — | Kiểm bằng tay, không có test tự động |
| Hồi quy Phase 1 | Case Phase 1 chạy lại với số chuẩn (kỳ vọng tính lại, lý do trong `why`) | [headless-summary.md](headless-summary.md) | Đạt |
