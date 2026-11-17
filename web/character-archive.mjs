import { readFile, stat } from 'node:fs/promises';

// JSON.parse's source preserves ulong IDs beyond Number.MAX_SAFE_INTEGER.
function decode(text) {
  const config = JSON.parse(text.replace(/^\uFEFF/, ''), (key, value, context) =>
    key === 'ContentId' && typeof value === 'number' ? context.source : value);
  const records = new Map();
  for (const c of config.Characters || []) {
    if (!c || !/^\d+$/.test(c.ContentId)) continue;
    const rows = [];
    function add(label, value) {
      if (typeof value === 'string' && value.trim()) rows.push([label, value]);
    }
    add('現在のワールド', c.CurrentWorld);
    add('種族・部族', [c.Race, c.Tribe].filter(Boolean).join(' / '));
    add('性別', c.Sex);
    add('所属グランドカンパニー', c.GrandCompany);
    add('守護神', c.GuardianDeity);
    add('開始都市', c.StartTown);
    add('記録時のジョブ', [c.ClassJob, c.Level > 0 ? 'Lv. ' + c.Level : ''].filter(Boolean).join(' '));
    add('ジョブ・レベル', (Array.isArray(c.Jobs) ? c.Jobs : []).filter(j => j?.Name && j.Level > 0).map(j => j.Name + ' Lv. ' + j.Level).join(' / '));
    if (Number.isSafeInteger(c.PlayTimeMinutes) && c.PlayTimeMinutes >= 0)
      add('プレイ時間（時・分）', Math.floor(c.PlayTimeMinutes / 60) + ' h ' + c.PlayTimeMinutes % 60 + ' min');
    const scenario = c.MainScenario;
    add('メインクエスト', [scenario?.ExpansionProgress?.Name, scenario?.Chapter, scenario?.QuestName].filter(Boolean).join(' / '));
    for (const [label, date] of [['初回記録', c.FirstSeenAt], ['最終記録', c.LastSeenAt]]) {
      if (date && !date.startsWith('0001-') && Number.isFinite(Date.parse(date))) add(label, date);
    }
    if (rows.length) records.set(c.ContentId, rows);
  }
  return records;
}

export function characterArchiveReader(file) {
  let cached, pending;
  async function refresh() {
    try {
      const info = await stat(file, { bigint: true });
      const key = [info.ino, info.size, info.mtimeNs].join('/');
      if (cached?.key !== key) {
        let records = new Map();
        if (info.isFile() && info.size <= 16n * 1024n * 1024n)
          records = decode(await readFile(file, 'utf8'));
        cached = { key, records };
      }
      return cached.records;
    } catch {
      cached = undefined;
    }
  }
  return async id => {
    pending ??= refresh().finally(() => { pending = undefined; });
    return (await pending)?.get(id);
  };
}
