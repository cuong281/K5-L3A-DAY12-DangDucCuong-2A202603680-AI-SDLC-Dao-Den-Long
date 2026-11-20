# Generates scenarios/<case>/ (scenario.json, inputs.json, case.json with hand-computed expectations).
# Usage: python tools/mkcases.py scenarios
import json, os, sys
os.chdir(sys.argv[1])
Q = {"random_motes": False, "random_shades": False, "random_drifters": False, "wind_enabled": False, "motes": []}
def case(name, case, scenario=None, inputs=None):
    os.makedirs(name, exist_ok=True)
    for f in ('scenario.json', 'inputs.json'):
        if os.path.exists(os.path.join(name, f)): os.remove(os.path.join(name, f))
    json.dump(case, open(f"{name}/case.json", "w", encoding="utf8"), ensure_ascii=False, indent=1)
    if scenario is not None: json.dump(scenario, open(f"{name}/scenario.json", "w"), indent=1)
    if inputs is not None: json.dump(inputs, open(f"{name}/inputs.json", "w"), indent=1)
def q(**kw):
    d = dict(Q); d.update(kw); return d

# ---- Phase 1 cases, re-derived for Ticket-02 standard numbers ----
case("contract-example", {"seed": 1, "ticks": 400,
 "why": "[P2 cập nhật] Ví dụ trong Test Contract. pickup 1.0 m -> đom đóm ở z=5 được nhặt khi z>=4.0, tức sau 40 bước (tick 40). Tỏa sáng ở tick 200 KHÔNG kích hoạt vì chỉ mang 1 < pulse_cost 3 (P1: tick 38 và có pulse).",
 "expect": {"events": [{"tick": 40, "name": "mote_picked", "data": {"carried": 1}}], "no_events": ["pulse"]}},
 {"player": {"pos": [0, 0, 0], "carried": 0, "flames": 3}, "random_motes": False, "random_shades": False, "motes": [[0, 0, 5]], "shades": [{"pos": [10, 0, 0]}], "lanterns": [{"id": "L1", "pos": [0, 0, 25], "deposited": 0}], "time_left_s": 300},
 {"frames": [{"tick": 0, "move": [0, 1], "cam_yaw_deg": 0}, {"tick": 120, "move": [0, 0], "interact": True}, {"tick": 121, "interact": False}, {"tick": 200, "pulse": True}, {"tick": 201, "pulse": False}]})
case("win-all-lit", {"seed": 1, "ticks": 100,
 "why": "[P2 cập nhật: lantern_cost 10, điểm theo đom đóm nạp] L1-L4 sáng sẵn (không cộng điểm), đứng ở L5 chuẩn mang 10, nhấn E ở tick 0 -> thắng tick 1. Điểm = 10x10 + 100 + 2xfloor((18000-1)/60)=598 + 50x3 = 948.",
 "expect": {"end": {"state": "won", "ticks": 1, "score": 948}, "events": [{"tick": 1, "name": "deposit", "data": {"lantern_id": "L5", "amount": 10, "deposited": 10}}, {"tick": 1, "name": "game_over", "data": {"result": "won", "reason": "all_lit"}}]}},
 q(player={"pos": [-23.8, 0, 7.7], "carried": 10}, lanterns=[{"id": i, "lit": True} for i in ["L1", "L2", "L3", "L4"]]),
 {"frames": [{"tick": 0, "interact": True}]})
case("lose-dawn", {"seed": 1, "ticks": 1000, "why": "Hết giờ (2 s = 120 tick) -> thua dawn ở tick 120, dừng sớm.",
 "expect": {"end": {"state": "lost", "ticks": 120, "score": 0}, "events": [{"tick": 120, "name": "game_over", "data": {"result": "lost", "reason": "dawn"}}]}},
 q(time_left_s=2))
case("lose-no-flames", {"seed": 1, "ticks": 1000,
 "why": "[P2 cập nhật: shade 4 m/s] Bóng Mực cách 5.03 m (trong 12 m nên chase ngay), 4/60 m/tick, chạm khi <= 1 m: 5.03-61x0.0667=0.963 -> tick 61. Mất lửa cuối -> no_flames; rơi floor(4/2)=2.",
 "expect": {"end": {"state": "lost", "ticks": 61}, "events": [{"tick": 61, "name": "player_hit", "data": {"by": "shade", "flames": 0, "dropped": 2}}, {"tick": 61, "name": "game_over", "data": {"result": "lost", "reason": "no_flames"}}]}},
 q(player={"flames": 1, "carried": 4}, shades=[{"id": "S9", "pos": [5.03, 0, 0]}]))
