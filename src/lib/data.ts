export type Category = 'fysisk' | 'psykisk' | 'social' | 'somn' | 'kost' | 'energi';

export const CATEGORIES: Array<{
  key: Category;
  label: string;
  icon: string; // Lucide icon name
  question: string;
}> = [
  { key: 'fysisk',  label: 'Fysisk form',      icon: 'Activity',  question: 'Hur mår din kropp idag?' },
  { key: 'psykisk', label: 'Psykiskt mående',   icon: 'Brain',     question: 'Hur mår du mentalt?' },
  { key: 'social',  label: 'Social trivsel',    icon: 'Users',     question: 'Hur trivs du i gruppen?' },
  { key: 'somn',    label: 'Sömn',              icon: 'Moon',      question: 'Hur sov du igår natt?' },
  { key: 'kost',    label: 'Kost och näring',   icon: 'Utensils',  question: 'Hur äter du under tjänsten?' },
  { key: 'energi',  label: 'Energinivå',        icon: 'Zap',       question: 'Hur är din energi just nu?' },
];

export interface CheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  soldierCode: string;
  scores: Record<Category, number>;
  advice?: string;
}

export type Status = 'green' | 'yellow' | 'red';

export function getStatus(score: number): Status {
  if (score >= 7) return 'green';
  if (score >= 4) return 'yellow';
  return 'red';
}

export function statusColor(s: Status): string {
  return s === 'green' ? '#059669' : s === 'yellow' ? '#D97706' : '#DC2626';
}

export function statusBg(s: Status): string {
  return s === 'green' ? '#ECFDF5' : s === 'yellow' ? '#FFFBEB' : '#FEF2F2';
}

export function statusLabel(s: Status): string {
  return s === 'green' ? 'GRÖN' : s === 'yellow' ? 'GUL' : 'RÖD';
}

export function avgScore(scores: Record<Category, number>): number {
  const vals = Object.values(scores) as number[];
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
