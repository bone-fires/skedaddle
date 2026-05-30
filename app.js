(function () {
  const cfg = window.ANNIVERSARY_CONFIG || {};
  const CAROUSEL_RADIUS_SCALE = 0.25;

  let photos = [];
  let lightboxIndex = 0;
  let sessionPhotos = [];

  let rotation = 0;
  let selectedIndex = null;
  let dragState = null;
  let autoRotateId = null;
  let lastInteraction = 0;
  let carouselCards = [];
  let carouselPhotos = [];
  let carouselSetup = false;
  let tracks = [];
  let trackIndex = 0;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function initConfig() {
    const names = cfg.names || "Acha & Amma";
    $("#hero-title").textContent = names;
    $("#footer-names").textContent = names;
    if (cfg.subtitle) $("#hero-subtitle").innerHTML = cfg.subtitle;
    if (cfg.anniversaryLabel) $("#hero-eyebrow").textContent = cfg.anniversaryLabel;

    const dedication = $("#hero-dedication");
    if (dedication && cfg.dedication) dedication.innerHTML = cfg.dedication;

    initAnniversaryTicker();
  }

  async function loadPhotos() {
    let fromManifest = [];
    try {
      const res = await fetch("photos/photo-manifest.json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          fromManifest = data.map((p, i) => ({
            ...normalizePhoto(p, i),
            order: i,
          }));
        }
      }
    } catch {
      /* no manifest */
    }

    const fromConfig = Array.isArray(cfg.photos) ? cfg.photos.map(normalizePhoto) : [];
    let order = fromManifest.length;
    const combined = dedupeBySrc([
      ...fromManifest,
      ...fromConfig.map((p) => ({ ...normalizePhoto(p), order: order++ })),
      ...sessionPhotos.map((p) => ({ ...normalizePhoto(p), order: order++ })),
    ]);
    photos = sortChronologically(combined);
    buildCarousel();
    renderAll();
  }

  function normalizePhoto(p, i) {
    if (typeof p === "string") return { src: p, caption: "", year: null, id: p, order: i };
    return {
      src: p.src,
      caption: p.caption || "",
      year: p.year ?? null,
      id: p.src || `photo-${i}`,
      order: p.order ?? i,
    };
  }

  /** Later entries win — manifest years override config duplicates. */
  function dedupeBySrc(list) {
    const map = new Map();
    list.forEach((p) => map.set(p.src, p));
    return [...map.values()];
  }

  function sortChronologically(list) {
    return [...list].sort((a, b) => {
      const ay = a.year == null ? Infinity : Number(a.year);
      const by = b.year == null ? Infinity : Number(b.year);
      if (ay !== by) return ay - by;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickCarouselPhotos(pool) {
    if (!pool.length) return [];
    const maxCount = Math.min(15, pool.length);
    const minCount = Math.min(10, pool.length);
    const count =
      minCount === maxCount
        ? maxCount
        : minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
    const copy = [...pool];
    shuffle(copy);
    return copy.slice(0, count);
  }

  function renderAll() {
    $("#stat-photos").textContent = String(photos.length);
    const empty = photos.length === 0;
    $("#gallery-empty")?.classList.toggle("hidden", !empty);
    $("#carousel-empty")?.classList.toggle("hidden", !empty);
    renderGallery();
    renderMosaic();
  }

  function renderGallery() {
    const grid = $("#gallery-grid");
    if (!grid) return;
    grid.innerHTML = "";

    photos.forEach((photo, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gallery-item";
      btn.setAttribute("role", "listitem");
      btn.innerHTML = `
        <img src="${escapeAttr(photo.src)}" alt="${escapeAttr(photo.caption || "Memory")}" loading="lazy" />
        <div class="gallery-item-overlay">
          <span class="gallery-item-caption">${escapeHtml(photo.caption || "Memory")}</span>
        </div>
        ${photo.year ? `<span class="gallery-item-year">${photo.year}</span>` : ""}
      `;
      btn.addEventListener("click", () => openLightbox(index));
      grid.appendChild(btn);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => btn.classList.add("visible"));
      });
    });
  }

  function renderMosaic() {
    const wall = $("#mosaic-wall");
    if (!wall) return;
    wall.innerHTML = "";

    if (!photos.length) return;

    // Creative freedom: scatter photos randomly like a messy, chaotic, college photobook scrapbook!
    const pool = [...photos];
    shuffle(pool);
    // Select up to 22 photos for clean yet chaotic scattering
    const count = Math.min(22, pool.length);
    const selected = pool.slice(0, count);

    const wallW = wall.clientWidth || 1000;
    const wallH = wall.clientHeight || 580;

    const centerX = wallW / 2;
    const centerY = wallH / 2;

    // Use a loose grid to make sure elements are distributed evenly across the screen space
    const cols = 5;
    const rows = 3;
    const cellW = wallW / cols;
    const cellH = wallH / rows;

    selected.forEach((photo, index) => {
      const tile = document.createElement("div");
      tile.className = "mosaic-tile";

      const col = index % cols;
      const row = Math.floor(index / cols) % rows;

      // Add a generous random scatter displacement within each loose grid cell
      const offsetX = (Math.random() - 0.5) * (cellW * 0.45);
      const offsetY = (Math.random() - 0.5) * (cellH * 0.45);

      const baseX = col * cellW + cellW / 2;
      const baseY = row * cellH + cellH / 2;

      // Bunch photos closer together in the center (55% scale)
      const x = centerX + (baseX - centerX) * 0.55 + offsetX * 0.6;
      const y = centerY + (baseY - centerY) * 0.55 + offsetY * 0.6;

      // Polaroid photo-book properties
      const size = Math.random() * 40 + 110; // size range 110px to 150px
      const ratio = 1.25; // standard polaroid portrait aspect ratio
      const rot = (Math.random() - 0.5) * 24; // tilt angle between -12 and +12 degrees
      const zIndex = Math.floor(Math.random() * 20) + 1; // scattered layers

      tile.style.width = `${size}px`;
      tile.style.height = `${size * ratio}px`;
      tile.style.left = `${x - size / 2}px`;
      tile.style.top = `${y - (size * ratio) / 2}px`;

      // Store initial state for physics displacement calculations
      tile.dataset.ox = x - size / 2;
      tile.dataset.oy = y - (size * ratio) / 2;
      tile.dataset.or = rot;
      tile.dataset.oz = zIndex;

      tile.style.transform = `rotate(${rot}deg)`;
      tile.style.zIndex = zIndex;

      // Add tape effect on some polaroids for that vintage handmade feel
      if (Math.random() > 0.4) {
        tile.classList.add("taped");
      }

      tile.innerHTML = `<img src="${escapeAttr(photo.src)}" alt="" loading="lazy" />`;

      // Distinguish clicking vs dragging
      let dragStartX = 0;
      let dragStartY = 0;
      let dragMoved = false;
      let tileStartX = 0;
      let tileStartY = 0;

      tile.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        dragMoved = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        tileStartX = parseFloat(tile.style.left) || 0;
        tileStartY = parseFloat(tile.style.top) || 0;
        tile.style.zIndex = "1001"; // lift to front while dragging
        tile.style.transition = "none"; // disable transition for snappy response
        tile.setPointerCapture(e.pointerId);
      });

      tile.addEventListener("pointermove", (e) => {
        if (tile.style.zIndex !== "1001") return;
        e.stopPropagation();
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragMoved = true;
        }
        const newX = tileStartX + dx;
        const newY = tileStartY + dy;
        tile.style.left = `${newX}px`;
        tile.style.top = `${newY}px`;
        // Save new anchors so magnet effect pulls them back to new drop spots
        tile.dataset.ox = newX;
        tile.dataset.oy = newY;
      });

      const releaseDrag = (e) => {
        if (tile.style.zIndex !== "1001") return;
        tile.style.transition = ""; // restore default smooth transitions
        tile.style.zIndex = tile.dataset.oz; // restore layered zIndex
        try {
          tile.releasePointerCapture(e.pointerId);
        } catch { }
      };

      tile.addEventListener("pointerup", releaseDrag);
      tile.addEventListener("pointercancel", releaseDrag);

      const originalIndex = photos.indexOf(photo);
      tile.addEventListener("click", (e) => {
        if (dragMoved) {
          e.preventDefault();
          e.stopPropagation();
          return; // Dragged, don't open lightbox
        }
        openLightbox(originalIndex);
      });

      wall.appendChild(tile);
    });

    initMosaicParallax(wall);
  }

  function initMosaicParallax(wall) {
    const tiles = wall.querySelectorAll(".mosaic-tile");

    // Dynamic magnetic breathing / displacement as cursor swings near Polaroids
    wall.onmousemove = (e) => {
      // Don't apply magnet forces to active drag targets
      const isDragging = Array.from(tiles).some((t) => t.style.zIndex === "1001");
      if (isDragging) return;

      const rect = wall.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      tiles.forEach((tile) => {
        const tx = parseFloat(tile.dataset.ox) + tile.clientWidth / 2;
        const ty = parseFloat(tile.dataset.oy) + tile.clientHeight / 2;

        const dx = tx - mx;
        const dy = ty - my;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

        if (dist < 260) {
          const force = (260 - dist) / 260; // range 0 to 1
          const pushX = dx * force * 0.18; // soft physical deflection vector
          const pushY = dy * force * 0.18;

          const originalRot = parseFloat(tile.dataset.or) || 0;
          const targetRot = originalRot + (dx > 0 ? 1 : -1) * force * 8; // gentle pivot tilt

          tile.style.transform = `translate(${pushX}px, ${pushY}px) rotate(${targetRot}deg) scale(1.02)`;
          tile.style.boxShadow = `0 12px 24px rgba(0, 0, 0, ${0.3 + force * 0.15})`;
        } else {
          const rot = tile.dataset.or;
          tile.style.transform = `translate(0, 0) rotate(${rot}deg)`;
          tile.style.boxShadow = "";
        }
      });
    };

    wall.onmouseleave = () => {
      tiles.forEach((tile) => {
        if (tile.style.zIndex === "1001") return;
        const rot = tile.dataset.or;
        tile.style.transform = `translate(0, 0) rotate(${rot}deg)`;
        tile.style.boxShadow = "";
      });
    };
  }

  function computeRadius(n) {
    const cardW = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--card-w"), 10) || 120;
    const gap = 14;
    const safeN = Math.max(n, 3);
    const minNoOverlap = Math.ceil((cardW + gap) / (2 * Math.sin(Math.PI / safeN)));

    let base = cfg.carouselRadius;
    if (base == null) {
      base = Math.min(880, Math.max(260, Math.ceil(cardW / 2 / Math.sin(Math.PI / safeN)) + 30));
    }
    return Math.max(minNoOverlap, Math.round(base * CAROUSEL_RADIUS_SCALE));
  }

  function buildCarousel() {
    const ring = $("#carousel-ring");
    const viewport = $("#carousel-viewport");
    if (!ring || !viewport) return;

    ring.innerHTML = "";
    carouselCards = [];
    carouselPhotos = pickCarouselPhotos(photos);
    selectedIndex = null;
    updateFocusCaption();

    const n = carouselPhotos.length;
    if (!n) {
      ring.style.transform = "rotateY(0deg)";
      return;
    }

    document.documentElement.style.setProperty("--carousel-radius", `${computeRadius(n)}px`);

    carouselPhotos.forEach((photo, i) => {
      const angle = (360 / n) * i;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "carousel-card";
      btn.style.setProperty("--card-angle", `${angle}deg`);
      btn.setAttribute("aria-label", photo.caption || `Photo ${i + 1}`);
      btn.innerHTML = `
        <div class="carousel-card-inner">
          <img src="${escapeAttr(photo.src)}" alt="${escapeAttr(photo.caption || "Memory")}" loading="lazy" draggable="false" />
        </div>
      `;
      btn.addEventListener("click", (e) => onCardClick(e, i));
      ring.appendChild(btn);
      carouselCards.push(btn);
    });

    applyRotation();
    updateCarouselCardTransforms();
    if (!carouselSetup) {
      setupCarouselInteraction(viewport, ring);
      carouselSetup = true;
    }
    startAutoRotate();
  }

  function applyRotation() {
    const ring = $("#carousel-ring");
    if (ring) ring.style.transform = `rotateY(${rotation}deg)`;
    updateCarouselCardTransforms();
  }

  function updateCarouselCardTransforms() {
    carouselCards.forEach((card, i) => {
      const angle = card.style.getPropertyValue("--card-angle") || "0deg";
      const selected = i === selectedIndex;
      if (selected) {
        // Counteract the ring's rotation and tilt to place the card perfectly flat in the center
        // rotateY(-rotation) counters the ring's Y rotation
        // rotateX(30deg) counters the carousel's -30deg vertical tilt
        // translateZ(80px) elevates the card slightly toward the user to float elegantly above the floor
        card.style.transform = `rotateY(${-rotation}deg) rotateX(30deg) translateZ(80px)`;
        card.style.opacity = "1";
        card.style.filter = "none";
        card.style.pointerEvents = "auto";
      } else {
        card.style.transform = `rotateY(${angle}) translateZ(var(--carousel-radius))`;
        if (selectedIndex !== null) {
          card.style.opacity = "0.22";
          card.style.filter = "grayscale(25%) blur(0.6px)";
          card.style.pointerEvents = "none"; // Pass clicks through semi-transparent cards in front
        } else {
          card.style.opacity = "1";
          card.style.filter = "none";
          card.style.pointerEvents = "auto";
        }
      }
    });
  }

  function markCarouselInteraction() {
    lastInteraction = performance.now();
  }

  function startAutoRotate() {
    if (autoRotateId) cancelAnimationFrame(autoRotateId);
    const speed = cfg.autoRotateSpeed ?? 4;
    if (!speed || !carouselPhotos.length) return;
    let last = performance.now();
    function tick(now) {
      autoRotateId = requestAnimationFrame(tick);
      const dt = (now - last) / 1000;
      last = now;
      if (selectedIndex !== null || dragState) return;
      if (performance.now() - lastInteraction < 2500) return;
      rotation += speed * dt;
      applyRotation();
    }
    autoRotateId = requestAnimationFrame(tick);
  }

  function setupCarouselInteraction(viewport, ring) {
    const step = () => 360 / Math.max(carouselCards.length, 1);

    $("#rotate-left")?.addEventListener("click", () => {
      markCarouselInteraction();
      snapCarouselBy(-step());
    });
    $("#rotate-right")?.addEventListener("click", () => {
      markCarouselInteraction();
      snapCarouselBy(step());
    });

    viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        markCarouselInteraction();
        ring.classList.remove("is-snapping");
        rotation += e.deltaY * 0.15 + e.deltaX * 0.15;
        applyRotation();
      },
      { passive: false }
    );

    // Native viewport click fallback (handles empty space deselect for standard click events)
    viewport.addEventListener("click", (e) => {
      if (!e.target.closest(".carousel-card")) deselectCarousel();
    });

    viewport.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      markCarouselInteraction();
      dragState = {
        startX: e.clientX,
        startY: e.clientY,
        rot: rotation,
        time: performance.now()
      };
      viewport.classList.add("is-dragging");
      ring.classList.remove("is-snapping");
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener("pointermove", (e) => {
      if (!dragState) return;
      rotation = dragState.rot + (e.clientX - dragState.startX) * 0.35;
      applyRotation();
    });

    const endDrag = (e) => {
      if (!dragState) return;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = performance.now() - dragState.time;

      dragState = null;
      viewport.classList.remove("is-dragging");
      try {
        viewport.releasePointerCapture(e.pointerId);
      } catch {
        /* ok */
      }

      // Robust tap/click gesture detection (bypasses pointer capture blocking)
      if (dist < 6 && duration < 300) {
        const cardEl = e.target.closest(".carousel-card");
        if (cardEl) {
          const index = carouselCards.indexOf(cardEl);
          if (index !== -1) {
            onCardClick(e, index);
          }
        } else {
          deselectCarousel();
        }
      }
    };
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
  }

  function snapCarouselBy(delta) {
    const ring = $("#carousel-ring");
    ring?.classList.add("is-snapping");
    rotation += delta;
    applyRotation();
    markCarouselInteraction();
    setTimeout(() => ring?.classList.remove("is-snapping"), 560);
  }

  function snapToCard(index) {
    const n = carouselCards.length;
    if (!n) return;
    const ring = $("#carousel-ring");
    ring?.classList.add("is-snapping");
    rotation = -(360 / n) * index;
    applyRotation();
    markCarouselInteraction();
    setTimeout(() => ring?.classList.remove("is-snapping"), 560);
  }

  let lastClickTime = 0;
  function onCardClick(e, index) {
    if (e) e.stopPropagation();
    const now = performance.now();
    if (now - lastClickTime < 120) return; // Debounce dual native/pointer gesture triggers
    lastClickTime = now;

    markCarouselInteraction();
    if (selectedIndex === index) {
      deselectCarousel();
      return;
    }
    selectCarousel(index);
    snapToCard(index);
  }

  function selectCarousel(index) {
    selectedIndex = index;
    carouselCards.forEach((card, i) => {
      const selected = i === index;
      card.classList.toggle("is-selected", selected);
      card.style.zIndex = selected ? "30" : "1";
    });
    updateCarouselCardTransforms();
    updateFocusCaption();
  }

  function deselectCarousel() {
    selectedIndex = null;
    carouselCards.forEach((c) => {
      c.classList.remove("is-selected");
      c.style.zIndex = "1";
    });
    updateCarouselCardTransforms();
    updateFocusCaption();
    startAutoRotate();
  }

  function updateFocusCaption() {
    const cap = $("#focus-caption");
    if (!cap) return;
    if (selectedIndex === null || !carouselPhotos[selectedIndex]) {
      cap.classList.add("hidden");
      cap.textContent = "";
      return;
    }
    const p = carouselPhotos[selectedIndex];
    cap.textContent = p.caption || "";
    cap.classList.toggle("hidden", !cap.textContent);
  }

  function renderLightboxFilmstrip() {
    const strip = $("#lightbox-filmstrip");
    if (!strip) return;
    strip.innerHTML = "";
    photos.forEach((photo, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lightbox-strip-item";
      btn.setAttribute("role", "listitem");
      if (i === lightboxIndex) btn.classList.add("is-active");
      btn.innerHTML = `<img src="${escapeAttr(photo.src)}" alt="" loading="lazy" />`;
      btn.addEventListener("click", () => openLightbox(i));
      strip.appendChild(btn);
    });
    scrollFilmstripToActive();
  }

  function scrollFilmstripToActive() {
    const strip = $("#lightbox-filmstrip");
    const active = strip?.querySelector(".lightbox-strip-item.is-active");
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  function updateLightboxMain() {
    if (!photos.length) return;
    const photo = photos[lightboxIndex];
    $("#lightbox-img").src = photo.src;
    $("#lightbox-img").alt = photo.caption || "Memory";
    $("#lightbox-caption").textContent = photo.caption || "";
    $("#lightbox-counter").textContent = `${lightboxIndex + 1} / ${photos.length}`;
    $("#lightbox-filmstrip")
      ?.querySelectorAll(".lightbox-strip-item")
      .forEach((el, i) => el.classList.toggle("is-active", i === lightboxIndex));
    scrollFilmstripToActive();
  }

  async function loadMusic() {
    const fromConfig = Array.isArray(cfg.music) ? cfg.music : [];
    let fromManifest = [];
    try {
      const res = await fetch("music/music-manifest.json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) fromManifest = data;
      }
    } catch {
      /* no manifest */
    }
    tracks = dedupeBySrc([...fromConfig, ...fromManifest]).filter((t) => t?.src);
    if (!tracks.length) {
      $("#music-panel")?.classList.add("hidden");
      return;
    }
    setTrack(0);
    setupMusicControls();
  }

  function setTrack(index) {
    const audio = $("#bg-audio");
    if (!audio || !tracks.length) return;
    trackIndex = ((index % tracks.length) + tracks.length) % tracks.length;
    const t = tracks[trackIndex];
    audio.src = t.src;
    audio.loop = tracks.length === 1 && cfg.musicLoop !== false;
    const label = $("#music-track-label");
    if (label) label.textContent = t.title || "Track";
  }

  function setupMusicControls() {
    const audio = $("#bg-audio");
    const toggle = $("#music-toggle");
    const vol = $("#music-volume");
    if (!audio || !toggle) return;

    const playIcon = toggle.querySelector(".music-icon-play");
    const pauseIcon = toggle.querySelector(".music-icon-pause");

    function syncIcons() {
      const playing = !audio.paused;
      playIcon?.classList.toggle("hidden", playing);
      pauseIcon?.classList.toggle("hidden", !playing);
    }

    toggle.addEventListener("click", async () => {
      try {
        if (audio.paused) await audio.play();
        else audio.pause();
      } catch {
        /* ok */
      }
      syncIcons();
    });

    audio.addEventListener("play", syncIcons);
    audio.addEventListener("pause", syncIcons);
    if (vol) {
      audio.volume = Number(vol.value);
      vol.addEventListener("input", () => {
        audio.volume = Number(vol.value);
      });
    }
    audio.addEventListener("ended", () => {
      if (tracks.length > 1) {
        setTrack(trackIndex + 1);
        audio.play().catch(() => { });
      }
    });
    syncIcons();

    // Autoplay music on the first user interaction anywhere on the page
    const startAudio = async () => {
      // If the audio source is not ready yet, keep the listeners active and wait
      if (!audio.src || audio.src.endsWith("#") || audio.src === "") return;

      if (audio.paused) {
        try {
          await audio.play();
        } catch (err) {
          console.warn("Playback failed on touch:", err);
          return; // Keep listeners active if blocked
        }
      }

      // Successfully playing! Clean up the startup listeners
      window.removeEventListener("pointerup", startAudio);
      window.removeEventListener("click", startAudio);
      window.removeEventListener("keydown", startAudio);
    };
    window.addEventListener("pointerup", startAudio);
    window.addEventListener("click", startAudio);
    window.addEventListener("keydown", startAudio);
  }

  function openLightbox(index) {
    if (!photos.length) return;
    lightboxIndex = ((index % photos.length) + photos.length) % photos.length;
    $("#lightbox").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    renderLightboxFilmstrip();
    updateLightboxMain();
  }

  function closeLightbox() {
    $("#lightbox").classList.add("hidden");
    document.body.style.overflow = "";
  }

  function stepLightbox(delta) {
    if (!photos.length) return;
    lightboxIndex =
      ((lightboxIndex + delta) % photos.length + photos.length) % photos.length;
    updateLightboxMain();
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function setupNav() {
    $$("[data-scroll]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-scroll");
        if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" });
        else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function setupLightbox() {
    $("#lightbox-close")?.addEventListener("click", closeLightbox);
    $("#lightbox-prev")?.addEventListener("click", () => stepLightbox(-1));
    $("#lightbox-next")?.addEventListener("click", () => stepLightbox(1));
    $("#lightbox")?.addEventListener("click", (e) => {
      if (e.target.id === "lightbox") closeLightbox();
    });
    document.addEventListener("keydown", (e) => {
      const lbOpen = !$("#lightbox").classList.contains("hidden");
      if (lbOpen) {
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowLeft") stepLightbox(-1);
        if (e.key === "ArrowRight") stepLightbox(1);
        return;
      }
      if (!carouselCards.length) return;
      if (e.key === "Escape") deselectCarousel();
      const step = 360 / carouselCards.length;
      if (e.key === "ArrowLeft") {
        markCarouselInteraction();
        snapCarouselBy(-step);
      }
      if (e.key === "ArrowRight") {
        markCarouselInteraction();
        snapCarouselBy(step);
      }
    });
  }

  function addSessionFiles(files) {
    Array.from(files).forEach((file, i) => {
      if (!file.type.startsWith("image/")) return;
      sessionPhotos.push({
        src: URL.createObjectURL(file),
        caption: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        year: null,
        id: `session-${Date.now()}-${i}`,
      });
    });
    loadPhotos();
  }

  function setupUpload() {
    const input = $("#file-input");
    const zone = $("#upload-dropzone");
    if (!input || !zone) return;
    zone.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") input.click();
    });
    input.addEventListener("change", () => {
      if (input.files?.length) addSessionFiles(input.files);
      input.value = "";
    });
    ["dragenter", "dragover"].forEach((ev) => {
      zone.addEventListener(ev, (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      zone.addEventListener(ev, (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        if (ev === "drop" && e.dataTransfer?.files?.length) {
          addSessionFiles(e.dataTransfer.files);
        }
      });
    });
  }

  function initAnniversaryTicker() {
    const weddingDate = new Date("2004-05-30T11:00:00");
    const yearsEl = $("#hero-years");
    const statYearsEl = $("#stat-years");

    function updateTicker() {
      const now = new Date();
      let diffMs = now - weddingDate;
      if (diffMs < 0) diffMs = 0;

      let start = new Date(weddingDate);
      let end = new Date(now);

      let years = end.getFullYear() - start.getFullYear();

      // Check if anniversary has occurred this year
      const anniversaryThisYear = new Date(
        end.getFullYear(),
        start.getMonth(),
        start.getDate(),
        start.getHours(),
        start.getMinutes(),
        start.getSeconds()
      );
      if (end < anniversaryThisYear) {
        years--;
      }

      // Get last anniversary crossed
      const lastAnniversary = new Date(weddingDate);
      lastAnniversary.setFullYear(weddingDate.getFullYear() + years);

      let diff = end - lastAnniversary;

      const oneDay = 24 * 60 * 60 * 1000;
      const oneHour = 60 * 60 * 1000;
      const oneMinute = 60 * 1000;

      const days = Math.floor(diff / oneDay);
      diff %= oneDay;

      const hours = Math.floor(diff / oneHour);
      diff %= oneHour;

      const minutes = Math.floor(diff / oneMinute);
      diff %= oneMinute;

      const seconds = Math.floor(diff / 1000);

      if (yearsEl) {
        yearsEl.innerHTML = `
          <span class="ticker-unit">${years}</span>y 
          <span class="ticker-unit">${days}</span>d 
          <span class="ticker-unit">${hours}</span>h 
          <span class="ticker-unit">${minutes}</span>m 
          <span class="ticker-unit">${seconds}</span>s 
          <span class="ticker-suffix">of forever</span>
        `;
      }

      if (statYearsEl) {
        statYearsEl.textContent = String(years);
      }
    }

    updateTicker();
    setInterval(updateTicker, 1000);
  }

  function initSparkles() {
    const canvas = document.createElement("canvas");
    canvas.id = "sparkle-canvas";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9998";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let centerX = width / 2;
    let centerY = height * 0.4;

    function updateCenter() {
      const viewport = document.querySelector(".carousel-viewport");
      if (viewport) {
        const rect = viewport.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
      } else {
        centerX = window.innerWidth / 2;
        centerY = window.innerHeight * 0.4;
      }
    }

    window.addEventListener("resize", () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      updateCenter();
    });

    // Run initial center check
    setTimeout(updateCenter, 100);

    const particles = [];
    let lastX = null;
    let lastY = null;

    window.addEventListener("pointermove", (e) => {
      const mx = e.clientX;
      const my = e.clientY;

      if (lastX === null || lastY === null) {
        lastX = mx;
        lastY = my;
        return;
      }

      const dx = mx - lastX;
      const dy = my - lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 8) {
        const count = Math.min(3, Math.floor(dist / 12) + 1);
        for (let i = 0; i < count; i++) {
          const t = i / count;
          const sx = lastX + dx * t;
          const sy = lastY + dy * t;

          // Spawn particle at a random depth in the carousel zone (e.g. z = -100 to 250)
          const pz = Math.random() * 350 - 100;
          const scale = 1200 / (1200 - pz);

          // Back-project screen coordinates to tilted 3D space
          const px = (sx - centerX) / scale;
          const py = (sy - centerY) / scale;

          particles.push({
            x: px,
            y: py,
            z: pz,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5 - 0.2,
            vz: (Math.random() - 0.5) * 1.5,
            size: Math.random() * 1.6 + 0.8,
            alpha: Math.random() * 0.4 + 0.55,
            decay: Math.random() * 0.008 + 0.006, // slightly longer lifetime to let them orbit!
            color: Math.random() > 0.35 ? "245, 240, 232" : "201, 169, 98"
          });
        }
        lastX = mx;
        lastY = my;
      }
    });

    window.addEventListener("pointerdown", (e) => {
      const mx = e.clientX;
      const my = e.clientY;
      // Spawn a burst of 12 3D particles from the click depth!
      const pz = selectedIndex !== null ? 80 : Math.random() * 200 + 100;
      const scale = 1200 / (1200 - pz);
      const px = (mx - centerX) / scale;
      const py = (my - centerY) / scale;

      for (let i = 0; i < 12; i++) {
        const angle1 = Math.random() * Math.PI * 2;
        const angle2 = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1.2;

        particles.push({
          x: px,
          y: py,
          z: pz,
          vx: Math.cos(angle1) * Math.sin(angle2) * speed,
          vy: Math.sin(angle1) * Math.sin(angle2) * speed - 0.3,
          vz: Math.cos(angle2) * speed,
          size: Math.random() * 1.8 + 1.2,
          alpha: Math.random() * 0.4 + 0.6,
          decay: Math.random() * 0.014 + 0.008,
          color: Math.random() > 0.3 ? "245, 240, 232" : "201, 169, 98"
        });
      }
    });

    function getCardPositions() {
      const pos = [];
      const n = carouselCards.length;
      if (!n) return pos;

      // Calculate radius dynamically (matches computeRadius in app.js)
      const cardW = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--card-w"), 10) || 120;
      const gap = 14;
      const safeN = Math.max(n, 3);
      const minNoOverlap = Math.ceil((cardW + gap) / (2 * Math.sin(Math.PI / safeN)));
      let base = cfg.carouselRadius;
      if (base == null) {
        base = Math.min(880, Math.max(260, Math.ceil(cardW / 2 / Math.sin(Math.PI / safeN)) + 30));
      }
      const radius = Math.max(minNoOverlap, Math.round(base * CAROUSEL_RADIUS_SCALE));

      carouselCards.forEach((card, i) => {
        const selected = i === selectedIndex;
        let cx, cy, cz;

        if (selected) {
          cx = 0;
          cy = 80 * Math.sin(30 * Math.PI / 180);
          cz = 80 * Math.cos(30 * Math.PI / 180);
        } else {
          const angleStr = card.style.getPropertyValue("--card-angle") || "0deg";
          const angle = parseFloat(angleStr) || 0;
          const netAngle = (angle + rotation) * Math.PI / 180;

          const cx_pivot = Math.sin(netAngle) * radius;
          const cz_pivot = Math.cos(netAngle) * radius;

          // Project through the X-axis tilt (-30deg)
          cx = cx_pivot;
          cy = cz_pivot * Math.sin(30 * Math.PI / 180);
          cz = cz_pivot * Math.cos(30 * Math.PI / 180);
        }

        pos.push({ x: cx, y: cy, z: cz });
      });

      return pos;
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Recalculate center dynamically in case layout shifted
      updateCenter();

      const cards = getCardPositions();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // 3D Physical Interactions with Carousel Cards
        cards.forEach((card) => {
          const dx = card.x - p.x;
          const dy = card.y - p.y;
          const dz = card.z - p.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;

          if (dist < 100) {
            // Attraction pull towards the card
            const pull = (100 - dist) * 0.00035;
            p.vx += dx * pull;
            p.vy += dy * pull;
            p.vz += dz * pull;

            // Swirl orbit force around the card
            const swirl = (100 - dist) * 0.0007;
            p.vx += dz * swirl;
            p.vz -= dx * swirl;
          }
        });

        // Apply friction drag so orbits are stable & elegant
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.vz *= 0.94;

        // Update positions
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.alpha -= p.decay;

        // Clip if behind camera or faded
        if (p.alpha <= 0 || p.z >= 1150) {
          particles.splice(i, 1);
          continue;
        }

        // Project back to 2D screen
        const scale = 1200 / (1200 - p.z);
        const sx = centerX + p.x * scale;
        const sy = centerY + p.y * scale;

        // Only draw if inside viewport boundaries
        if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
          const size = p.size * scale;
          const alpha = p.alpha * Math.min(1.5, Math.max(0.15, scale * 0.6));

          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.4, size), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.color}, ${alpha})`;

          if (size > 1.8) {
            ctx.shadowBlur = 4;
            ctx.shadowColor = `rgba(${p.color}, ${alpha * 0.5})`;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.fill();
        }
      }
      ctx.shadowBlur = 0; // reset
      requestAnimationFrame(animate);
    }

    animate();
  }

  initConfig();
  setupNav();
  setupLightbox();
  setupUpload();
  loadPhotos();
  loadMusic();
  initSparkles();
})();
