import { Category, avgScore } from './data';
import { getPlatonCodes, KOMPANI_PLATONS } from './codes';

export interface MockSoldier {
  code: string;
  unit: string;
  scores: Record<Category, number>;
}

function seeded(seed: number, base: number, spread = 2): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const r = x - Math.floor(x);
  return Math.max(1, Math.min(10, Math.round(base + (r - 0.5) * spread * 2)));
}

// Float version — no rounding, for smooth trend variation
function seededF(seed: number, spread: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const r = x - Math.floor(x);
  return (r - 0.5) * spread * 2;
}

// Generate date labels for the last n days, oldest first ("7/5" format)
function trendLabels(n: number): string[] {
  const labels: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.getDate() + '/' + (d.getMonth() + 1));
  }
  return labels;
}

export const PLATON_BASES: Record<string, number> = {
  'Pluton 1': 7.2,
  'Pluton 2': 4.0,
  'Pluton 3': 6.0,
  'Pluton 4': 5.5,
  'Pluton 5': 7.8,
  'Pluton 6': 6.2,
  'Pluton 7': 4.8,
  'Pluton 8': 6.5,
  'Pluton 9': 7.0,
};

export const MOCK_SOLDIERS: MockSoldier[] = (() => {
  const soldiers: MockSoldier[] = [];
  for (const [unit, base] of Object.entries(PLATON_BASES)) {
    const codes = getPlatonCodes(unit);
    codes.forEach((code, i) => {
      const s = (code.charCodeAt(1) + i) * 17;
      soldiers.push({
        code,
        unit,
        scores: {
          fysisk:  seeded(s + 1, base, 2.5),
          psykisk: seeded(s + 2, base - 0.5, 2.5),
          social:  seeded(s + 3, base, 2),
          somn:    seeded(s + 4, base - 1, 3),
          kost:    seeded(s + 5, base + 0.5, 1.5),
          energi:  seeded(s + 6, base, 2.5),
        },
      });
    });
  }
  // Demo: several Pluton 1 soldiers have bad sleep/nutrition so platoon averages clearly show yellow/red
  const demoOverrides: Record<string, Partial<Record<string, number>>> = {
    'P1-001': { somn: 2, kost: 3, energi: 3 },
    'P1-002': { somn: 3, kost: 3 },
    'P1-003': { somn: 4, kost: 4 },
    'P1-004': { somn: 3, kost: 5 },
    'P1-005': { somn: 5, kost: 4 },
  };
  for (const [code, overrides] of Object.entries(demoOverrides)) {
    const s = soldiers.find(sol => sol.code === code);
    if (s) Object.assign(s.scores, overrides);
  }

  return soldiers;
})();

// Returns MOCK_SOLDIERS with today's real check-ins overlaid (client-side only)
export function getEffectiveSoldiers(): MockSoldier[] {
  if (typeof window === 'undefined') return MOCK_SOLDIERS;
  const today = new Date().toISOString().split('T')[0];
  return MOCK_SOLDIERS.map(s => {
    try {
      const raw = localStorage.getItem(`sv_checkins_${s.code}`);
      if (!raw) return s;
      const checkins = JSON.parse(raw) as Array<{ date: string; scores: Record<Category, number> }>;
      const entry = checkins.find(c => c.date === today);
      return entry ? { ...s, scores: entry.scores } : s;
    } catch {
      return s;
    }
  });
}

export function getPlatonSoldiers(unit: string, source: MockSoldier[] = MOCK_SOLDIERS): MockSoldier[] {
  return source.filter(s => s.unit === unit);
}

export function avgScoresFor(soldiers: MockSoldier[]): Record<Category, number> {
  if (!soldiers.length) {
    return { fysisk: 0, psykisk: 0, social: 0, somn: 0, kost: 0, energi: 0 };
  }
  const sums: Record<Category, number> = { fysisk: 0, psykisk: 0, social: 0, somn: 0, kost: 0, energi: 0 };
  for (const s of soldiers) {
    for (const k of Object.keys(sums) as Category[]) {
      sums[k] += s.scores[k];
    }
  }
  const result = {} as Record<Category, number>;
  for (const k of Object.keys(sums) as Category[]) {
    result[k] = Math.round((sums[k] / soldiers.length) * 10) / 10;
  }
  return result;
}

export function getScoresForSoldierCode(code: string): Record<Category, number> | null {
  return MOCK_SOLDIERS.find(s => s.code === code)?.scores ?? null;
}

