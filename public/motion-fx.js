/**
 * ============================================================================
 * SChat - Real-Time Messaging Platform
 * Copyright (c) 2026 Shreyash Dwivedi (@shreyashdwivedi36). All Rights Reserved.
 *
 * This software and its associated documentation are the exclusive proprietary
 * property of Shreyash Dwivedi. Unauthorized copying, modification, distribution,
 * sublicensing, or commercial use is strictly prohibited.
 * ============================================================================
 */
/**
 * SChat motion layer — Motion (motion.dev) springs + 21st.dev-style interactions.
 * Falls back to the Web Animations API if the CDN module cannot load.
 */

let animate = fallbackAnimate;
let stagger = fallbackStagger;

import('https://cdn.jsdelivr.net/npm/motion@11.16.0/+esm')
  .then(motion => {
    if (typeof motion.animate === 'function') animate = motion.animate;
    if (typeof motion.stagger === 'function') stagger = motion.stagger;
  })
  .catch(err => {
    // Graceful fallback to WAAPI
  });

const reduced = false; // Forced false to ensure premium animations play on all devices

function fallbackAnimate(target, keyframes, options = {}) {
  const els = resolveTargets(target);
  const duration = (options.duration ?? 0.45) * 1000;
  const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const animations = els.map((el) => {
    const fromTo = {};
    Object.entries(keyframes).forEach(([prop, value]) => {
      fromTo[cssProp(prop)] = Array.isArray(value) ? value : [null, value];
    });
    return el.animate(remapToWAAPI(fromTo), { duration, easing, fill: 'both' });
  });
  const finished = Promise.all(animations.map((a) => a.finished.catch(() => {})));
  return { finished, stop() { animations.forEach((a) => a.cancel()); } };
}

function fallbackStagger(step = 0.06) {
  return (i) => i * step * 1000;
}

function resolveTargets(target) {
  if (!target) return [];
  if (typeof target === 'string') return Array.from(document.querySelectorAll(target));
  if (target instanceof Element) return [target];
  if (NodeList.prototype.isPrototypeOf(target) || Array.isArray(target)) return Array.from(target);
  return [];
}

