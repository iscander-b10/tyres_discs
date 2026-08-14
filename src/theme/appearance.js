import { theme as antdTheme } from 'antd';

export const THEME_STORAGE_KEY = 'ivanor-appearance';
/**
 * ThemeSwitch pending-lock only (Galahhad scene `--transition: 0.5s`).
 * Page theme itself snaps instantly — no global color morph.
 */
export const THEME_TRANSITION_MS = 500;

export function getInitialAppearance() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* ignore */
  }

  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

export function applyAppearance(appearance) {
  document.documentElement.setAttribute('data-theme', appearance);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, appearance);
  } catch {
    /* ignore */
  }
}

/**
 * Applies theme DOM update instantly (hard snap).
 * No View Transitions / no `.theme-transitioning` color morph — those caused
 * border/icon/divider glitches while Ant Design tokens updated in the same frame.
 */
export function runAppearanceTransition(updateDom) {
  updateDom();
  return Promise.resolve();
}

const sharedComponentTokens = {
  Button: {
    primaryShadow: 'none',
    defaultShadow: 'none',
    fontWeight: 600,
  },
  Card: {
    borderRadiusLG: 12,
  },
};

const lightTokens = {
  fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  colorPrimary: '#595d60',
  colorLink: '#273036',
  colorText: '#273036',
  colorTextSecondary: '#595d60',
  colorTextTertiary: '#9ca0a4',
  colorTextLightSolid: '#ffffff',
  colorBorder: '#dfe3e6',
  colorBorderSecondary: '#f1f1f1',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBgLayout: '#f6f7f8',
  /* Tooltip / spotlight overlays — project surface, not inverted Ant default */
  colorBgSpotlight: '#ffffff',
  colorError: '#e43141',
  colorSuccess: '#2f9e44',
  borderRadius: 8,
  controlHeight: 40,
  fontSize: 14,
  colorPrimaryHover: '#34373d',
  controlOutline: 'rgba(89, 93, 96, 0.18)',
};

const darkTokens = {
  fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  colorPrimary: '#cfd3d6',
  colorLink: '#eef0f1',
  colorText: '#eef0f1',
  colorTextSecondary: '#a8adb2',
  colorTextTertiary: '#7e858c',
  /* Light CTA fill → dark label text (WCAG AA) */
  colorTextLightSolid: '#1a1d20',
  colorBorder: '#353b42',
  colorBorderSecondary: '#2a2f35',
  colorBgContainer: '#1e2328',
  colorBgElevated: '#262b31',
  colorBgLayout: '#14171a',
  /* Elevated surface for tooltips (matches --color-surface-muted) */
  colorBgSpotlight: '#262b31',
  colorError: '#e54552',
  colorSuccess: '#3db954',
  borderRadius: 8,
  controlHeight: 40,
  fontSize: 14,
  colorPrimaryHover: '#e0e3e5',
  controlOutline: 'rgba(207, 211, 214, 0.28)',
};

export function getAntdTheme(appearance) {
  const isDark = appearance === 'dark';

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: isDark ? darkTokens : lightTokens,
    components: {
      ...sharedComponentTokens,
      /* Tooltip text uses colorTextLightSolid by default — map to body text on surface bg */
      Tooltip: {
        colorTextLightSolid: isDark ? '#eef0f1' : '#273036',
      },
      Tabs: {
        inkBarColor: isDark ? '#e54552' : '#e43141',
        itemSelectedColor: isDark ? '#eef0f1' : '#273036',
        itemHoverColor: isDark ? '#eef0f1' : '#273036',
        itemActiveColor: isDark ? '#eef0f1' : '#273036',
      },
      /* Client/manager mode — fixed system burgundy in both appearances */
      Switch: {
        colorPrimary: '#e43141',
        colorPrimaryHover: '#c82731',
      },
    },
  };
}
