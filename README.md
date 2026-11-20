# Đảo Đèn Lồng

> Video demo: *(sẽ bổ sung ở Phase 4)* · Tài liệu lab gốc: [docs/lab/README.md](docs/lab/README.md)

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi đội nón lá, gom đom đóm để thắp lại Đèn Lồng Lớn qua **ba đêm**: Đảo Bến, Đảo Cau và Đảo Chuông, đồng thời tránh **Bóng Mực** và **Gió Lạc** trong sương đen.
Game có chế độ headless tất định theo **Test Contract v1.1** để chấm tự động.

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 18)

```bash
npm install          # build_cmd
npm run dev          # mở game trên trình duyệt: http://localhost:5173
node headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl   # headless (--night 1|2|3)
```

Kiểm thử:
- `npm test`: unit test và test CLI.
- `npm run proof -- phase-2`: chạy 21 case headless, mỗi case 2 lần để kiểm tra tất định.
- `npm run bench`: đo FPS, cần chạy `npx vite build && npx vite preview --port 4173` trước.

Bản tĩnh: `npx vite build`, kết quả nằm trong `dist/`.

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / `↑ ↓` | Đi (theo hướng camera) |
| Kéo chuột, `Q` / `C`, `← →` | Xoay camera (chỉnh độ nhạy trong Cài đặt) |
| `Space` | Nhảy |
| `Shift` | Lướt (14 m/s trong 0.2 s, hồi chiêu 1.5 s) |
| `E` | Nạp ánh sáng vào đèn gần nhất |
| `F` | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `Enter` / `R` | Bắt đầu, sang Đêm kế tiếp / chơi lại Đêm vừa thua |

## Luật chính (số chuẩn Ticket-02)

- Mang tối đa **10** đom đóm, nhặt tự động trong 1 m. Mỗi đèn cần **10** đom đóm, có thể nạp nhiều lần (đứng trong 2 m rồi nhấn `E`).
- **Bóng Mực** phát hiện Mây trong 12 m và bỏ đuổi khi xa quá 18 m (tốc độ 4 m/s, Đêm 3 là 4.5 m/s).
  - Bị chạm: mất 1 Ngọn Lửa, rơi một nửa số đom đóm ra quanh Mây, sau đó bất tử 1.5 s.
  - Bóng Mực không vào được vòng 6 m quanh đèn đã sáng.
- **Gió Lạc** (Đêm 2–3) cướp 3 đom đóm khi Mây mang từ 5 con trở lên. Tỏa Sáng trúng nó lúc đang chạy trốn sẽ lấy lại số đom đóm bị cướp.
- **Bùa Gió** (lá bùa đỏ): trong 10 s chạy 7.2 m/s và lướt không cần hồi chiêu.
- **Rơi khỏi đảo**: mất 1 Ngọn Lửa và toàn bộ đom đóm, hồi sinh ở điểm xuất phát.
- **Thắng** khi thắp hết đèn của Đêm. **Thua** khi hết 3 Ngọn Lửa hoặc trời sáng (5 phút 00 / 5 phút 30 / 6 phút 00). Thắng Đêm 3 thì tới màn Bình Minh.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 |
| Khi thắng: mỗi giây còn lại | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm của các Đêm đã thắng.

## Test Contract

- [game.contract.json](game.contract.json) (v1.1) ghi đúng số chuẩn. Logic trong `src/sim/` đọc trực tiếp từ file này.
- Bản đồ chuẩn nằm trong [src/sim/maps.js](src/sim/maps.js). Mỗi tick chạy đủ 12 bước theo thứ tự trong `Game.step()`.
- Snapshot có thêm mảng `motes` (id, pos, kind, ttl_s), `drifters` và `charms`. `player.invuln` là boolean, kèm `invuln_s`.
- Giả định cho các chỗ ticket còn mơ hồ (xuất phát Đêm 3 ở (0,0,−16), thời lượng `spawning`…) nằm trong [docs/notes/phase-2.md](docs/notes/phase-2.md).

## Sáng tạo của tôi

Mọi phần thêm đều **chỉ ở renderer** (`src/web/`), không chạm vào `src/sim/`, nên đầu ra headless không đổi.

- **Đèn trời:** mỗi khi một Đèn Lồng Lớn được thắp, 6 chiếc đèn trời nhỏ bay lên.
- **Chuông ngũ cung:** toàn bộ âm thanh và nhạc nền được tạo bằng WebAudio, không dùng file. Nhặt đom đóm cho nốt cao dần theo số đang mang; thắp đèn cho hợp âm.
- **Ông Đăng:** mỗi Đêm mở đầu bằng một lời dặn riêng của ông.
- **Lá bay báo gió:** 2 s trước mỗi cơn gió ở Đêm 3, lá bay theo đúng hướng gió sắp thổi.

Bằng chứng phần cũ vẫn đúng: `npm test` (39/39) và `npm run proof -- phase-2` (21/21 case, 2 lần chạy giống hệt nhau) đều đạt. Xem [docs/proof/phase-2/](docs/proof/phase-2/README.md).

## Cấu trúc

```text
game.contract.json   headless.js   index.html
src/sim/     logic thuần: sim.js, maps.js, rng.js, validate.js (dùng chung cho headless và web)
src/web/     main.js (luồng game, HUD), world.js (địa hình, bảng màu), sfx.js (âm thanh)
tests/       unit + CLI tests          scenarios/  case headless kèm kỳ vọng tính tay
tools/       proof.js, mkcases.py, bench.js
docs/notes/  giả định, spec, nhật ký AI theo phase     docs/proof/  bằng chứng theo phase
AGENTS.md, CLAUDE.md, .claude/ (Stop hook, skill verify-headless), .github/workflows/  harness AI và CI
```