case("safe-radius", {"seed": 1, "ticks": 1200, "snapshot_every": 600,
 "why": "[P2 cập nhật: shade ở 10 m để nó chase; vùng an toàn chặn đúng ở mép 6 m] Người chơi đứng tại đèn đã sáng. Bóng Mực bị chặn ở (6,0,0), không chạm được trong 20 s. Đèn đặt sẵn không cộng điểm.",
 "expect": {"end": {"state": "playing", "ticks": 1200, "score": 0}, "no_events": ["player_hit", "lantern_lit"], "snapshots": [{"tick": 600, "match": {"shades": [{"id": "S1", "pos": [6, 0, 0], "state": "chase"}], "player": {"flames": 3}}}]}},
 q(shades=[{"id": "S1", "pos": [10, 0, 0]}], lanterns=[{"id": "L1", "pos": [0, 0, 0], "lit": True}]))
case("full-night-idle", {"seed": 7, "ticks": 18000, "snapshot_every": 600,
 "why": "[P2 cập nhật] Đêm 1 đầy đủ, sinh ngẫu nhiên, đứng yên ở tâm: Bóng Mực sinh ở bán kính 37 m, chỉ phát hiện trong 12 m nên không tới -> thua dawn ở tick 18000. Kiểm tra tất định và id tự sinh.",
 "expect": {"end": {"state": "lost", "ticks": 18000}, "events": [{"tick": 300, "name": "shade_spawned", "data": {"id": "S1"}}, {"tick": 300, "name": "shade_spawned", "data": {"id": "S2"}}, {"tick": 2220, "name": "shade_spawned", "data": {"id": "S6"}}, {"tick": 18000, "name": "game_over", "data": {"result": "lost", "reason": "dawn"}}]}})

# ---- Phase 2: one or more per new feature ----
case("p2-dash", {"seed": 1, "ticks": 120, "snapshot_every": 12,
 "why": "Lướt đứng yên -> theo hướng mặt +Z, 14 m/s x 12 tick = 2.8 m (tick 12); hồi chiêu còn 90-11=79 tick = 1.317 s. Nhấn lại ở tick 30: còn hồi chiêu -> bỏ qua. Hồi chiêu 90 tick tính từ lúc bắt đầu -> nhấn ở tick 90 được (sự kiện tick 91). Tổng 5.6 m.",
 "expect": {"event_names": ["1:dash", "91:dash"], "snapshots": [{"tick": 12, "match": {"player": {"pos": [0, 0, 2.8], "dash_cd_s": 1.317}}}, {"tick": 108, "match": {"player": {"pos": [0, 0, 5.6]}}}]}},
 q(), {"frames": [{"tick": 0, "dash": True}, {"tick": 1, "dash": False}, {"tick": 30, "dash": True}, {"tick": 31, "dash": False}, {"tick": 90, "dash": True}, {"tick": 91, "dash": False}]})
case("p2-charm", {"seed": 1, "night": 2, "ticks": 61, "snapshot_every": 1,
 "why": "Bùa C1 ở (35,0,0) trên cầu. Bước 0 đi 6 m/s tới x=34.1 rồi nhặt (khoảng cách 0.9) -> charm_picked tick 1 (600 tick). Từ bước 1 tốc độ 7.2 m/s: tick 61 x = 34.1 + 60x0.12 = 41.3. Bùa xuất hiện lại sau 2700 tick = 45 s.",
 "expect": {"events": [{"tick": 1, "name": "charm_picked", "data": {"charm_id": "C1", "charm_ticks": 600}}], "snapshots": [{"tick": 1, "match": {"charms": [{"id": "C1", "available": False, "respawn_s": 45}], "player": {"charm_s": 10}}}, {"tick": 61, "match": {"player": {"pos": [41.3, 0, 0]}}}]}},
 q(player={"pos": [34, 0, 0]}), {"frames": [{"tick": 0, "move": [1, 0]}]})
