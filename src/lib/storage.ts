import { CheckIn, Category } from './data';

function key(soldierCode: string) {
  return `sv_checkins_${soldierCode}`;
}

export function getCheckIns(soldierCode: string): CheckIn[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key(soldierCode)) || '[]');
  } catch {
    return [];
  }
}

export function saveCheckIn(c: CheckIn): void {
  const existing = getCheckIns(c.soldierCode).filter(x => x.date !== c.date);
  localStorage.setItem(key(c.soldierCode), JSON.stringify([c, ...existing]));
}

export function getTodayCheckIn(soldierCode: string): CheckIn | null {
  const today = new Date().toISOString().split('T')[0];
  return getCheckIns(soldierCode).find(c => c.date === today) ?? null;
}

export function getResponseFrequency(soldierCode: string, days = 14): { checkedIn: number; total: number; pct: number } {
  const all = getCheckIns(soldierCode);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const recent = all.filter(c => new Date(c.date) >= cutoff);
  return { checkedIn: recent.length, total: days, pct: Math.round((recent.length / days) * 100) };
}

// Seed mock historical data for a soldier (for demo purposes)
export function seedMockHistory(soldierCode: string, baseScores: Record<Category, number>): void {
  const existing = getCheckIns(soldierCode);
  if (existing.length > 2) return; // already seeded

  const CATEGORIES: Category[] = ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi'];
  const records: CheckIn[] = [];

  for (let i = 13; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    const seed = i * 19 + soldierCode.charCodeAt(1);
    const scores = {} as Record<Category, number>;
    for (const cat of CATEGORIES) {
      const x = Math.sin(seed * (cat.charCodeAt(0) + 7)) * 10000;
      const r = x - Math.floor(x);
      scores[cat] = Math.max(1, Math.min(10, Math.round(baseScores[cat] + (r - 0.5) * 4)));
    }
    records.push({ id: `mock-${i}`, date, soldierCode, scores });
  }

  localStorage.setItem(key(soldierCode), JSON.stringify([...records, ...existing]));
}