function cssProp(prop) {
  if (prop === 'x' || prop === 'y' || prop === 'scale' || prop === 'rotate') return 'transform';
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function remapToWAAPI(fromTo) {
  const frame0 = {};
  const frame1 = {};
  const transforms0 = [];
  const transforms1 = [];

  Object.entries(fromTo).forEach(([prop, value]) => {
    if (prop === 'transform') return;
    const [a, b] = value;
    if (a != null) frame0[prop] = a;
    if (b != null) frame1[prop] = b;
  });

  return [frame0, frame1];
}

function clearMotionStyles(el) {
  if (!el) return;
  el.style.opacity = '';
  el.style.filter = '';
  el.style.transform = '';
}

export const MotionFX = {
  reduced,
  animate,
  stagger,

  async enter(el, { y = 18, delay = 0, bounce = 0.18 } = {}) {
    if (!el) return;
    if (reduced) {
      clearMotionStyles(el);
      return;
    }
    el.style.opacity = '0';
    await animate(
      el,
      { opacity: [0, 1], y: [y, 0], filter: ['blur(10px)', 'blur(0px)'] },
      { type: 'spring', duration: 0.7, bounce, delay }
    ).finished.catch(() => {});
    clearMotionStyles(el);
  },

  async exit(el, { y = -12 } = {}) {
    if (!el) return;
    if (reduced) return;
    await animate(
      el,
      { opacity: 0, y, filter: 'blur(8px)' },
      { duration: 0.28 }
    ).finished.catch(() => {});
  },

  async staggerIn(els, { y = 16, step = 0.05 } = {}) {
    const list = resolveTargets(els).filter(Boolean);
    if (!list.length || reduced) return;
    list.forEach((el) => { el.style.opacity = '0'; });
    await animate(
      list,
      { opacity: [0, 1], y: [y, 0] },
      { type: 'spring', duration: 0.55, bounce: 0.16, delay: stagger(step) }
    ).finished.catch(() => {});
    list.forEach(clearMotionStyles);
  },

  enterMessage(el, outgoing = false) {
    if (!el || reduced) return;
    const x = outgoing ? 22 : -22;
    animate(
      el,
      { opacity: [0, 1], x: [x, 0], scale: [0.94, 1] },
      { type: 'spring', duration: 0.55, bounce: 0.24 }
    );
  },

  popIn(el) {
    if (!el || reduced) return;
    animate(
      el,
      { opacity: [0, 1], scale: [0.88, 1], y: [12, 0] },
      { type: 'spring', duration: 0.45, bounce: 0.28 }
    );
  },

  press(el) {
    if (!el || reduced) return;
    animate(el, { scale: 0.96 }, { type: 'spring', duration: 0.22, bounce: 0 }).finished
      .then(() => animate(el, { scale: 1 }, { type: 'spring', duration: 0.35, bounce: 0.35 }))
      .catch(() => {});
  },

  
  

  
  injectGradualBlur() {
    const chatMain = document.querySelector('.chat-main');
    if (!chatMain) return;
    
    if (document.querySelector('.gradual-blur-container.top')) return;
    
    const buildBlur = (pos) => {
      const container = document.createElement('div');
      container.className = `gradual-blur-container ${pos}`;
      for (let i = 1; i <= 5; i++) {
        const slice = document.createElement('div');
        slice.className = `blur-slice slice-${i}`;
        container.appendChild(slice);
      }
      return container;
    };

    chatMain.appendChild(buildBlur('bottom'));
  },

  magnetic(el, strength = 0.28) {
    if (!el || reduced || window.matchMedia('(pointer: coarse)').matches) return;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      animate(el, { x: dx * strength, y: dy * strength }, { type: 'spring', stiffness: 280, damping: 18, mass: 0.4 });
    };

    const onLeave = () => {
      animate(el, { x: 0, y: 0 }, { type: 'spring', stiffness: 260, damping: 16 });
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
  },

  spotlight(el) {
    if (!el) return;
    el.classList.add('spotlight-card');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--spot-y', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  },

  splitBrand(titleEl) {
    if (!titleEl || titleEl.dataset.split === '1') return;
    const dot = titleEl.querySelector('.dot');
    const text = Array.from(titleEl.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('');

    titleEl.dataset.split = '1';
    titleEl.innerHTML = '';
    text.split('').forEach((ch) => {
      const span = document.createElement('span');
      span.className = 'brand-char';
      span.textContent = ch;
      titleEl.appendChild(span);
    });
    if (dot) titleEl.appendChild(dot);

    if (!reduced) {
      const chars = titleEl.querySelectorAll('.brand-char');
      animate(
        chars,
        { opacity: [0, 1], y: [18, 0] },
        { type: 'spring', duration: 0.7, bounce: 0.22, delay: stagger(0.045) }
      );
    }
  },

  tickNumber(el, nextValue) {
    if (!el) return;
    const next = String(nextValue);
    if (el.textContent === next) return;
    if (reduced) {
      el.textContent = next;
      return;
    }
    animate(el, { y: -8, opacity: 0 }, { duration: 0.12 }).finished
      .then(() => {
        el.textContent = next;
        return animate(el, { y: [8, 0], opacity: [0, 1] }, { type: 'spring', duration: 0.35, bounce: 0.3 });
      })
      .catch(() => { el.textContent = next; });
  },

  boot() {
    if (reduced) document.documentElement.classList.add('reduce-motion');

    this.splitBrand(document.querySelector('.brand-title'));
    this.spotlight(document.querySelector('.auth-card-container'));
    this.injectGradualBlur();
    
    document.querySelectorAll('.btn-primary, .send-btn, .logo-icon').forEach((el) => this.magnetic(el));

    document.querySelectorAll('.btn, .send-btn, .icon-btn, .avatar-opt, .channel-item, .online-user-item, .context-item').forEach((el) => {
      let isScrolling = false;
      
      const release = () => {
        if (reduced) return;
        animate(el, { scale: 1, x: 0, y: 0 }, { type: 'spring', duration: 0.4, bounce: 0.4 });
      };

      el.addEventListener('pointerdown', (e) => {
        if (reduced) return;
        isScrolling = false;
        // Delay slightly for touch to avoid animating during scroll
        if (e.pointerType === 'touch') {
          el._touchTimer = setTimeout(() => {
            if (!isScrolling) animate(el, { scale: 0.94 }, { duration: 0.1 });
          }, 50);
        } else {
          animate(el, { scale: 0.96 }, { duration: 0.1 });
        }
      });
      
      el.addEventListener('touchmove', () => {
        isScrolling = true;
        clearTimeout(el._touchTimer);
        release();
      }, { passive: true });

      el.addEventListener('pointerup', (e) => {
        clearTimeout(el._touchTimer);
        if (!isScrolling) release();
      });
      
      el.addEventListener('pointerleave', (e) => {
        clearTimeout(el._touchTimer);
        release();
      });
      
      el.addEventListener('pointercancel', (e) => {
        clearTimeout(el._touchTimer);
        release();
      });
    });

    const authItems = document.querySelectorAll(
      '.brand-header, .auth-card-container .form-title, .auth-card-container .form-desc, .auth-form.active .input-group, .auth-form.active .btn-primary, .auth-switch, .auth-owner-credit'
    );
    this.staggerIn(authItems, { y: 14, step: 0.045 });
  }
};

window.SChatMotion = MotionFX;
