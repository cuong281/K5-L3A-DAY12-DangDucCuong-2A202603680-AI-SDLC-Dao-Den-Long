# Phase 2 — Ticket-02 "Ba hòn đảo": spec, giả định, ghi chép

## 1. Thay đổi so với Phase 1 (và vì sao)

Ticket-02 **thay** các số tôi tự chọn ở Phase 1 bằng số chuẩn, nên tôi viết lại `src/sim/sim.js` theo đúng thứ tự xử lý 12 bước của ticket thay vì vá từng chỗ. Phần render và headless CLI vẫn giữ kiến trúc cũ (sim thuần dùng chung).

| Luật Phase 1 (tôi tự chọn) | Phase 2 (chuẩn) | Ảnh hưởng tới test cũ |
|---|---|---|
| Điểm `per_mote` khi **nhặt** | +10 mỗi đom đóm **nạp** | Đã sửa unit test pickup/deposit, case `win-all-lit` (948 điểm) |
| lantern_cost 5, pickup 1.2, interact 2.5 | 10 / 1.0 / 2.0 | Case `contract-example`: đom đóm nhặt ở tick 40 (trước là 38) |
| Pulse 1 đom đóm, 6 m XZ, đẩy tức thì 4 m, choáng 3 s | 3 đom đóm, 5 m **3D** từ chân+0.8, đẩy 4 m trong 15 tick, choáng 120 tick, +5 | Case `contract-example` không còn pulse (mang 1 < 3) |
| Shade luôn đuổi 3.5 m/s, sinh từ tick 0 | `spawning/wander/chase/recoil/stunned`, phát hiện 12 m, bỏ đuổi 18 m, 4.0 m/s, sinh từ tick 300 | `full-night-idle` giờ thua `dawn` (trước: `no_flames`); `safe-radius` dời shade vào 10 m để nó đuổi |
| Shade bị đẩy ra r + 0.01 | Bị chặn **đúng** ở mép 6 m; shade ở trong lúc đèn vừa thắp bị đẩy ra trong 30 tick, không gây sát thương | Test safe-radius kiểm tra `>= 6` |
| Rơi khỏi đảo: tường vô hình | Rơi (Y < −10): −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh | `fall_enabled: true` |
| Đom đóm rơi khi bị chạm biến mất | Rơi thành đom đóm `dropped` ở vành 1.5–2.5 m, TTL 480 tick | |
| Thắng: thưởng tính sau | Xét sau mỗi tick: no_flames > all_lit (kể cả đúng tick hết giờ) > dawn | Case mới `p2-night3-win-dawn-tick` |

Tất cả test bị đổi đều ghi lý do trong trường `why` của `scenarios/*/case.json` (bắt đầu bằng `[P2 cập nhật]`). Không test nào bị tắt.

## 2. Acceptance criteria — Phần 3 (tính năng mới)

