# ADR 0001 — Mô hình trạng thái đèn có nhiên liệu và luật thắng lúc bình minh

- Trạng thái: **Chấp nhận** (Phase 3, Ticket-03 "Đèn cạn dầu")
- Thay thế: luật Ticket-02 "đèn đã sáng không nhận thêm đom đóm", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi tất cả đèn sáng", và công thức điểm cũ.

## Bối cảnh

Đến Phase 2, đèn chỉ có 2 trạng thái một chiều: `tắt → sáng`. Khi đã sáng, đèn không đổi nữa, và thắp hết đèn là thắng ngay. Ticket-03 muốn đèn sáng rồi vẫn có thể tắt, và mục tiêu đổi thành "giữ đảo sáng tới bình minh".

## Quyết định

1. **Đèn là máy trạng thái 2 chiều, kèm dữ liệu:**

   ```
   UNLIT(deposited, ever_lit)
      --nạp đủ cost--> LIT(fu = FU_MAX)          cost = 10 nếu chưa từng sáng, 5 nếu ever_lit
   LIT(fu)
      --tick (bước 2)--> fu -= 1 + 5 × số Bóng Mực đang drain đèn này
      --fu <= 0 (ngay sau bước 2)--> UNLIT(deposited = 0, ever_lit = true)   + lantern_out
      --Tương tác--> fu = min(max, fu + 600 × used)                          + refuel
   ```

   Vùng an toàn không còn gắn với `lit` mà gắn với vị từ `hasZone(l) = lit && fu >= 30·60`. Đúng 30 vẫn còn vùng.

2. **Nhiên liệu lưu bằng số nguyên, đơn vị 1/60.**
   - `fu = fuel × 60`, nên hao 1/s là −1 mỗi tick và bị hút 5/s là −5 mỗi tick.
   - Tránh hoàn toàn sai số số thực, giữ tính tất định. Chỉ làm tròn 1 chữ số thập phân khi xuất snapshot.

3. **Bóng Mực có thêm trạng thái `drain`:**
   - `wander → drain`: khi Bóng Mực cách đèn yếu mục tiêu ≤ 2 m.
   - `drain → chase`: khi Mây vào trong 6 m.
   - `drain → wander`: khi đèn tắt, được châm lên ≥ 30, Bóng Mực cách đèn > 2 m, hoặc bị đẩy ra khỏi vùng.
   - `drain → stunned`: khi trúng Tỏa Sáng; hết choáng thì luôn về `wander`.
   - Logic chọn mục tiêu nằm gọn trong `wanderMove()`: ưu tiên đèn yếu gần nhất (bằng nhau thì id nhỏ hơn), không có thì đèn tắt gần nhất.

4. **Luật thắng chuyển từ "sự kiện" sang "điều kiện tại bình minh":**
   - Bước 11 không còn kiểm tra "mọi đèn sáng".
   - Ở tick có `sim_tick ≥ endSim`: hết lửa thì `no_flames`; số đèn sáng ≥ `ceil(win_ratio × n)` thì `dawn_survived`; còn lại thì `dawn`.
   - Thưởng bình minh được cộng sau khi đã xác định thắng.

5. **Điểm và tham số đều vào `game.contract.json`:** thêm `per_relight`, `per_stun_draining`, `per_lit_lantern_dawn`; `per_second_left = 0`. Sim chỉ đọc từ tuning, không hard-code.

## Hệ quả

- **Tích cực:**
  - Thay đổi gói trong `sim.js`, khoảng 120 dòng.
  - Headless CLI, validate và web chỉ cần thêm trường.
  - Mọi luật mới đều có unit test và case headless tính tay.
- **Đánh đổi:**
  - Thứ tự tick tạo ra hệ quả hơi lạ. Đèn đặt `lit` với fuel 100 bị hao ngay ở bước 2, nên khi người chơi tương tác, đèn không bao giờ còn "đầy". Vì vậy châm dầu luôn dùng ít nhất 1 đom đóm.
  - Tôi giữ đúng thứ tự trong ticket và ghi lại điều này, chứ không thêm ngoại lệ.
- **Test cũ bị thay:** xem [CHANGELOG.md](../../CHANGELOG.md) và [docs/notes/phase-3.md](../notes/phase-3.md). Không test nào bị skip.

## Phương án đã cân nhắc

- **Fuel dạng float, làm tròn mỗi tick:** loại, vì dễ lệch 1 tick khi so với test ẩn, và ticket đã khuyên dùng đơn vị 1/60.
- **Thêm trạng thái đèn `low`:** loại. `low` chỉ là một vị từ trên `fu`; tách thành trạng thái riêng sẽ phải đồng bộ hai chỗ.
