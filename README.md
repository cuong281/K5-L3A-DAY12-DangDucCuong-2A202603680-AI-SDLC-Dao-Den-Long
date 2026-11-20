# Đảo Đèn Lồng

> Video demo: *(sẽ bổ sung ở Phase 4)* · Tài liệu lab gốc: [docs/lab/README.md](docs/lab/README.md)

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi đội nón lá, gom đom đóm để thắp lại 5 Đèn Lồng Lớn của Đảo Bến trước khi trời sáng, đồng thời tránh **Bóng Mực** trong sương đen.
Có chế độ headless tất định theo Test Contract v1.0 để chấm tự động.

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 18)

```bash
npm install          # build_cmd
npm run dev          # mở game trên trình duyệt: http://localhost:5173
node headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl   # headless
```

Kiểm thử: `npm test` (unit + CLI) và `npm run proof` (chạy các scenario 2 lần, so tất định, ghi vào `docs/proof/`).
Bản tĩnh: `npx vite build`, kết quả nằm trong `dist/`.

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / `↑ ↓` | Đi (theo hướng camera) |
| Kéo chuột, `Q` / `C`, `← →` | Xoay camera |
| `Space` | Nhảy |
| `E` | Nạp đom đóm vào đèn gần nhất |
| `F` | Tỏa sáng: xua Bóng Mực gần (tốn 1 đom đóm, hồi 2 s) |
| `Enter` / `R` | Bắt đầu / chơi lại |

## Luật và cách tính điểm

- Mang tối đa **10** đom đóm. Mỗi đèn cần **5** đom đóm để thắp. Đứng trong 2.5 m rồi nhấn `E`.
- Bóng Mực đuổi theo với tốc độ 3.5 m/s (Mây chạy 6 m/s). Bị chạm thì mất 1/3 ngọn lửa, rơi một nửa số đom đóm và được bất tử 1.5 s.
- Tỏa sáng làm choáng Bóng Mực trong 6 m suốt 3 s và đẩy chúng lùi 4 m. Bóng Mực không vào được vòng 6 m quanh đèn **đã thắp**.
- **Thắng** khi thắp đủ 5 đèn. **Thua** khi hết lửa hoặc khi trời sáng (sau 5 phút).

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng | +25 |
| Khi thắng: mỗi giây còn lại | +2 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

## Test Contract

- [game.contract.json](game.contract.json) ghi đúng các số mà game dùng. Logic trong `src/sim/` đọc trực tiếp từ file này.
- `fall_enabled: false`: đảo có tường vô hình ở bán kính 40 m, không có sự kiện rơi. Không có `dash`.
- Trạng thái Bóng Mực: `chase`, `stunned`. Snapshot có thêm mảng `motes` (id, pos).
- Các giả định chi tiết nằm trong [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Sáng tạo của tôi

Mọi phần thêm đều **chỉ ở renderer** (`src/web/`), không chạm vào `src/sim/`, nên đầu ra headless không đổi.

- **Đèn trời:** mỗi khi một Đèn Lồng Lớn được thắp, 6 chiếc đèn trời nhỏ bay lên từ chân đèn.
- **Chuông ngũ cung:** âm thanh tạo bằng WebAudio, không dùng file. Nhặt đom đóm cho nốt cao dần theo số đang mang; thắp đèn cho hợp âm; bị chạm cho tiếng trầm.
- **Đảo bừng sáng:** nền trời chuyển từ tím đen sang tím ấm, sương mỏng dần, ánh sáng tăng theo số đèn đã thắp. Vòng sáng quanh đèn cho thấy vùng an toàn.

Bằng chứng phần cũ vẫn đúng: `npm test` (28/28) và `npm run proof` (6/6 case, chạy 2 lần giống hệt nhau) đều đạt sau khi thêm. Xem [docs/proof/phase-1/](docs/proof/phase-1/README.md) và ảnh [web-lit3.png](docs/proof/phase-1/web-lit3.png).

## Cấu trúc

```text
game.contract.json   headless.js   index.html
src/sim/     logic thuần (dùng chung cho headless và web)
src/web/     renderer Three.js, HUD, âm thanh
tests/       unit + CLI tests          scenarios/  case headless kèm kỳ vọng tính tay
tools/       proof.js                  docs/notes  giả định, nhật ký AI   docs/proof  bằng chứng
AGENTS.md, CLAUDE.md, .claude/ (hook, skill), .github/workflows/  harness AI và CI
```
