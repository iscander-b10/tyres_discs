(() => {
  const deck = document.getElementById("deck");
  const slides = Array.from(document.querySelectorAll(".slide"));
  const dotsRoot = document.getElementById("dots");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const currentEl = document.getElementById("current");
  const totalEl = document.getElementById("total");
  const live = document.getElementById("live");
  const progress = document.querySelector(".progress");

  const TOTAL = slides.length;
  const OVERFLOW_PX = 2;
  const SLIDE_MS = 720;
  const SLIDE_MS_STEP = 70;
  const SLIDE_MS_MAX = 1400;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hasScrollEnd = "onscrollend" in window;
  const easeSlide = cubicBezier(0.4, 0, 0.6, 1);

  let index = 0;
  let settledIndex = -1;
  let programmatic = false;
  let scrolling = false;
  let settleTimer = 0;
  let animFrame = 0;
  let travelGen = 0;
  let wheelLock = false;
  let touchY = 0;

  totalEl.textContent = String(TOTAL);
  progress.style.setProperty("--n", String(TOTAL));

  slides.forEach((slide, i) => {
    const title = slide.dataset.title || `Слайд ${i + 1}`;
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot";
    dot.setAttribute("aria-label", `${title}, слайд ${i + 1} из ${TOTAL}`);
    dot.addEventListener("click", () => go(i));
    dotsRoot.appendChild(dot);
    slide.id = slide.id || `slide-${i + 1}`;
  });

  const dots = Array.from(dotsRoot.querySelectorAll(".dot"));

  function cubicBezier(x1, y1, x2, y2) {
    function calc(t, a, b) {
      const mt = 1 - t;
      return 3 * mt * mt * t * a + 3 * mt * t * t * b + t * t * t;
    }
    return function ease(x) {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const xEst = calc(t, x1, x2);
        const dx =
          3 * (1 - t) * (1 - t) * x1 +
          6 * (1 - t) * t * (x2 - x1) +
          3 * t * t * (1 - x2);
        if (Math.abs(dx) < 1e-6) break;
        t = Math.max(0, Math.min(1, t - (xEst - x) / dx));
      }
      return calc(t, y1, y2);
    };
  }

  function prefersReduce() {
    return reduceMotion.matches;
  }

  function slideFromScroll() {
    const h = deck.clientHeight;
    if (h <= 0) return 0;
    return Math.min(TOTAL - 1, Math.max(0, Math.round(deck.scrollTop / h)));
  }

  function intendedIndex() {
    return programmatic ? index : slideFromScroll();
  }

  function syncOverflow() {
    slides.forEach((slide) => {
      const needs = slide.scrollHeight - slide.clientHeight > OVERFLOW_PX;
      slide.classList.toggle("slide--scroll", needs);
    });
  }

  function innerCanConsume(slide, dy) {
    if (!slide || !slide.classList.contains("slide--scroll")) return false;
    const max = slide.scrollHeight - slide.clientHeight;
    if (max <= OVERFLOW_PX) return false;
    if (dy > 0) return slide.scrollTop < max - 1;
    if (dy < 0) return slide.scrollTop > 1;
    return false;
  }

  function prepareIncoming(i) {
    if (i < 0 || i >= TOTAL || i === settledIndex) return;
    const slide = slides[i];
    slide.classList.remove("is-ready");
    slide.classList.remove("is-entering");
  }

  function markReady(slide) {
    slide.classList.add("is-ready");
    slide.classList.remove("is-entering");
  }

  function playEnter(slide) {
    if (prefersReduce()) {
      markReady(slide);
      return;
    }
    if (slide.classList.contains("is-ready")) return;
    if (slide.classList.contains("is-entering")) return;
    slide.classList.add("is-entering");

    const items = slide.querySelectorAll(".enter");
    let left = items.length;
    if (!left) {
      markReady(slide);
      return;
    }

    const onEnd = (e) => {
      if (!e.target.classList.contains("enter") || !slide.contains(e.target)) return;
      left -= 1;
      if (left > 0) return;
      slide.removeEventListener("animationend", onEnd);
      markReady(slide);
    };
    slide.addEventListener("animationend", onEnd);
  }

  function syncChrome(i) {
    if (i < 0 || i >= TOTAL) return;
    index = i;

    progress.style.setProperty("--i", String(i));
    progress.style.transitionDuration = prefersReduce() ? "0ms" : "";

    slides.forEach((slide, n) => {
      slide.classList.toggle("is-active", n === i);
    });

    dots.forEach((dot, n) => {
      if (n === i) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });

    currentEl.textContent = String(i + 1);
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === TOTAL - 1;
  }

  function settle(i) {
    if (i < 0 || i >= TOTAL) return;

    syncChrome(i);

    slides.forEach((slide, n) => {
      const on = n === i;
      if (!on && slide.classList.contains("is-entering")) markReady(slide);
      slide.toggleAttribute("inert", !on);
      slide.setAttribute("aria-hidden", on ? "false" : "true");
    });

    if (i === settledIndex) return;
    settledIndex = i;
    if (slides[i].scrollTop) slides[i].scrollTop = 0;

    const title = slides[i].dataset.title || "";
    live.textContent = `Слайд ${i + 1} из ${TOTAL}. ${title}`;

    playEnter(slides[i]);
  }

  function durationFor(from, to) {
    const steps = Math.max(1, Math.abs(to - from));
    return Math.min(SLIDE_MS_MAX, SLIDE_MS + (steps - 1) * SLIDE_MS_STEP);
  }

  function setSnap(on) {
    deck.style.scrollSnapType = on ? "" : "none";
  }

  function stopAnim() {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = 0;
    }
  }

  function animateScrollTo(top, duration) {
    stopAnim();
    const gen = ++travelGen;
    const from = deck.scrollTop;
    if (Math.abs(from - top) < 1) {
      setSnap(true);
      return Promise.resolve(gen);
    }

    setSnap(false);
    const t0 = performance.now();

    return new Promise((resolve) => {
      const step = (now) => {
        if (gen !== travelGen) {
          resolve(gen);
          return;
        }
        const t = Math.min(1, (now - t0) / duration);
        deck.scrollTop = from + (top - from) * easeSlide(t);
        if (t < 1) {
          animFrame = requestAnimationFrame(step);
          return;
        }
        animFrame = 0;
        deck.scrollTop = top;
        setSnap(true);
        requestAnimationFrame(() => resolve(gen));
      };
      animFrame = requestAnimationFrame(step);
    });
  }

  function scrollToSlide(i, instant, fromIndex) {
    const top = slides[i].offsetTop;
    const jump = instant || prefersReduce();
    if (jump) {
      stopAnim();
      travelGen += 1;
      setSnap(true);
      deck.scrollTo({ top, behavior: "auto" });
      return Promise.resolve(travelGen);
    }
    return animateScrollTo(top, durationFor(fromIndex, i));
  }

  function finishTravel(gen) {
    if (gen !== travelGen) return;
    programmatic = false;
    scrolling = false;
    settle(slideFromScroll());
    wheelLock = true;
    window.setTimeout(() => {
      wheelLock = false;
    }, 160);
  }

  function go(next, { instant = false } = {}) {
    if (next < 0 || next >= TOTAL) return;

    const here = slideFromScroll();
    if (next === here && next === settledIndex && !instant && !programmatic) return;

    if (!(instant || prefersReduce())) prepareIncoming(next);

    syncChrome(next);

    if (next === here && !instant) {
      settle(next);
      return;
    }

    programmatic = true;
    scrolling = true;
    window.clearTimeout(settleTimer);

    const travel = scrollToSlide(next, instant, here);

    if (instant || prefersReduce()) {
      settle(next);
      programmatic = false;
      scrolling = false;
      return;
    }

    const ms = durationFor(here, next);
    settleTimer = window.setTimeout(() => finishTravel(travelGen), ms + 80);
    travel.then((gen) => {
      window.clearTimeout(settleTimer);
      finishTravel(gen);
    });
  }

  function onScroll() {
    scrolling = true;
    if (!programmatic) {
      const i = slideFromScroll();
      if (i !== index) syncChrome(i);
    }
    if (!hasScrollEnd) armScrollEnd();
  }

  function onScrollEnd() {
    if (programmatic) return;
    window.clearTimeout(settleTimer);
    scrolling = false;
    settle(slideFromScroll());
  }

  function armScrollEnd() {
    if (programmatic) return;
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(onScrollEnd, 90);
  }

  function isTypingTarget(el) {
    if (!el || el === document.body) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return Boolean(el.isContentEditable);
  }

  prevBtn.addEventListener("click", () => go(intendedIndex() - 1));
  nextBtn.addEventListener("click", () => go(intendedIndex() + 1));

  document.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.key === " " && e.target.closest("a, button")) return;

    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowRight" ||
      e.key === "PageDown" ||
      e.key === " "
    ) {
      e.preventDefault();
      go(intendedIndex() + 1);
    } else if (
      e.key === "ArrowUp" ||
      e.key === "ArrowLeft" ||
      e.key === "PageUp"
    ) {
      e.preventDefault();
      go(intendedIndex() - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(TOTAL - 1);
    }
  });

  deck.addEventListener("scroll", onScroll, { passive: true });
  deck.addEventListener("scrollend", onScrollEnd);

  deck.addEventListener(
    "wheel",
    (e) => {
      if (prefersReduce()) return;
      const overflowSlide = e.target.closest(".slide--scroll");
      if (innerCanConsume(overflowSlide, e.deltaY)) return;
      e.preventDefault();
      if (programmatic || wheelLock) return;
      if (Math.abs(e.deltaY) < 6) return;
      go(intendedIndex() + (e.deltaY > 0 ? 1 : -1));
    },
    { passive: false }
  );

  deck.addEventListener(
    "touchstart",
    (e) => {
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );

  deck.addEventListener(
    "touchmove",
    (e) => {
      if (prefersReduce()) return;
      const dy = touchY - e.touches[0].clientY;
      const overflowSlide = e.target.closest(".slide--scroll");
      if (!programmatic && innerCanConsume(overflowSlide, dy)) return;
      if (programmatic || Math.abs(dy) > 10) e.preventDefault();
    },
    { passive: false }
  );

  deck.addEventListener(
    "touchend",
    (e) => {
      if (prefersReduce() || programmatic) return;
      const dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) < 40) return;
      const overflowSlide = e.target.closest(".slide--scroll");
      if (innerCanConsume(overflowSlide, dy)) return;
      go(intendedIndex() + (dy > 0 ? 1 : -1));
    },
    { passive: true }
  );

  const observer = new IntersectionObserver(
    (entries) => {
      if (scrolling || programmatic) return;
      let best = null;
      for (const entry of entries) {
        if (entry.intersectionRatio < 0.75) continue;
        if (!best || entry.intersectionRatio > best.intersectionRatio) {
          best = entry;
        }
      }
      if (!best) return;
      settle(slides.indexOf(best.target));
    },
    { root: deck, threshold: [0.75, 1] }
  );

  slides.forEach((slide) => observer.observe(slide));

  const resizeObserver = new ResizeObserver(() => {
    syncOverflow();
  });
  slides.forEach((slide) => resizeObserver.observe(slide));
  resizeObserver.observe(deck);

  window.addEventListener("resize", () => {
    syncOverflow();
    programmatic = true;
    scrollToSlide(index, true);
    settle(index);
    programmatic = false;
    scrolling = false;
  });

  reduceMotion.addEventListener("change", () => {
    go(index, { instant: true });
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      syncOverflow();
      scrollToSlide(index, true);
    });
  }

  const hashMatch = location.hash.match(/slide-(\d+)/);
  const fromHash = hashMatch ? Number(hashMatch[1]) - 1 : 0;
  const start = fromHash >= 0 && fromHash < TOTAL ? fromHash : 0;

  syncOverflow();
  syncChrome(start);

  if (start !== 0) go(start, { instant: true });
  else settle(start);
})();