export function trendData(unit: string, numDays = 7): Array<{ day: string; score: number }> {
  const labels = trendLabels(numDays);
  const soldiers = getPlatonSoldiers(unit);
  const base = Object.values(avgScoresFor(soldiers)).reduce((a, b) => a + b, 0) / 6;
  const s = unit.length * 7;
  return labels.map((day, i) => ({
    day,
    score: Math.max(1, Math.min(10, Math.round((base + seededF(s + i * 3, 1.4) + seededF(s + i * 7 + 1, 0.5)) * 10) / 10)),
  }));
}

export function getKompaniSoldiers(kompani: string, source: MockSoldier[] = MOCK_SOLDIERS): MockSoldier[] {
  const platons = KOMPANI_PLATONS[kompani] ?? [];
  return source.filter(s => platons.includes(s.unit));
}

export function kompaniTrendData(kompani: string, numDays = 7): Array<{ day: string; score: number }> {
  const labels = trendLabels(numDays);
  const soldiers = getKompaniSoldiers(kompani);
  const base = Object.values(avgScoresFor(soldiers)).reduce((a, b) => a + b, 0) / 6;
  const s = kompani.length * 13;
  return labels.map((day, i) => ({
    day,
    score: Math.max(1, Math.min(10, Math.round((base + seededF(s + i * 3, 1.2) + seededF(s + i * 11 + 2, 0.4)) * 10) / 10)),
  }));
}

export function groupTrendData(soldiers: MockSoldier[], groupKey: string, numDays = 7): Array<{ day: string; score: number }> {
  const labels = trendLabels(numDays);
  const base = Object.values(avgScoresFor(soldiers)).reduce((a, b) => a + b, 0) / 6;
  const s = groupKey.charCodeAt(groupKey.length - 1) * 11;
  return labels.map((day, i) => ({
    day,
    score: Math.max(1, Math.min(10, Math.round((base + seededF(s + i * 3, 1.4) + seededF(s + i * 9 + 3, 0.5)) * 10) / 10)),
  }));
}

// Generic per-category trend for any set of soldiers
export function categoryTrendDataForSoldiers(soldiers: MockSoldier[], seedKey: string, numDays = 7): Array<Record<string, number | string>> {
  const labels = trendLabels(numDays);
  const bases = avgScoresFor(soldiers);
  const cats: Category[] = ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi'];
  const sk = seedKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  return labels.map((day, i) => {
    const entry: Record<string, number | string> = { day };
    for (const cat of cats) {
      const s = i * 17 + sk + cat.charCodeAt(0);
      entry[cat] = Math.max(1, Math.min(10,
        Math.round((bases[cat] + seededF(s, 1.3) + seededF(s * 3 + 5, 0.45)) * 10) / 10
      ));
    }
    return entry;
  });
}

export function getResponseRate(soldiers: MockSoldier[]): { checked: number; total: number; pct: number } {
  const total = soldiers.length;
  if (total === 0) return { checked: 0, total: 0, pct: 0 };

  if (typeof window === 'undefined') {
    const checked = Math.round(total * 0.8);
    return { checked, total, pct: Math.round((checked / total) * 100) };
  }

  const today = new Date().toISOString().split('T')[0];
  let checked = 0;
  for (const s of soldiers) {
    try {
      const raw = localStorage.getItem(`sv_checkins_${s.code}`);
      if (!raw) continue;
      const checkins = JSON.parse(raw) as Array<{ date: string }>;
      if (checkins.some(c => c.date === today)) checked++;
    } catch { /* */ }
  }

  if (checked === 0) {
    const seed = soldiers.reduce((a, s) => a + s.code.charCodeAt(0), 0);
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    const r = x - Math.floor(x);
    checked = Math.min(total, Math.round(total * (0.7 + r * 0.25)));
  }

  return { checked, total, pct: Math.round((checked / total) * 100) };
}

// Per-category trend for a platoon
export function categoryTrendData(unit: string, numDays = 7): Array<Record<string, number | string>> {
  const labels = trendLabels(numDays);
  const soldiers = getPlatonSoldiers(unit);
  const bases = avgScoresFor(soldiers);
  const cats: Category[] = ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi'];

  return labels.map((day, i) => {
    const entry: Record<string, number | string> = { day };
    for (const cat of cats) {
      const s = i * 17 + unit.length + cat.charCodeAt(0);
      entry[cat] = Math.max(1, Math.min(10,
        Math.round((bases[cat] + seededF(s, 1.3) + seededF(s * 3 + 5, 0.45)) * 10) / 10
      ));
    }
    return entry;
  });
}
