import { DEMO_STORE_ID } from '../app/demoWorkspace';

/** Default tenant while the registry has a single store. */
export const DEFAULT_STORE_PROFILE_ID = 'ElistaIvanor';

export const STORE_PROFILES = {
  ElistaIvanor: {
    id: 'ElistaIvanor',
    displayName: 'Ivanor',
    phone: {
      display: '8 937 192-09-59',
      href: 'tel:+79371920959',
    },
    pricing: {
      tyreMargins: {
        russian: 15,
        import: 23,
        default: 18,
      },
      russianBrands: [
        'Кама',
        'Viatti',
        'Tunga',
        'Cordiant',
        'Belshina',
        'Voltyre',
        'Алтайшина',
        'Кировский ШЗ',
        'Rosava',
      ],
      importBrands: [
        'Ikon',
        'Pirelli',
        'Formula',
        'Gislaved',
        'Nokian Tyres',
        'Torero',
        'Kumho',
        'Hankook',
        'Michelin',
        'Bridgestone',
        'Continental',
        'Goodyear',
        'Yokohama',
        'BFGoodrich',
        'Dunlop',
        'Marshal',
        'Laufenn',
        'Matador',
        'Roadstone',
        'Tigar',
        'Toyo',
        'Nexen',
        'Petlas',
      ],
      discMargin: 20,
    },
  },
};

/**
 * Known storeId → profile.
 * `demo` is not a tenant and never maps to Ivanor.
 * Any other unknown id falls back to ElistaIvanor (current single tenant).
 */
export function getStoreProfile(storeId) {
  const id = String(storeId ?? '').trim();
  if (id === DEMO_STORE_ID) return null;
  if (id && Object.prototype.hasOwnProperty.call(STORE_PROFILES, id)) {
    return STORE_PROFILES[id];
  }
  return STORE_PROFILES[DEFAULT_STORE_PROFILE_ID];
}
