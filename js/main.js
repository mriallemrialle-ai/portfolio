/* ============================================================
   Мария · Portfolio interactions
   ============================================================ */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Scroll reveals + count-up trigger ---------- */
  const revealEls = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("in"));
    document.querySelectorAll("[data-target]").forEach(setFinalValue);
  } else {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          entry.target.querySelectorAll("[data-target]").forEach(countUp);
          if (entry.target.matches("[data-target]")) countUp(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- 2. Number count-up ---------- */
  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const target = parseFloat(el.dataset.target);
    if (Number.isNaN(target)) return;
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const duration = 1300;
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function setFinalValue(el) {
    const target = parseFloat(el.dataset.target);
    if (Number.isNaN(target)) return;
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    el.textContent = (el.dataset.prefix || "") + target.toFixed(decimals) + (el.dataset.suffix || "");
  }

  /* ---------- 3. Hero — reference for dock visibility ---------- */
  const hero = document.querySelector(".hero");

  /* ---------- 4. Dock — hidden on hero, visible after scroll ---------- */
  const dock = document.querySelector(".dock");

  if (dock) {
    const heroHeight = () => hero ? hero.offsetHeight : window.innerHeight;

    const checkDock = () => {
      const past = window.scrollY > heroHeight() * 0.6;
      dock.classList.toggle("dock--visible", past);
    };

    window.addEventListener("scroll", checkDock, { passive: true });
    checkDock(); // initial state
  }

  /* ---------- 5. Gallery + Cases — drag to scroll ---------- */
  [".gallery__strip", ".cases__slider-wrap"].forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;

    /* drag */
    let isDown = false, startX = 0, scrollLeft = 0;
    el.addEventListener("mousedown", (e) => { isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; });
    el.addEventListener("mouseleave", () => { isDown = false; });
    el.addEventListener("mouseup", () => { isDown = false; });
    el.addEventListener("mousemove", (e) => { if (!isDown) return; e.preventDefault(); el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX); });

    /* wheel: horizontal → strip, vertical → page */
    el.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return; // let vertical pass through
      e.preventDefault();
      el.scrollLeft += e.deltaX || e.deltaY;
    }, { passive: false });
  });

  /* ---------- 6. Studio — image "galaxy": 3D depth + infinite scroll drift ---------- */
  const studio = document.querySelector(".studio");
  const scatter = studio && studio.querySelector(".studio__scatter");
  if (studio && scatter && !reduceMotion) {
    const CFG = {
      idle: 0.3,         // constant drift per frame — keeps flying without scrolling
      ease: 0.09,        // how fast `current` chases `target`
      scaleEase: 0.08,   // smoothing of the per-tile scale
      scrollMult: 0.1,   // how much raw scroll velocity feeds the drift
      scaleMin: 0.55,
      scaleMax: 1.35,
    };
    const Z = [-260, -190, -120, -60, 0, 60, 120, 190, 260]; // depth planes (px)
    const SPD = [0.8, 0.9, 1, 1.1, 1.2];                     // per-tile parallax speed

    // densify the field by cloning the source frames
    const TARGET = 28;
    const base = Array.from(scatter.querySelectorAll(".studio__pic"));
    const baseN = base.length;
    for (let i = base.length; i < TARGET; i++) {
      scatter.appendChild(base[i % baseN].cloneNode(true));
    }

    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const lerp = (a, b, t) => a + (b - a) * t;

    const tiles = Array.from(scatter.querySelectorAll(".studio__pic")).map((el, i) => {
      const z = Z[i % Z.length];
      const veil = z < 0 ? 1 - Math.max(0.45, 1 + z / 320) : 0; // back tiles fade to white
      el.style.left = rnd(3, 92).toFixed(2) + "%";
      el.style.top = rnd(0, 100).toFixed(2) + "%";
      el.style.transform = "translate(-50%, -50%)";            // anchor for measuring baseline
      el.style.opacity = "0";
      const float = el.querySelector(".studio__pic-float");
      if (float) float.style.setProperty("--ov", veil.toFixed(3));
      return { el, i, z, speed: SPD[i % SPD.length], top: 0, height: 0, extra: 0, scale: 1 };
    });

    let containerH = 0, off = 0;
    const measure = () => {
      const cr = scatter.getBoundingClientRect();
      containerH = scatter.clientHeight;
      off = containerH * 0.12;
      tiles.forEach((t) => {
        const r = t.el.getBoundingClientRect();
        t.top = r.top - cr.top;
        t.height = r.height || 120;
        t.extra = 0;
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    scatter.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", measure, { once: true });
    });

    // scroll velocity + direction
    let lastScroll = window.scrollY || 0;
    let target = 0, current = 0, last = 0, dirSign = 1;

    // staggered intro reveal once the block scrolls into view
    let introStart = 0;
    new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !introStart) { introStart = performance.now(); obs.disconnect(); }
      });
    }, { threshold: 0.15 }).observe(studio);
    const STAGGER = 45, REVEAL = 700;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    (function tick(now) {
      const sy = window.scrollY || 0;
      const vel = sy - lastScroll;
      lastScroll = sy;
      if (vel !== 0) dirSign = Math.sign(vel);

      target += vel * CFG.scrollMult + CFG.idle * dirSign;
      current = lerp(current, target, CFG.ease);
      const dir = current > last ? "down" : "up"; // current grows on scroll-down → tiles fly down
      last = current;

      tiles.forEach((t) => {
        let pos = current * t.speed + t.extra;
        let y = t.top + pos;
        // infinite recycle once a tile fully clears the field
        if (dir === "down" && y > containerH + off) { t.extra -= containerH + t.height + off * 2; pos = current * t.speed + t.extra; y = t.top + pos; }
        if (dir === "up" && y + t.height < -off)     { t.extra += containerH + t.height + off * 2; pos = current * t.speed + t.extra; y = t.top + pos; }

        // grow as the tile travels down the field (depth cue)
        const l = clamp01(y / containerH);
        const targetScale = CFG.scaleMin + l * (CFG.scaleMax - CFG.scaleMin);
        t.scale = lerp(t.scale, targetScale, CFG.scaleEase);

        // staggered fade-in
        let intro = 1;
        if (!introStart) intro = 0;
        else {
          const tt = (now - introStart - t.i * STAGGER) / REVEAL;
          intro = tt <= 0 ? 0 : tt >= 1 ? 1 : easeOut(tt);
        }
        // fade near the top/bottom clip so recycling is seamless
        const edge = clamp01(Math.min((y + t.height) / off, (containerH - y) / off, 1));

        t.el.style.transform = `translate(-50%, -50%) translate3d(0, ${pos.toFixed(1)}px, ${t.z}px) scale(${t.scale.toFixed(3)})`;
        t.el.style.opacity = (edge * intro).toFixed(3);
      });
      requestAnimationFrame(tick);
    })();
  }

  /* ---------- 7. Lightbox — click a studio image to open it ---------- */
  const lightbox = document.getElementById("lightbox");
  if (lightbox) {
    const lbImg = lightbox.querySelector(".lightbox__img");
    const closeBtn = lightbox.querySelector(".lightbox__close");

    const open = (src, alt) => {
      lbImg.src = src;
      lbImg.alt = alt || "";
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    };

    document.querySelectorAll(".studio__pic img").forEach((img) => {
      img.closest(".studio__pic").addEventListener("click", () => {
        open(img.src.replace(/\/\d+\/\d+/, "/1200/1600"), img.alt);
      });
    });

    closeBtn.addEventListener("click", close);
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

})();
