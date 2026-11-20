# Credits

## Nội dung game
- **Nhân vật, bối cảnh, tên gọi** (Mây, Ông Đăng, Đảo Đèn Lồng, Bóng Mực, Gió Lạc, Bùa Gió): bản gốc của lab Day 12 AI SDLC.
- **Mô hình 3D:** dựng bằng hình khối có sẵn của three.js (trụ, nón, cầu, hộp). Không dùng file mô hình, texture hay hình ảnh bên ngoài.
- **Âm thanh và nhạc nền:** tạo theo thủ tục bằng WebAudio trong `src/web/sfx.js` (dao động sine/triangle/square/sawtooth, nhiễu lọc dải). Không dùng file âm thanh.
- **Font:** font hệ thống (`system-ui`, Segoe UI), không nhúng font.

## Thư viện (qua npm)
| Gói | Dùng cho | Giấy phép |
|---|---|---|
| [three](https://threejs.org) 0.160.0 | Render 3D | MIT |
| [vite](https://vitejs.dev) 5.4.10 | Build và dev server | MIT |
| [puppeteer-core](https://pptr.dev) 22.15.0 | Điều khiển Chrome cho benchmark và chụp ảnh bằng chứng | Apache-2.0 |

## Công cụ AI
- **Claude Code** (Anthropic, model Claude Opus) đã hỗ trợ viết mã nguồn, test, scenario, script đo và tài liệu ở cả 4 phase. Tôi điều phối, duyệt và kiểm chứng; chi tiết nằm trong nhật ký AI ở `docs/notes/phase-*.md` và [retro](docs/notes/retro.md).
- Không dùng AI để tạo hình ảnh hay âm thanh. Ảnh trong `docs/proof/` là ảnh chụp màn hình game thật.
