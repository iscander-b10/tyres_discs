import React, { useEffect, useRef, useState } from 'react';
import { THEME_TRANSITION_MS } from '../../../theme/appearance';
import { ReactComponent as MoonIcon } from '../../../icons/Moon.svg';
import { ReactComponent as SunIcon } from '../../../icons/Sun.svg';
import HoverTooltip from '../HoverTooltip';
import './ThemeSwitch.scss';

/**
 * Quiet icon-button theme switch for the site header utility row.
 * Semantics: checked = dark (shows sun = next action light);
 * unchecked = light (shows moon = next action dark).
 * Aria/tooltip describe the next action.
 */
function ThemeSwitch({
  appearance = 'light',
  onAppearanceChange,
  disabled = false,
}) {
  const isDark = appearance === 'dark';
  const themeActionLabel = isDark
    ? 'Включить светлую тему'
    : 'Включить тёмную тему';
  const themeTooltip = isDark ? 'Светлая тема' : 'Тёмная тема';

  const [isPending, setIsPending] = useState(false);
  const pendingTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current != null) {
        window.clearTimeout(pendingTimeoutRef.current);
      }
    };
  }, []);

  const isDisabled = disabled || isPending;

  const handleToggle = () => {
    if (isDisabled) return;

    const nextAppearance = isDark ? 'light' : 'dark';
    setIsPending(true);
    onAppearanceChange?.(nextAppearance);

    pendingTimeoutRef.current = window.setTimeout(() => {
      pendingTimeoutRef.current = null;
      setIsPending(false);
    }, THEME_TRANSITION_MS);
  };

  return (
    <HoverTooltip title={themeTooltip} placement="bottom">
      <button
        type="button"
        className={[
          'theme-switch',
          isDark ? 'is-dark' : 'is-light',
          isPending ? 'is-pending' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="switch"
        aria-checked={isDark}
        aria-label={themeActionLabel}
        aria-busy={isPending || undefined}
        disabled={isDisabled}
        onClick={handleToggle}
      >
        <span className="theme-switch__icons" aria-hidden="true">
          <MoonIcon
            className={[
              'theme-switch__icon',
              'theme-switch__icon--moon',
              isDark ? '' : 'is-visible',
            ]
              .filter(Boolean)
              .join(' ')}
          />
          <SunIcon
            className={[
              'theme-switch__icon',
              'theme-switch__icon--sun',
              isDark ? 'is-visible' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </span>
      </button>
    </HoverTooltip>
  );
}

export default ThemeSwitch;
