/** Rollerna i systemet. Ren fil utan beroenden — får importeras var som helst. */
export type Role = 'soldat' | 'pluton' | 'kompani' | 'bataljon' | 'admin';

export const ROLE_LABEL: Record<Role, string> = {
  soldat: 'Värnpliktig',
  pluton: 'Plutonchef',
  kompani: 'Kompanichef',
  bataljon: 'Bataljonschef',
  admin: 'Administratör',
};

/** Startsidan för respektive roll efter inloggning. */
export function homeFor(role: Role): string {
  switch (role) {
    case 'soldat': return '/soldat';
    case 'pluton': return '/pluton';
    case 'kompani': return '/kompani';
    case 'bataljon': return '/bataljon';
    case 'admin': return '/admin';
  }
}

/** Alla befälsroller — de som ser aggregerad data för en enhet. */
export const LEADER_ROLES: Role[] = ['pluton', 'kompani', 'bataljon'];
