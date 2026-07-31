import { theme as antdTheme } from 'antd';

export const THEME_STORAGE_KEY = 'ivanor-appearance';

export function getInitialAppearance() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* ignore */
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
  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif",
  colorPrimary: '#595d60',
  colorLink: '#273036',
  colorText: '#273036',
  colorTextSecondary: '#595d60',
  colorTextTertiary: '#8a8f93',
  colorTextLightSolid: '#ffffff',
  colorBorder: '#e6e8ea',
  colorBorderSecondary: '#f0f1f2',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBgLayout: '#f4f5f6',
  colorBgSpotlight: '#273036',
  colorError: '#e43141',
  colorSuccess: '#2f9e44',
  borderRadius: 8,
  controlHeight: 40,
  fontSize: 14,
  colorPrimaryHover: '#45494c',
  controlOutline: 'rgba(89, 93, 96, 0.18)',
};

const darkTokens = {
  fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif",
  colorPrimary: '#cfd3d6',
  colorLink: '#eef0f1',
  colorText: '#eef0f1',
  colorTextSecondary: '#a8adb2',
  colorTextTertiary: '#7e858c',
  /* Light CTA fill → dark label text (WCAG AA) */
  colorTextLightSolid: '#1a1d20',
  colorBorder: '#3a4046',
  colorBorderSecondary: '#2c3136',
  colorBgContainer: '#22262a',
  colorBgElevated: '#2a2f34',
  colorBgLayout: '#16191c',
  colorBgSpotlight: '#eef0f1',
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
      Tabs: {
        inkBarColor: isDark ? '#e54552' : '#e43141',
        itemSelectedColor: isDark ? '#eef0f1' : '#273036',
        itemHoverColor: isDark ? '#eef0f1' : '#273036',
        itemActiveColor: isDark ? '#eef0f1' : '#273036',
      },
      Switch: {
        colorPrimary: isDark ? '#cfd3d6' : '#595d60',
        colorPrimaryHover: isDark ? '#e0e3e5' : '#45494c',
      },
    },
  };
}