case("p2-pulse", {"seed": 1, "ticks": 130, "snapshot_every": 1,
 "why": "Mang 3, S1 cách tâm tỏa sáng (chân+0.8) 3.0 m -> choáng; S2 cách 5.85 m theo 3D (dù XZ chỉ 4.9 m) -> không. S1 bị đẩy 4 m trong 15 tick (x 3->7), choáng tới hết tick 120, tick 121 chuyển chase (cách 7 m < 12). Điểm +5.",
 "expect": {"events": [{"tick": 1, "name": "pulse", "data": {"stunned_ids": ["S1"]}}], "snapshots": [{"tick": 15, "match": {"shades": [{"id": "S1", "pos": [7, 1, 0], "state": "stunned"}], "score": 5, "player": {"carried": 0, "pulse_cd_s": 2.767}}}, {"tick": 120, "match": {"shades": [{"id": "S1", "state": "stunned"}]}}, {"tick": 121, "match": {"shades": [{"id": "S1", "state": "chase"}]}}]}},
 q(player={"carried": 3}, shades=[{"id": "S1", "pos": [3, 1, 0], "state": "wander"}, {"id": "S2", "pos": [4.9, 4, 0], "state": "wander"}]), {"frames": [{"tick": 0, "pulse": True}]})
case("p2-shade-hit", {"seed": 1, "ticks": 400, "snapshot_every": 1,
 "why": "S1 (1,1,0) và S2 (-1,1,0) cùng chạm ở bước 0: chỉ mất 1 lửa (S1, id nhỏ). Rơi floor(5/2)=2 đom đóm (dropped, ttl 8 s). S1 recoil 2 m trong 60 tick, bất tử 90 tick; chạm lại ở tick 91 và 181 -> hết lửa, thua no_flames tick 181.",
 "expect": {"end": {"state": "lost", "ticks": 181}, "event_names": ["1:player_hit", "91:player_hit", "181:player_hit", "181:game_over"], "events": [{"tick": 1, "name": "player_hit", "data": {"by": "shade", "flames": 2, "dropped": 2}}, {"tick": 91, "name": "player_hit", "data": {"by": "shade", "flames": 1, "dropped": 1}}], "snapshots": [{"tick": 1, "match": {"player": {"carried": 3, "invuln": True}, "shades": [{"id": "S1", "state": "recoil"}], "motes_active": 2}}, {"tick": 60, "match": {"shades": [{"id": "S1", "pos": [2.933, 1, 0], "state": "recoil"}]}}]}},
 q(player={"carried": 5}, shades=[{"id": "S1", "pos": [1, 1, 0], "state": "chase"}, {"id": "S2", "pos": [-1, 1, 0], "state": "chase"}]))
case("p2-fall", {"seed": 1, "ticks": 140, "snapshot_every": 10,
 "why": "Đi +Z từ z=38.95: ra ngoài bán kính 40 ở bước 10, rơi 60 tick tới Y<-10 -> player_hit fall tick 70 (bỏ qua bất tử 500), mất 4 đom đóm. Chờ 60 tick, hồi sinh tại (0,0,0) ở tick 130 với bất tử 90; tick 140 đã đi được 1.0 m.",
 "expect": {"event_names": ["70:player_hit"], "events": [{"tick": 70, "name": "player_hit", "data": {"by": "fall", "flames": 2, "dropped": 0, "lost": 4}}], "snapshots": [{"tick": 100, "match": {"player": {"carried": 0, "flames": 2}}}, {"tick": 130, "match": {"player": {"pos": [0, 0, 0], "invuln": True, "vel": [0, 0, 0]}}}, {"tick": 140, "match": {"player": {"pos": [0, 0, 1]}}}]}},
 q(player={"pos": [0, 0, 38.95], "carried": 4, "invuln_ticks": 500}), {"frames": [{"tick": 0, "move": [0, 1]}]})
