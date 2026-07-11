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

  /* ---------- 6. Studio — images magnetised to the cursor ---------- */
  const studio = document.querySelector(".studio");
  if (studio && !reduceMotion) {
    const pics = Array.from(studio.querySelectorAll(".studio__pic")).map((el, i) => {
      el.style.opacity = "0";           // hidden until the reveal plays
      el.style.setProperty("--rs", "0.35");
      return {
        el,
        i,
        depth: parseFloat(el.dataset.depth) || 0.06,
        baseY: (parseFloat(el.style.getPropertyValue("--y")) || 50) / 100, // fraction of section height
        cx: 0, cy: 0,   // current cursor offset
        tx: 0, ty: 0,   // target cursor offset
      };
    });

    // staggered intro reveal — fires once the block scrolls into view
    let introStart = 0;
    const introIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !introStart) {
          introStart = performance.now();
          introIO.disconnect();
        }
      });
    }, { threshold: 0.2 });
    introIO.observe(studio);

    studio.addEventListener("pointermove", (e) => {
      const r = studio.getBoundingClientRect();
      const mx = e.clientX - (r.left + r.width / 2);
      const my = e.clientY - (r.top + r.height / 2);
      pics.forEach((p) => { p.tx = mx * p.depth; p.ty = my * p.depth; });
    });
    studio.addEventListener("pointerleave", () => {
      pics.forEach((p) => { p.tx = 0; p.ty = 0; });
    });

    const MARGIN = 200;          // travel buffer above/below the section
    const FADE = 240;            // px over which a frame fades near each edge
    const scrollPos = () => window.scrollY || window.pageYOffset || 0;

    const STAGGER = 90;   // ms between frames in the intro
    const REVEAL = 750;   // ms each frame takes to settle
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    (function tick(now) {
      const r = studio.getBoundingClientRect();
      const h = r.height;
      const lane = h + MARGIN * 2;     // total vertical travel before recycling
      const sy0 = scrollPos();

      pics.forEach((p) => {
        // cursor magnet (horizontal + a touch of vertical)
        p.cx += (p.tx - p.cx) * 0.12;
        p.cy += (p.ty - p.cy) * 0.12;

        // continuous upward travel; wraps so frames re-enter from the bottom
        const y0 = p.baseY * h;
        const travel = sy0 * (0.35 + p.depth * 2.4);
        const wrapped = (((y0 - travel + MARGIN) % lane) + lane) % lane - MARGIN; // -MARGIN .. h+MARGIN

        // fade to transparent toward the top and bottom edges of the block
        const edge = Math.max(0, Math.min(1, wrapped / FADE, (h - wrapped) / FADE));

        // staggered scale + fade reveal on first appearance
        let intro = 0;
        if (introStart) {
          const t = (now - introStart - p.i * STAGGER) / REVEAL;
          intro = t <= 0 ? 0 : t >= 1 ? 1 : easeOut(t);
        }

        p.el.style.setProperty("--px", p.cx.toFixed(2) + "px");
        p.el.style.setProperty("--py", p.cy.toFixed(2) + "px");
        p.el.style.setProperty("--sy", (wrapped - y0).toFixed(2) + "px");
        p.el.style.setProperty("--rs", (0.35 + 0.65 * intro).toFixed(3));
        p.el.style.opacity = (edge * intro).toFixed(3);
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
