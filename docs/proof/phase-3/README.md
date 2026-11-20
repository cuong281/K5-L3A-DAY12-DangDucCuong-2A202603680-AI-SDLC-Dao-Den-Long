# Bằng chứng Phase 3 (Ticket-03, Contract v1.2)

Tạo lại ở tag `phase-3`: `npm install && npm test && npm run proof -- phase-3`. FPS: `npx vite build && npx vite preview --port 4173`, rồi `PROOF_PHASE=phase-3 npm run bench`.

| Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|
| Nhiên liệu, hao, tắt đèn | `p3-fuel-out` trong [headless-summary.md](headless-summary.md) | Đạt |
| Châm dầu | `p3-refuel` | Đạt |
| Thắp lại 5 đom đóm, +40, relit_count | `p3-relight` | Đạt |
| Bóng Mực hút dầu, `fuel_drain` mỗi 60 tick | `p3-drain` | Đạt |
| Đẩy ra khi châm lên ≥ 30, không sát thương | `p3-drain-expel` | Đạt |
| +15 khi Tỏa Sáng trúng Bóng Mực đang drain | `p3-pulse-drain` | Đạt |
| Thắng/thua lúc bình minh, không thắng sớm | `p3-dawn-win`, `p3-dawn-lose`, `win-all-lit`, `p2-night3-win-dawn-tick` | Đạt |
| Sức chứa tăng dần | `p3-capacity`, `p3-relight` | Đạt |
| Contract v1.2 (tuning, snapshot, scenario, exit 2) | [test-output.txt](test-output.txt) | Đạt |
| Tất định | Mỗi case chạy 2 lần, so byte | Đạt |
| Hồi quy Phase 1–2 | Các case cũ còn hiệu lực vẫn đạt; các case bị thay có lý do `[P3 …]` | Đạt |
| Headless 1 Đêm ≤ 30 s | [headless-perf.txt](headless-perf.txt) | Đạt |
| ≥ 30 FPS @1280×720 | [fps.json](fps.json) (khoảng 114–118 FPS) | Đạt |
| Thanh dầu, HUD sức chứa, số đèn cần | [web-night1-lit3.png](web-night1-lit3.png) | Đạt |
| Mù màu, đèn tắt xẹp + rách, nhấp nháy 1 Hz | Chơi thử tay | Kiểm bằng tay |