case("p2-fall-last-flame", {"seed": 1, "ticks": 300, "why": "Rơi khi chỉ còn 1 lửa -> thua ngay no_flames ở tick 70, không hồi sinh.",
 "expect": {"end": {"state": "lost", "ticks": 70}, "event_names": ["70:player_hit", "70:game_over"]}},
 q(player={"pos": [0, 0, 38.95], "flames": 1}), {"frames": [{"tick": 0, "move": [0, 1]}]})
case("p2-drifter-steal", {"seed": 1, "night": 2, "ticks": 400, "snapshot_every": 4,
 "why": "Gió Lạc D1 idle cách 10 m; Mây mang 6 (>=5, <=15 m) -> chase 7 m/s. Chạm khi <=1.2 m: 8.8/(7/60)=75.4 -> tick 76, cướp min(3,6)=3 dù Mây đang bất tử. Flee 240 tick -> removed ở tick 316. Không mất lửa.",
 "expect": {"events": [{"tick": 76, "name": "drifter_steal", "data": {"drifter_id": "D1", "amount": 3, "carried": 3}}], "no_events": ["player_hit"], "snapshots": [{"tick": 4, "match": {"drifters": [{"id": "D1", "state": "chase"}]}}, {"tick": 312, "match": {"drifters": [{"id": "D1", "state": "flee", "stolen": 3}]}}, {"tick": 316, "match": {"drifters": [{"id": "D1", "state": "removed"}], "player": {"flames": 3, "carried": 3}}}]}},
 q(player={"carried": 6, "invuln_ticks": 600}, drifters=[{"id": "D1", "pos": [10, 1.5, 0]}]))
case("p2-drifter-pulse", {"seed": 1, "night": 2, "ticks": 250, "snapshot_every": 1,
 "why": "Tỏa sáng trúng D1 (flee, đang mang 2) -> thả 2 đom đóm rơi tại chỗ, biến mất sau 120 tick (tick 121). Trúng D2 đang chase -> flee không cướp, biến mất sau 240 tick (tick 241).",
 "expect": {"events": [{"tick": 1, "name": "drifter_drop", "data": {"drifter_id": "D1", "amount": 2}}, {"tick": 1, "name": "pulse", "data": {"stunned_ids": []}}], "no_events": ["drifter_steal"], "snapshots": [{"tick": 1, "match": {"drifters": [{"id": "D1", "state": "flee", "stolen": 0}, {"id": "D2", "state": "flee", "stolen": 0}], "motes_active": 2}}, {"tick": 120, "match": {"drifters": [{"id": "D1", "state": "flee"}]}}, {"tick": 121, "match": {"drifters": [{"id": "D1", "state": "removed"}]}}, {"tick": 241, "match": {"drifters": [{"id": "D2", "state": "removed"}], "player": {"carried": 3}}}]}},
 q(player={"carried": 6}, drifters=[{"id": "D1", "pos": [2, 1.5, 0], "state": "flee", "stolen": 2}, {"id": "D2", "pos": [-3, 1.5, 0], "state": "chase"}]), {"frames": [{"tick": 0, "pulse": True}]})
case("p2-pause", {"seed": 1, "ticks": 100, "snapshot_every": 10,
 "why": "Tạm dừng ở tick 10 tới tick 70: tick tăng nhưng sim_tick, thời gian, vị trí đứng yên; state paused. Tick 100: sim_tick 40, z = 4.0, time_left 300-40/60.",
 "expect": {"event_names": ["11:paused", "71:resumed"], "snapshots": [{"tick": 60, "match": {"state": "paused", "sim_tick": 10, "time_left_s": 299.833, "player": {"pos": [0, 0, 1]}}}, {"tick": 100, "match": {"state": "playing", "sim_tick": 40, "time_left_s": 299.333, "player": {"pos": [0, 0, 4]}}}]}},
 q(), {"frames": [{"tick": 0, "move": [0, 1]}, {"tick": 10, "pause": True}, {"tick": 11, "pause": False}, {"tick": 70, "pause": True}, {"tick": 71, "pause": False}]})
