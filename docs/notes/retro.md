# Retro — Đảo Đèn Lồng (Day 12 AI SDLC, 4 phase)

## 1. Tổng hợp đánh giá 4 phase

| Phase | Yêu cầu | Kết quả | Test của tôi | Ghi chú |
|---|---|---|---|---|
| 1 — PRD-0 | Đêm 1 chơi được, headless v1.0 | Đạt | 28 test, 6 case | Tự chọn tuning; các giả định ghi trong `phase-1.md` |
| 2 — Ticket-02 | Số chuẩn, 3 Đêm, 6 tính năng mới, v1.1 | Đạt | 39 test, 21 case | Viết lại sim theo đúng 12 bước của tick; FPS khoảng 115 |
| 3 — Ticket-03 | Dầu đèn, `drain`, thắng lúc bình minh, v1.2 | Đạt | 48 test, 29 case | 4 test và 5 case được sửa có lý do; có ADR và CHANGELOG |
| 4 — Ticket-04 | Bench, soak, bảng xếp hạng, accessibility, release, v1.3 | Đạt (video do tôi tự quay) | 56 test, 29 case | Bench khoảng 130–190 FPS, soak ×1.05 RSS |

Phase sau không làm hỏng phase trước. Mỗi lần ticket thay luật, tôi chạy lại toàn bộ case cũ. Những case đỏ đều là case có luật bị ticket thay thế, và mỗi case như vậy được cập nhật kèm lý do. Không test nào bị skip.

## 2. Điều hiệu quả khi làm với AI
- **Tách sim thuần khỏi renderer ngay từ Phase 1.** Nhờ vậy headless, test, bench và soak dùng chung đúng một đoạn mã, và mỗi ticket chỉ phải sửa `src/sim/`.
- **Viết kỳ vọng bằng tay trước, rồi mới chạy.** Phép tính được ghi vào trường `why` của case, ví dụ `5.05 − 46 × 0.0667 ≤ 2 → drain ở tick 46`. Cách này bắt được lỗi thật mà test "chép output" sẽ bỏ qua.
- **Probe nhỏ trước khi viết test** cho vật lý bục nhảy, dốc và vách, giúp tránh viết test sai từ đầu.
- **Patch bằng script có `assert` chuỗi gốc tồn tại.** Nếu agent sửa sai chỗ, patch fail ngay thay vì âm thầm sửa nhầm.
- **Mỗi phase để lại một bộ bằng chứng chạy lại được** (`npm run proof -- phase-N`, ảnh, `fps.json`).

## 3. Điều không hiệu quả
- Heredoc bash dài trên Windows hay lỗi parse, nên tôi chuyển sang file Python trong scratchpad.
- Đo FPS bằng Chrome headless kèm `--timeout` không chờ theo thời gian thật. Mất một vòng trước khi chuyển sang puppeteer-core.
- Ở Phase 3, agent tự commit kèm dòng Co-Authored-By. Từ Phase 4, tôi giữ quyền commit (luật này đã ghi trong AGENTS.md và bộ nhớ của agent).

## 4. Những lần AI sai và cách tôi phát hiện

| Phase | Lỗi | Phát hiện bằng | Sửa harness |
|---|---|---|---|
| 1 | `dt` âm trong Chrome headless làm Mây biến mất | Xem ảnh chụp | Kẹp `dt`; ghi vào nhật ký |
| 1 | `node --test tests/` không chạy trên Node 22 | Chạy thật | Đổi script test |
| 2 | Đếm lệch 1 tick (stun, TTL, tick hồi sinh), quên rằng bước 8 chạy trước bước 9 | Test đỏ, đối chiếu thứ tự tick | AGENTS.md: dòng nhắc "off-by-one, phase 2/8/9" |
| 2 | Kỳ vọng vị trí bục nhảy chép phỏng chừng từ probe | Case proof đỏ, tính lại tay (83 tick × 0.4 m) | Skill: "never copy expectations from output" |
| 3 | `wanderMove(s, sv)` chia tốc độ cho 60 hai lần, Bóng Mực gần như đứng yên | Test tính tay `drain ở tick 46` đỏ | AGENTS.md: "helpers take m/s" |
| 3 | `bench.js` ghi file bằng `'${PHASE}'` (nháy đơn) | Lỗi ENOENT khi chạy | Chạy lại đo thật, không ghi tay |
| 4 | Soak vượt 1.2× RSS | Đo RSS và heap từng Đêm (`tools/memprobe.js`): heap phẳng, RSS là mã JIT | Dùng `--lite-mode`, ghi rõ trong README |
| 4 | Thêm trùng nhánh `case` khi vá event | Tự rà lại patch trước khi chạy | — |

## 5. Harness nào giúp nhiều nhất
1. **Stop hook** (`.claude/hooks/tests-green.js`) chạy toàn bộ test và proof, chặn agent kết thúc khi đỏ (exit 2). Đã thử bằng cách đổi `player_speed`, xem `docs/proof/phase-1/hook-blocks.txt`.
2. **`tools/proof.js` + `tools/mkcases.py`:** case có kỳ vọng tính tay, mỗi case chạy 2 lần để kiểm tra tất định. Đây là nguồn bằng chứng chính cho mọi phase.
3. **AGENTS.md** được cập nhật qua từng phase (lịch sử git có đủ): thứ tự tick, đơn vị dầu, quy tắc tốc độ, không commit.
4. **Skill `verify-headless`:** quy trình thêm case, chụp ảnh, đo FPS.
5. **CI GitHub Actions** chạy test và proof trên Ubuntu và macOS mỗi lần push.

## 6. Token và chi phí ước tính

| Phase | Ước tính token | Ghi chú |
|---|---|---|
| 1 | khoảng 150–200k | Đọc tài liệu lab và viết sim, web, test lần đầu |
| 2 | khoảng 250–300k | Ticket dài; viết lại sim và web |
| 3 | khoảng 120–150k | Patch có kiểm tra, chỉ đọc đoạn cần sửa |
| 4 | khoảng 200–250k | Bench, soak, bảng xếp hạng, accessibility, tài liệu |
| **Tổng** | **khoảng 0.75–0.9 triệu token** | Ước lượng theo độ dài hội thoại; dùng một agent, không dùng subagent |

Cách tôi tiết kiệm token:
- Đầu ra test luôn được lọc (`grep not ok|pass|fail`).
- Viết file trọn vẹn một lần thay vì sửa nhiều vòng.
- Patch nhiều chỗ bằng một script.
- Chỉ đọc lại đúng đoạn code cần sửa.
- Không chạy agent song song.

## 7. Nếu làm lại
- Dựng sẵn khung "patch + proof case + ảnh" ngay từ Phase 1 thay vì Phase 2; đặt luật "không tự commit" ngay từ đầu.
- Viết sim theo thứ tự tick dạng pipeline có tên bước ngay từ đầu, để Phase 2–3 chỉ phải chèn bước.
- Dùng InstancedMesh cho Bóng Mực và đom đóm để bench còn dư nhiều hơn trên máy yếu.
- Thêm test end-to-end UI tự động (puppeteer) cho tạm dừng, bảng xếp hạng và đổi phím, thay vì chỉ chụp ảnh và chơi tay.
