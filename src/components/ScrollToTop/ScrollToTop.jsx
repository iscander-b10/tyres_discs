import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ArrowUpOutlined } from '@ant-design/icons';
import { isLoginQueryOpen } from '../../app/paths';
import './ScrollToTop.scss';

const SHOW_AFTER_PX = 320;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const previousPathRef = useRef(pathname);
  const previousLoginOpenRef = useRef(isLoginQueryOpen(searchParams));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const wasLoginOpen = previousLoginOpenRef.current;
    const isLoginOpen = isLoginQueryOpen(searchParams);

    previousPathRef.current = pathname;
    previousLoginOpenRef.current = isLoginOpen;

    if (isLoginOpen || wasLoginOpen) {
      return;
    }
    if (previousPath !== pathname) {
      window.scrollTo(0, 0);
    }
  }, [pathname, searchParams]);

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
