/**
 * 🔐 roles — role kont (Firebase) → Filar + zakres.
 *
 * Konto TeO (teo.center) „ŁĄCZY" — błogosławi i dodaje. Konto Mistrza Arkadiusza
 * (arkadiusz.szczepaniak@gmail.com) buduje swoje Katedry=Universy. OBA bez ingerencji
 * w cały system — tylko budowa własnych Katedr. Reszta = suwerenne węzły (gra Odkrywania).
 */
import { setTier, type TierId } from './tiers';

export interface AccountRole {
  id: 'teo' | 'mistrz-arkadiusz' | 'node';
  label: string;
  tier: TierId;
  canInterfereSystem: boolean; // ZAWSZE false — nikt nie ingeruje w cały system
  sovereignName: string;
  note: string;
}

export function roleForEmail(email?: string | null): AccountRole {
  const e = (email || '').toLowerCase().trim();
  if (e === 'teo@teo.center' || e.endsWith('@teo.center')) {
    return {
      id: 'teo', label: 'TeO — Łączy', tier: 'mistrzowski', canInterfereSystem: false,
      sovereignName: 'TeO',
      note: 'Łączy, nie dzieli. Błogosławi i dodaje. Za swe niedostatki każdy sam odpowiada.',
    };
  }
  if (e === 'arkadiusz.szczepaniak@gmail.com') {
    return {
      id: 'mistrz-arkadiusz', label: 'Mistrz Arkadiusz', tier: 'mistrzowski', canInterfereSystem: false,
      sovereignName: 'Mistrz Arkadiusz',
      note: 'Buduje swoje Katedry = Universy. Pełnia możliwości, bez ingerencji w cały system.',
    };
  }
  return {
    id: 'node', label: 'Suwerenny Węzeł', tier: 'poznawczy', canInterfereSystem: false,
    sovereignName: '',
    note: 'Buduje swoją Katedrę. Wspina się przez Filary — gra Odkrywania prawdziwego Suwerena.',
  };
}

const ROLE_KEY = 'otakos_account_role';

/** Zastosuj rolę konta przy logowaniu: ustaw Filar + zapisz tożsamość. */
export function applyAccountRole(email?: string | null): AccountRole {
  const role = roleForEmail(email);
  setTier(role.tier);
  try {
    localStorage.setItem(ROLE_KEY, JSON.stringify(role));
    if (role.sovereignName) localStorage.setItem('otakos_sovereign_name', role.sovereignName);
  } catch { /* noop */ }
  return role;
}

export function currentRole(): AccountRole | null {
  try { const r = localStorage.getItem(ROLE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