| Tính năng | Tiêu chí nghiệm thu (kiểm chứng được) | Bằng chứng |
|---|---|---|
| **Lướt** | Nhấn dash → `dash {}`; 14 m/s trong 12 tick theo hướng đi (đứng yên thì hướng mặt) = 2.8 m; hồi chiêu 90 tick tính từ lúc bắt đầu; trên không giữ nguyên Y; không bất tử | `p2-dash`, unit `dash*` |
| **Gió Lạc** | Đêm 2–3, sinh ở tick 1200·k, tối đa 2 con còn sống, id D1…; idle → chase khi mang ≥ 5 và ≤ 15 m; chạm ≤ 1.2 m cướp min(3, mang), kể cả khi Mây bất tử → flee 240 tick → removed; mỗi con cướp 1 lần; không mất lửa | `p2-drifter-steal`, unit `drifter*` |
| Gió Lạc + Tỏa Sáng | Trúng con chase → flee không cướp; trúng con flee đang mang → `drifter_drop`, thả lại đom đóm `dropped`, biến mất sau 120 tick | `p2-drifter-pulse` |
| **Bùa Gió** | Nhặt như đom đóm → `charm_picked {charm_id, charm_ticks: 600}`; 7.2 m/s; lướt không hồi chiêu; xuất hiện lại sau 2700 tick; vị trí Đêm 2 (35,0,0), Đêm 3 (±30,0,25) | `p2-charm`, unit `charm*` |
| **Chuỗi 3 Đêm** | Menu → giới thiệu (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → màn Bình Minh với tổng điểm = tổng các Đêm thắng; thua → chơi lại Đêm đó | ảnh `web-menu.png`, `web-intro2.png`; chơi thử tay |
| **Tạm dừng** | Esc/P dừng hẳn logic; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. Headless: `pause` cạnh lên → `paused {}`, tick tăng, sim_tick/thời gian/spawn/TTL đứng; `state: "paused"`; nhấn lại → `resumed {}` | `p2-pause`, unit `pause*` |
| **Cài đặt** | Âm lượng và độ nhạy chuột, lưu trong `localStorage` (`ddl-settings`) | chơi thử tay |
| **Âm thanh** | Nhạc nền đêm + hiệu ứng: nhặt, thắp, tỏa sáng, bị đánh, nhảy*, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối | `src/web/sfx.js`; chơi thử tay |
| **HUD** | Lửa trên-trái; đồng hồ mm:ss trên-giữa (đỏ #FF5A5F + nhấp nháy khi ≤ 30 s); đèn k/n + điểm trên-phải; thanh 10 ô dưới-giữa; biểu tượng hồi chiêu Lướt/Tỏa Sáng dưới-phải; "E — Nạp ánh sáng (x/10)" gần đèn; mũi tên tới đèn chưa sáng gần nhất khi nó ngoài màn hình | ảnh `web-night*.png` |
| **Bảng màu** | Các thành phần liệt kê dùng đúng hex (`PAL` trong `src/web/world.js`, CSS `:root`) | mã nguồn |
| Ánh sáng môi trường | `ambient = 0.15 + 0.55 × lit/total` | `src/web/main.js` (draw) |
| Bản đồ chuẩn | Vị trí đèn, điểm sinh, cầu, bục nhảy, tầng, dốc, tháp đúng Phần 2 | unit `standard maps`, `night 3 terrain`, `launch pads`; `p2-night2-pad`, `p2-night3-pad` |
| Gió mạnh (Đêm 3) | Mỗi 1800 tick, kéo 300 tick, đẩy 2 m/s, hướng chọn trước 120 tick (lá bay + âm thanh) | `p2-night3-wind`, unit `wind` |
| Contract v1.1 | `--night 1..3`; snapshot có `night`, `wind`, `player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s`, `motes[kind,ttl_s]`, `drifters`, `charms`; sự kiện mới | `tests/headless.test.js` |
| Hiệu năng | 1 Đêm đầy đủ headless ≤ 30 s; web ≥ 30 FPS @1280×720 | `headless-perf.txt` (0.4–0.65 s), `fps.json` (≈ 115–119 FPS) |

\* Tiếng nhảy: hàm `sfx.jump()` có nhưng sự kiện nhảy không có trong contract; web phát khi Space được nhấn lúc chạm đất (xem mục 4).

## 3. Giả định cho chỗ ticket còn mơ hồ

| Chủ đề | Giả định |
|---|---|
| Xuất phát Đêm 3 | (0,0,0) nằm trong tháp chuông và dưới tầng 2 → chọn **(0,0,−16)** (tầng 0, phía z<0), quay mặt +Z |
| `spawning` | Kéo dài 60 tick; không di chuyển, không gây sát thương, vẫn bị Tỏa Sáng làm choáng |
| `wander` | Lượn 1.5 m/s quanh điểm "nhà" bán kính 5 m (điểm ngẫu nhiên theo seed). Shade trong scenario không ghi state: ≤ 12 m → chase, còn lại → wander |
| Độ cao shade | Tâm = mặt đất + độ lệch ban đầu (sinh ngẫu nhiên: +1 m). Chênh cao khi chạm = \|Y chân Mây − Y tâm shade\| |
| Recoil | Lùi tuyến tính đủ 2 m theo hướng từ Mây ra, trong 60 tick (không gây sát thương), rồi chase/wander theo khoảng cách |
| Đẩy khi bị Tỏa Sáng | 4/15 m mỗi tick trong 15 tick; "vật cản" = tháp chuông và mép vùng an toàn của đèn sáng |
| `player.invuln` | Boolean (đang bất tử); thêm `invuln_s` (giây còn lại) |
| `night_start` | Ghi ở tick 0, ngay sau snapshot 0 |
| Trần 30 đom đóm | Chỉ đếm đom đóm `random`; đom đóm `dropped` không tính |
| Gió Lạc | Lượn 2 m/s quanh nhà; sinh ở điểm sinh Bóng Mực ("điểm sương"); bay ở mặt đất + 1.5 m; chạm khi idle hoặc chase đều cướp (nếu mang > 0); Tỏa Sáng không ảnh hưởng con idle |
| Đom đóm Gió Lạc thả | Ở vị trí XZ của nó, trên mặt đất, kind `dropped`, TTL 480 |
| Điểm trong headless khi thua | `score` vẫn là điểm đang tích lũy của Đêm đó; "tổng điểm game" chỉ cộng các Đêm thắng (áp dụng ở bản web) |
| Tăng tốc / dừng | Tức thì (0 s ≤ 0.1 s) |
| Địa hình | Bước lên tối đa 0.4 m (để đi dốc); cao hơn là vách chặn; đi ra mép tầng thì rơi |
| Bục nhảy | Kích hoạt khi đang chạm đất, cách tâm ≤ 1 m và cùng độ cao |
| Gió | Hướng là số nguyên độ ngẫu nhiên, chọn ở tick 1680 + 1800k (báo trước 2 s); `dir_deg` giữ giá trị cuối cùng |
| Tick hồi sinh | Ở tick hết chờ, Mây xuất hiện ở điểm xuất phát; di chuyển từ tick sau |
| Scenario | `motes`: `[x,y,z]` hoặc `{pos, kind, ttl_ticks}`; `charms`: `{id, pos, available, respawn_ticks}` |

## 4. Kế hoạch kiểm chứng (viết trước khi code giao diện)

1. Unit test logic thuần cho từng luật số (`tests/sim.test.js`, 30 test).
2. CLI test cho contract v1.1 (`tests/headless.test.js`, 9 test).
3. Ít nhất 1 scenario headless cho mỗi tính năng mới, kỳ vọng tính tay, chạy 2 lần so tất định (`npm run proof -- phase-2`, 21 case).
4. Ảnh chụp web 3 Đêm + đo FPS thật (`npm run bench`).

## 5. Nhật ký dùng AI (Phase 2)

| Bước | Việc | Kết quả / tôi kiểm tra |
|---|---|---|
| 1 | Dán Ticket-02, "làm phase 2 đi, không được tự ý push" | Agent đọc ticket, viết lại sim theo 12 bước, maps.js theo Phần 2 |
| 2 | Probe vật lý trước khi viết test: bục nhảy Đêm 2 bay 84 tick đáp đảo B; bục Đêm 3 đáp tầng 2; dốc lên tầng 1; vách chặn | Khớp tính tay (2×14/20 = 1.4 s) |
| 3 | 5 unit test đỏ lần đầu | **Lỗi của AI ở test, không phải code**: đếm lệch 1 tick (stun, TTL), quên shade đã tiến 1 bước trước khi chạm (bước 8 trước bước 9), tick hồi sinh. Một test ("no_flames thắng all_lit") không dựng được vì vùng an toàn đẩy shade ra; đã bỏ và ghi lý do trong test |
| 4 | 2 case proof đỏ | **Lỗi của AI**: kỳ vọng `dash_cd_s` 1.3 (đúng là 1.317, 79 tick) và vị trí đáp bục nhảy chép phỏng chừng từ probe thay vì tính. Đã tính lại tay: 83 tick × 0.4 m = 33.2 m → (51.237, 6.755) |
| 5 | Heredoc bash dài lỗi parse | Chuyển script sinh case thành file `tools/mkcases.py` (tái lập được) |
| 6 | Đo FPS: Chrome headless `--timeout` không chờ thời gian thật | Viết `tools/bench.js` (puppeteer-core điều khiển Chrome thật, 10 s mỗi Đêm) |

Ước tính token Phase 2: khoảng 250–300k (ticket dài, sim viết lại toàn bộ, web viết lại). Tiết kiệm: viết file trọn vẹn một lần, probe nhỏ trước khi viết test, đầu ra test luôn lọc `not ok`, không dùng subagent.

## 6. Đánh giá Phase 2

- Đạt: mọi tiêu chí ở mục 2 (headless + ảnh + FPS). Chuỗi Đêm, tạm dừng, cài đặt, âm thanh kiểm bằng chơi tay.
- Phase 1 không bị hỏng: các case Phase 1 vẫn chạy, kỳ vọng được tính lại với số chuẩn (lý do ghi trong `why`).
- Rủi ro với test ẩn: các giả định ở mục 3 (đặc biệt xuất phát Đêm 3, thời lượng `spawning`, định dạng `invuln`).
- Harness: AGENTS.md cập nhật thứ tự tick + quy tắc "tính tay, không chép output"; skill verify-headless thêm hướng dẫn `snapshots`/`event_names` và `npm run bench`.
