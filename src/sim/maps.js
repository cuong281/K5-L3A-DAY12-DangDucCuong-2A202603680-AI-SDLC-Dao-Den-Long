// Standard maps (Ticket-02 Part 2). Angles: from +X toward +Z (x = r cos a, z = r sin a).
const rad = (d) => (d * Math.PI) / 180;
const ring = (n, r, start, step, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = rad(start + step * i);
    return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
  });

// Night 3 terrain helpers
const RAMPS = [30, 150].map((d) => [Math.cos(rad(d)), Math.sin(rad(d))]);
function night3Ground(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  let h = 0;
  if (r >= 12 && r <= 24 && z > 0) h = 3;
  if (r <= 8) h = 6;
  for (const [ux, uz] of RAMPS) {
    const t = x * ux + z * uz; // along ramp axis
    const perp = Math.abs(x * uz - z * ux);
    if (t >= 24 && t <= 30 && perp <= 1.5) h = Math.max(h, (3 * (30 - t)) / 6);
  }
  return h;
}

export const NIGHTS = {
  1: {
    name: 'Đảo Bến',
    durationKey: 'night1_duration_s',
    start: [0, 0, 0],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
    shadePoints: ring(12, 37, 15, 30),
    shadeEvery: 480,
    shadeMax: 6,
    shadeSpeed: null, // = tuning.shade_speed
    charms: [],
    drifters: false,
    wind: false,
    pads: [],
    tower: null,
    ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  },
  2: {
    name: 'Đảo Cau',
    durationKey: 'night2_duration_s',
    start: [0, 0, 0],
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [
      ...ring(4, 10, 0, 90), ...ring(8, 22, 0, 45),
      ...ring(4, 10, 0, 90, 0, 70), ...ring(8, 22, 0, 45, 0, 70),
    ],
    shadePoints: [...ring(8, 26, 22.5, 45), ...ring(8, 26, 22.5, 45, 0, 70)],
    shadeEvery: 420,
    shadeMax: 8,
    shadeSpeed: null,
    charms: [[35, 0, 0]],
    drifters: true,
    wind: false,
    pads: [
      { pos: [20, 0, 18], vy: 14, vh: 24, toward: [70, 0] },
      { pos: [50, 0, -18], vy: 14, vh: 24, toward: [0, 0] },
    ],
    tower: null,
    ground: (x, z) =>
      Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28 || (x >= 26 && x <= 44 && z >= -2 && z <= 2) ? 0 : null,
  },
  3: {
    name: 'Đảo Chuông',
    durationKey: 'night3_duration_s',
    start: [0, 0, -16], // (0,0,0) is inside the bell tower; see docs/notes/phase-2.md
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(18, 34, 0, 20), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)],
    shadePoints: ring(16, 43, 0, 22.5),
    shadeEvery: 360,
    shadeMax: 10,
    shadeSpeed: 4.5,
    charms: [[30, 0, 25], [-30, 0, 25]],
    drifters: true,
    wind: true,
    pads: [{ pos: [0, 3, 13], vy: 12, vh: 8, dir: [0, -1] }],
    tower: { x: 0, z: 0, r: 2, top: 14 },
    ground: night3Ground,
  },
};
