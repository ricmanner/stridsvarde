export type Role = 'soldat' | 'pluton' | 'kompani' | 'bataljon';

export interface UserProfile {
  code: string;
  role: Role;
  unit: string;          // e.g. "Pluton 3", "2. Kompaniet", "Bataljonen"
  soldierIndex?: number; // 1-10, for soldiers only
}

export const ALL_COMPANIES = ['1. Kompaniet', '2. Kompaniet', '3. Kompaniet'];

export const KOMPANI_PLATONS: Record<string, string[]> = {
  '1. Kompaniet': ['Pluton 1', 'Pluton 2', 'Pluton 3'],
  '2. Kompaniet': ['Pluton 4', 'Pluton 5', 'Pluton 6'],
  '3. Kompaniet': ['Pluton 7', 'Pluton 8', 'Pluton 9'],
};

export const ALL_PLATOONS: string[] = Object.values(KOMPANI_PLATONS).flat();

const CODES: Record<string, UserProfile> = (() => {
  const codes: Record<string, UserProfile> = {};

  // Soldiers: P1-001 … P9-010
  for (let p = 1; p <= 9; p++) {
    for (let s = 1; s <= 10; s++) {
      const code = `P${p}-${String(s).padStart(3, '0')}`;
      codes[code] = { code, role: 'soldat', unit: `Pluton ${p}`, soldierIndex: s };
    }
  }

  // Platoon leaders: BF-P1 … BF-P9
  for (let p = 1; p <= 9; p++) {
    const code = `BF-P${p}`;
    codes[code] = { code, role: 'pluton', unit: `Pluton ${p}` };
  }

  // Company leaders
  codes['BF-KP']  = { code: 'BF-KP',  role: 'kompani', unit: '1. Kompaniet' };
  codes['BF-KP2'] = { code: 'BF-KP2', role: 'kompani', unit: '2. Kompaniet' };
  codes['BF-KP3'] = { code: 'BF-KP3', role: 'kompani', unit: '3. Kompaniet' };

  // Battalion commander
  codes['BF-BAT'] = { code: 'BF-BAT', role: 'bataljon', unit: 'Bataljonen' };

  return codes;
})();

export function resolveCode(raw: string): UserProfile | null {
  return CODES[raw.trim().toUpperCase()] ?? null;
}

export function getPlatonCodes(unit: string): string[] {
  return Object.values(CODES)
    .filter(p => p.role === 'soldat' && p.unit === unit)
    .map(p => p.code);
}
