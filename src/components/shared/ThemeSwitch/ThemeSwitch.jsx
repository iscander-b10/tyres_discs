import React, { useEffect, useRef, useState } from 'react';
import sunThemeIcon from '../../../icons/Sun_Theme.png';
import moonIcon from '../../../icons/Moon.png';
import { THEME_TRANSITION_MS } from '../../../theme/appearance';
import HoverTooltip from '../HoverTooltip';
import './ThemeSwitch.scss';

/**
 * Compact theme switch for the site header.
 * Semantics: checked = dark (moon), unchecked = light (sun).
 * Shows the current appearance in the thumb; aria/tooltip describe the next action.
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
        <span className="theme-switch__track" aria-hidden>
          <span className="theme-switch__thumb">
            <span className="theme-switch__icons">
              <img
                className="theme-switch__icon theme-switch__icon--sun"
                src={sunThemeIcon}
                alt=""
                draggable={false}
              />
              <img
                className="theme-switch__icon theme-switch__icon--moon"
                src={moonIcon}
                alt=""
                draggable={false}
              />
            </span>
          </span>
        </span>
      </button>
    </HoverTooltip>
  );
}

export default ThemeSwitch;
