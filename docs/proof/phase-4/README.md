# Bằng chứng Phase 4 (Ticket-04, Contract v1.3)

Tạo lại ở tag `phase-4`:
- `npm install && npm test && npm run proof -- phase-4`
- `node tools/bench.js --seed 42 --duration 30 --out bench.json`
- `node --expose-gc --lite-mode tools/soak.js --seed 7 --nights 10 --out soak.json`
- Chụp UI: chạy `node play.js --no-open --port 5199`, rồi `node tools/ui-shots.js`

Máy tự đo: Windows 11, Ryzen 5 5600H, GPU tích hợp Radeon (ANGLE D3D11), 16 GB RAM, Chrome 158, Node 22.13.

| Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|
| Bench: avg ≥ 60, p1 low ≥ 30, load ≤ 10 s | [bench.json](bench.json): 190.98 / 93.23 FPS, load 1040 ms, p95 7.2 ms, 5730 khung; ảnh [bench-frame.png](bench-frame.png) | Đạt |
| Cảnh bench chuẩn và định nghĩa số đo | `tests/phase4.test.js`: 200/100/L1–L3, không sinh thêm, không sát thương, không nhặt, không hao dầu; camera; `frameStats` | Đạt |
| Soak: 0 crash, RSS ≤ 1.2× | [soak.json](soak.json): 0 crash, 39.5 → 41.3 MB (×1.05) | Đạt |
| Soak không rò bộ nhớ | [soak-memprobe.txt](soak-memprobe.txt): heap khoảng 4.5 MB phẳng qua 30 Đêm | Đạt |
| Bảng xếp hạng: luật, lưu đĩa, xuất | Unit test; [leaderboard-export.json](leaderboard-export.json) (bằng điểm 640 thì ai đạt trước đứng trên; tên có dấu); [web-leaderboard.png](web-leaderboard.png) | Đạt |
| Đổi phím, báo trùng, khôi phục mặc định | [ui-checks.json](ui-checks.json), [web-keys-duplicate.png](web-keys-duplicate.png), [web-settings.png](web-settings.png) | Đạt |
| Phụ đề và mũi tên Bóng Mực, chữ lớn | [web-subtitles-bigtext.png](web-subtitles-bigtext.png); chữ HUD nhỏ nhất 18 px, chữ lớn 22.5 px | Đạt |
| Giảm chuyển động | Chơi thử tay (tắt rung camera và chớp màn hình) | Kiểm bằng tay |
| Hồi quy v1.0–v1.2 | [headless-summary.md](headless-summary.md): 29/29 case, mỗi case 2 lần giống hệt; [test-output.txt](test-output.txt): 56/56 | Đạt |
| Release web tĩnh | `release/dao-den-long-v1.0.0-web.zip`: đã giải nén ra thư mục sạch, chạy `python -m http.server -d dist`, Đêm 2 render đúng | Đạt |
