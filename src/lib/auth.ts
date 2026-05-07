import { UserProfile, resolveCode } from './codes';

const SESSION_KEY = 'sv_session';

export function getSession(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    // Re-validate against known codes so stale sessions don't persist
    return resolveCode(parsed.code);
  } catch {
    return null;
  }
}

export function login(code: string): UserProfile | null {
  const profile = resolveCode(code);
  if (!profile) return null;
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  return profile;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}
