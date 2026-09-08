import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ArrowUpOutlined } from '@ant-design/icons';
import { isLoginQueryOpen } from '../../app/paths';
import './ScrollToTop.scss';

const SHOW_AFTER_PX = 320;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getScroller() {
  return document.querySelector('.app-landing-deck') || window;
}

function getScrollY(scroller) {
  return scroller === window ? window.scrollY : scroller.scrollTop;
}

function scrollScrollerToTop(scroller, behavior) {
  if (scroller === window) {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  scroller.scrollTo({ top: 0, behavior });
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
      scrollScrollerToTop(getScroller(), 'auto');
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const scroller = getScroller();
    const onScroll = () => {
      setVisible(getScrollY(scroller) > SHOW_AFTER_PX);
    };

    onScroll();
    const target = scroller === window ? window : scroller;
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [pathname]);

  const handleClick = () => {
    scrollScrollerToTop(
      getScroller(),
      prefersReducedMotion() ? 'auto' : 'smooth'
    );
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