case("p2-safe-expel", {"seed": 1, "ticks": 300, "snapshot_every": 30,
 "why": "Bóng Mực ở trong 6 m khi L1 vừa thắp -> bị đẩy ra mép trong 30 tick (tới (0,1,19) ở tick 30), không gây sát thương. Sau đó bị chặn ở mép. Điểm 10x10+100=200.",
 "expect": {"events": [{"tick": 1, "name": "deposit", "data": {"lantern_id": "L1", "amount": 10, "deposited": 10}}, {"tick": 1, "name": "lantern_lit", "data": {"lantern_id": "L1"}}], "no_events": ["player_hit"], "snapshots": [{"tick": 30, "match": {"shades": [{"id": "S1", "pos": [0, 1, 19]}], "score": 200}}, {"tick": 300, "match": {"player": {"flames": 3}}}]}},
 q(player={"pos": [0, 0, 23.5], "carried": 10}, shades=[{"id": "S1", "pos": [0, 1, 22]}]), {"frames": [{"tick": 0, "interact": True}]})
case("p2-spawn-schedule", {"seed": 3, "ticks": 1500, "snapshot_every": 240,
 "why": "Đêm 1 mặc định: 20 đom đóm lúc đầu, +1 mỗi 240 tick tới hết 24 điểm (tick 960). Bóng Mực: 2 con tick 300 (S1,S2), +1 mỗi 480 tick (S3 tick 780, S4 tick 1260).",
 "expect": {"event_names": ["300:shade_spawned", "300:shade_spawned", "780:shade_spawned", "1260:shade_spawned"], "snapshots": [{"tick": 0, "match": {"motes_active": 20}}, {"tick": 240, "match": {"motes_active": 21}}, {"tick": 960, "match": {"motes_active": 24}}, {"tick": 1440, "match": {"motes_active": 24}}]}})
case("p2-night2-pad", {"seed": 1, "night": 2, "ticks": 90, "snapshot_every": 84,
 "why": "Đứng lên bục (20,0,18): bay Y 14 m/s, ngang 24 m/s về tâm đảo B; 2x14/20 = 1.4 s = 84 tick. Phóng ở cuối bước 0 nên bay ngang 83 tick x 0.4 m = 33.2 m theo (50,-18)/53.14 -> đáp (51.237, 0, 6.755) trong đảo B.",
 "expect": {"no_events": ["player_hit"], "snapshots": [{"tick": 84, "match": {"player": {"grounded": True, "flames": 3, "pos": [51.237, 0, 6.755]}}}]}},
 q(player={"pos": [20, 0, 18]}))
case("p2-night3-pad", {"seed": 1, "night": 3, "ticks": 60, "snapshot_every": 60,
 "why": "Bục (0,3,13) ở tầng 1: Y 12 m/s, ngang 8 m/s hướng -Z -> đáp lên tầng 2 (Y=6, r<8).",
 "expect": {"no_events": ["player_hit"], "snapshots": [{"tick": 60, "match": {"player": {"grounded": True, "pos": [0, 6, 6.467]}}}]}},
 q(player={"pos": [0, 3, 13]}))
case("p2-night3-wind", {"seed": 5, "night": 3, "ticks": 2160, "snapshot_every": 60,
 "why": "Đêm 3: gió mỗi 30 s (tick 1800) kéo 5 s (tới tick 2100), hướng báo trước 2 s (tick 1680).",
 "expect": {"snapshots": [{"tick": 1620, "match": {"wind": {"active": False, "dir_deg": None}}}, {"tick": 1740, "match": {"wind": {"active": False}}}, {"tick": 1800, "match": {"wind": {"active": True}}}, {"tick": 2040, "match": {"wind": {"active": True}}}, {"tick": 2100, "match": {"wind": {"active": False}}}]}},
 q(wind_enabled=True))
case("p2-night3-win-dawn-tick", {"seed": 1, "night": 3, "ticks": 10,
 "why": "Thắng kể cả đúng tick hết giờ: time_left 1/60, thắp đèn cuối L7 ở bước 0 -> won (không phải dawn). Điểm 100+100+0+150=350.",
 "expect": {"end": {"state": "won", "ticks": 1, "score": 350}, "events": [{"tick": 1, "name": "game_over", "data": {"result": "won", "reason": "all_lit"}}]}},
 q(player={"pos": [-20, 0, -34], "carried": 10}, lanterns=[{"id": f"L{i}", "lit": True} for i in range(1, 7)], time_left_s=1/60), {"frames": [{"tick": 0, "interact": True}]})
print("ok")
