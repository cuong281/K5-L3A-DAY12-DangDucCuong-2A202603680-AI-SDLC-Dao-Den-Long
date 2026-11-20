# Bằng chứng Phase 1

Tất cả tạo lại được ở tag `phase-1`: `npm install && npm test && npm run proof`.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| R1 Đảo tròn, 5 đèn, xuất phát (0,0,0) | Unit test `tick 0 snapshot` | [test-output.txt](test-output.txt) | Đạt |
| R2 Đi lại theo camera, chuẩn hóa vector | Unit test yaw 0/90, `[1,1]` chuẩn hóa | [test-output.txt](test-output.txt) | Đạt |
| R2 Camera 3D, nhân vật đội nón lá có đèn | Ảnh chụp bản web | [web-start.png](web-start.png) | Đạt |
| R3 Nhặt đom đóm, bán kính, sức chứa | Unit test + case `contract-example` (tick 38 tính tay) | [headless-summary.md](headless-summary.md) | Đạt |
| R4 Nạp đèn, thắp đèn | Unit test + case `win-all-lit` | [headless-summary.md](headless-summary.md) | Đạt |
| R5 Bóng Mực đuổi, chạm mất lửa, rơi đom đóm, bất tử | Unit test + case `lose-no-flames` (tick 69 tính tay) | [headless-summary.md](headless-summary.md) | Đạt |
| R6 Tỏa sáng: tốn, choáng, đẩy, hồi | Unit test pulse/cooldown + case `contract-example` | [test-output.txt](test-output.txt) | Đạt |
| R7 Bóng Mực không vào vùng đèn sáng | Unit test 600 tick + case `safe-radius` | [headless-summary.md](headless-summary.md) | Đạt |
| R8 Thắng / thua (dawn, no_flames) / điểm | Cases `win-all-lit` (điểm 1244 tính tay), `lose-dawn`, `lose-no-flames` | [headless-summary.md](headless-summary.md) | Đạt |
| R9 HUD, menu, chơi lại | Ảnh chụp HUD; chơi lại bằng phím R (thử tay) | [web-menu.png](web-menu.png), [web-start.png](web-start.png) | Đạt (chơi lại chỉ thử tay) |
| R10 Headless: định dạng, exit 2, làm tròn, dừng sớm | `tests/headless.test.js` | [test-output.txt](test-output.txt) | Đạt |
| R10 Tất định | Mỗi case chạy 2 lần so byte; test seed giống/khác | [headless-summary.md](headless-summary.md) | Đạt |
| R11 Đảo sáng dần khi thắp đèn | Ảnh 0 đèn vs 3 đèn (`?lit=3`) | [web-start.png](web-start.png), [web-lit3.png](web-lit3.png) | Đạt |
| Harness: chặn kết thúc khi test đỏ | Đổi tạm `player_speed` → hook exit 2 | [hook-blocks.txt](hook-blocks.txt) | Đạt |
| Hiệu năng headless | `time node headless.js --ticks 18000` (đêm 300 s) | khoảng 0.1 s trên laptop Windows 11, Node 22 | Đạt |

Máy chạy: Windows 11 Pro, Node v22.13.1. CI chạy thêm trên ubuntu-latest và macos-latest (`.github/workflows/test.yml`).
