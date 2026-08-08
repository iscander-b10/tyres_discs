import React, { useEffect, useState } from 'react';
import { ArrowUpOutlined } from '@ant-design/icons';
import './ScrollToTop.scss';

const SHOW_AFTER_PX = 320;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  return (
    <button
      type="button"
      className={`scroll-to-top${visible ? ' is-visible' : ''}`}
      aria-label="Наверх"
      tabIndex={visible ? undefined : -1}
      onClick={handleClick}
    >
      <ArrowUpOutlined className="scroll-to-top__icon" aria-hidden />
    </button>
  );
}

export default ScrollToTop;
