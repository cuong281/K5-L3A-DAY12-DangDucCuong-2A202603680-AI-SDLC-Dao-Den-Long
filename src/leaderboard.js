// Local leaderboard rules (Ticket-04 §3), shared by the web client and the Node server (play.js).
export const MAX_ENTRIES = 10;
// 3–12 chars of [A-Za-z0-9_]; Vietnamese letters with diacritics are also accepted (bonus).
const NAME_RE = /^[A-Za-z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯàáâãèéêìíòóôõùúăđĩũơưẠ-ỹ]{3,12}$/u;

export function validName(name) {
  return typeof name === 'string' && NAME_RE.test(name.normalize('NFC'));
}

// ISO 8601 with the local timezone offset, e.g. 2026-11-20T18:05:09+07:00
export function isoWithOffset(d = new Date()) {
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

export function makeEntry({ name, score, nights_won, seed, achieved_at = isoWithOffset() }) {
  if (!validName(name)) throw new Error('invalid name: 3-12 letters, digits or _');
  if (!Number.isInteger(score) || score < 0) throw new Error('invalid score');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new Error('invalid nights_won');
  return { name: name.normalize('NFC'), score, nights_won, achieved_at, seed: Number.isInteger(seed) ? seed : 0 };
}

// score desc; ties: earlier achieved_at first (stable for equal timestamps: existing entries stay above)
export function sortEntries(entries) {
  return entries
    .map((e, i) => [e, i])
    .sort(([a, i], [b, j]) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at) || i - j)
    .map(([e]) => e);
}

export function addEntry(entries, entry) {
  return sortEntries([...(entries || []), entry]).slice(0, MAX_ENTRIES);
}

export function exportLeaderboard(entries) {
  return { entries: sortEntries(entries || []).slice(0, MAX_ENTRIES) };
}
