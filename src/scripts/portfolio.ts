import { lockDocumentScroll, requireElement } from "./dom";

const filters = Array.from(
  document.querySelectorAll<HTMLInputElement>('[name="artwork-filter"]'),
);
const imageButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-lightbox-open]"),
);
const gallery = requireElement<HTMLElement>("#work");
const filterControls = requireElement<HTMLElement>(".filter-controls");
const filterIndicator = requireElement<HTMLElement>("[data-filter-indicator]");
const lightbox = requireElement<HTMLDialogElement>("[data-lightbox]");
const lightboxBackdrop = requireElement<HTMLElement>("[data-lightbox-backdrop]");
const lightboxStage = requireElement<HTMLElement>("[data-lightbox-stage]");
const lightboxViewport = requireElement<HTMLElement>(".lightbox-viewport");
const lightboxTrack = requireElement<HTMLElement>("[data-lightbox-track]");
const lightboxCaption = requireElement<HTMLElement>("[data-lightbox-caption]");
const lightboxCount = requireElement<HTMLElement>("[data-lightbox-count]");
const lightboxRail = requireElement<HTMLElement>("[data-lightbox-rail]");
const lightboxClose = requireElement<HTMLButtonElement>("[data-lightbox-close]");
const lightboxPrevious = requireElement<HTMLButtonElement>(
  "[data-lightbox-previous]",
);
const lightboxNext = requireElement<HTMLButtonElement>("[data-lightbox-next]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

type LightboxGesture = {
  id: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  time: number;
  axis: "x" | "y" | null;
  moved: boolean;
  touch: boolean;
  trackStartX: number;
};

type LightboxPinch = {
  startDistance: number;
  startZoom: number;
  startPanX: number;
  startPanY: number;
  startMidX: number;
  startMidY: number;
};

let renderedFilter = requireElement<HTMLInputElement>(
  '[name="artwork-filter"]:checked',
);
let requestedFilter = renderedFilter;
let categoryTransition: ViewTransition | undefined;
let lightboxAnimations: Animation[] = [];
let closingLightbox = false;
let activeIndex = 0;
let activeButtons: HTMLButtonElement[] = [];
let unlockScroll: (() => void) | undefined;
let chromeTimer: number | undefined;
let zoomTransitionTimer: number | undefined;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let flipToken = 0;
const activePointers = new Map<number, { x: number; y: number }>();
let gesture: LightboxGesture | null = null;
let pinch: LightboxPinch | null = null;
let suppressClick = false;
let wheelAccumulator = 0;
let wheelResetTimer: number | undefined;
let lastWheelNavigation = 0;
let slideEls: HTMLElement[] = [];
let fitEls: HTMLElement[] = [];
let zoomEls: HTMLElement[] = [];
let imgEls: HTMLImageElement[] = [];
let slideDesired: string[] = [];
let slideWidth = 0;

function positionFilterIndicator(animate: boolean) {
  const label = filterControls.querySelector<HTMLElement>(
    `label[for="${renderedFilter.id}"]`,
  );
  if (!label) return;
  const transform = `translate(${label.offsetLeft}px, ${
    label.offsetTop + label.offsetHeight - filterIndicator.offsetHeight
  }px)`;
  const width = `${label.offsetWidth}px`;
  if (animate) {
    filterIndicator.style.transform = transform;
    filterIndicator.style.width = width;
  } else {
    filterIndicator.style.transition = "none";
    filterIndicator.style.transform = transform;
    filterIndicator.style.width = width;
    void filterIndicator.offsetWidth;
    filterIndicator.style.transition = "";
  }
  filterControls.dataset.indicatorReady = "";
}

function selectFilter(
  filter: HTMLInputElement,
  { animate = true, resetScroll = false } = {},
) {
  if (filter === requestedFilter) return;
  requestedFilter = filter;
  categoryTransition?.skipTransition();
  const scrollToGallery = resetScroll && gallery.getBoundingClientRect().top < 0;
  const update = (animateIndicator = animate) => {
    // A skipped transition can still run its callback. Always use the latest choice.
    requestedFilter.checked = true;
    renderedFilter = requestedFilter;
    // Reset beneath the snapshot, so the outgoing artwork never jumps to its top.
    if (scrollToGallery) gallery.scrollIntoView({ behavior: "instant" });
    positionFilterIndicator(animateIndicator);
  };
  if (!animate || reducedMotion.matches || !document.startViewTransition) {
    update();
    return;
  }
  const root = document.documentElement;
  if (scrollToGallery) root.setAttribute("data-gallery-scroll", "");
  const transition = document.startViewTransition(() => update(false));
  categoryTransition = transition;
  void transition.ready.catch(() => {
    // Skipped or unavailable snapshots still apply the category update.
  });
  void transition.finished
    .finally(() => {
      if (categoryTransition !== transition) return;
      root.removeAttribute("data-gallery-scroll");
      categoryTransition = undefined;
    })
    .catch(() => {});
}

function syncFromHash(animate = true) {
  const hash = window.location.hash.slice(1);
  // Keep existing /gallery#tattoo, #paintings, and #drawings links working.
  const filter = filters.find((input) => input.value === (hash || "selected"));
  if (filter) selectFilter(filter, { animate });
}

for (const filter of filters) {
  filter.addEventListener("change", () => {
    // Radios update before change fires; restore the old view for its snapshot.
    renderedFilter.checked = true;
    closeLightbox(true);
    window.history.pushState(null, "", "#" + filter.value);
    selectFilter(filter, { resetScroll: true });
  });
}

// Timing comes from the motion tokens in global.css, mirrored from transitions.dev.
function motionDuration(token: string, fallback: number) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    token,
  );
  return Number.parseFloat(value) || fallback;
}

function motionEasing() {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--ease-smooth-out")
      .trim() || "cubic-bezier(.22, 1, .36, 1)"
  );
}

function motionScale() {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--scale-large")
      .trim() || "0.96"
  );
}

function stopLightboxMotion() {
  for (const animation of lightboxAnimations) animation.cancel();
  lightboxAnimations = [];
}

function currentFit() {
  return fitEls[activeIndex] ?? null;
}

function currentZoom() {
  return zoomEls[activeIndex] ?? null;
}

function thumbImage(index: number) {
  return activeButtons[index]?.querySelector<HTMLImageElement>("img") ?? null;
}

// Where the slide sits so it looks like the thumbnail it grows from.
function thumbnailTransform(index: number) {
  const thumb = thumbImage(index);
  const fit = currentFit();
  if (!thumb || !fit) return null;
  const from = thumb.getBoundingClientRect();
  const to = fit.getBoundingClientRect();
  if (!from.width || !to.width) return null;
  const x = from.left + from.width / 2 - (to.left + to.width / 2);
  const y = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${x}px, ${y}px) scale(${from.width / to.width})`;
}

// A slight tilt toward the viewer, the way iPadOS lifts a photo off the grid.
function openingTransform(index: number) {
  const target = thumbnailTransform(index);
  const thumb = thumbImage(index);
  if (!target || !thumb) return target ?? `scale(${motionScale()})`;
  const rect = thumb.getBoundingClientRect();
  const offset =
    (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
  const tilt = Math.max(-5, Math.min(5, -offset * 8));
  return `perspective(1200px) ${target} rotateX(${tilt.toFixed(2)}deg)`;
}

const chromeElements = [
  lightboxClose,
  lightboxPrevious,
  lightboxNext,
  lightboxCount,
  lightboxCaption,
  lightboxRail,
];

// Read the current frame so closing during the entrance does not jump.
function animateLightbox(opening: boolean) {
  const interrupted = lightboxAnimations.some(
    (animation) => animation.playState === "running",
  );
  const fit = currentFit();
  const transform = fit ? getComputedStyle(fit).transform : "none";
  const backdrop = getComputedStyle(lightboxBackdrop).opacity;
  const chrome = chromeElements.map((element) => ({
    element,
    opacity: Number.parseFloat(getComputedStyle(element).opacity) || 0,
    hidden: getComputedStyle(element).display === "none",
    resting: element instanceof HTMLButtonElement && element.disabled ? 0.25 : 1,
  }));
  stopLightboxMotion();
  const duration = opening
    ? motionDuration("--duration-fast", 250)
    : motionDuration("--duration-quick", 150);
  const easing = motionEasing();
  const animations: Animation[] = [
    lightboxBackdrop.animate(
      [
        { opacity: interrupted ? backdrop : opening ? 0 : 1 },
        { opacity: opening ? 1 : 0 },
      ],
      { duration, easing },
    ),
  ];
  if (fit) {
    const target = thumbnailTransform(activeIndex);
    const scale = fit.animate(
      [
        {
          transform: opening
            ? interrupted
              ? transform
              : openingTransform(activeIndex)
            : transform,
        },
        { transform: opening ? "none" : target ?? `scale(${motionScale()})` },
      ],
      { duration, easing },
    );
    animations.push(scale);
    // The image travels outside the carousel clip, so hide its neighbours.
    const token = ++flipToken;
    lightbox.dataset.flipping = "";
    const clear = () => {
      if (token !== flipToken) return;
      lightbox.removeAttribute("data-flipping");
    };
    scale.addEventListener("finish", clear, { once: true });
    window.setTimeout(clear, duration + 80);
  }
  // Chrome waits for the image to leave, and gets out of the way first on close.
  for (const entry of chrome) {
    if (entry.hidden) continue;
    animations.push(
      entry.element.animate(
        opening
          ? [
              { opacity: interrupted ? entry.opacity : 0 },
              { opacity: entry.resting },
            ]
          : [{ opacity: entry.opacity }, { opacity: 0 }],
        opening
          ? {
              duration: 150,
              delay: interrupted ? 0 : 70,
              easing,
              fill: "backwards",
            }
          : { duration: 100, easing, fill: "forwards" },
      ),
    );
  }
  lightboxAnimations = animations;
  return animations[0];
}

function cleanupLightbox() {
  stopLightboxMotion();
  closingLightbox = false;
  window.clearTimeout(chromeTimer);
  chromeTimer = undefined;
  window.clearTimeout(zoomTransitionTimer);
  zoomTransitionTimer = undefined;
  window.clearTimeout(wheelResetTimer);
  wheelResetTimer = undefined;
  wheelAccumulator = 0;
  activePointers.clear();
  gesture = null;
  pinch = null;
  lightbox.removeAttribute("data-chrome-hidden");
  lightbox.removeAttribute("data-dragging");
  lightbox.removeAttribute("data-zoomed");
  lightbox.removeAttribute("data-flipping");
  lightbox.style.opacity = "";
  resetZoom(false);
  lightboxTrack.style.transition = "none";
  lightboxTrack.style.transform = "";
  lightboxTrack.replaceChildren();
  slideEls = [];
  fitEls = [];
  zoomEls = [];
  imgEls = [];
  slideDesired = [];
  slideWidth = 0;
  unlockScroll?.();
  unlockScroll = undefined;
}

function closeLightbox(immediate = false) {
  if (!lightbox.open) return;
  if (immediate || reducedMotion.matches) {
    resetZoom(false);
    lightbox.close();
    cleanupLightbox();
    return;
  }
  if (closingLightbox) return;
  closingLightbox = true;
  if (zoomLevel > 1) resetZoom(true);
  const fade = animateLightbox(false);
  const settle = () => {
    if (!closingLightbox || !lightbox.open) return;
    lightbox.close();
    cleanupLightbox();
  };
  fade.addEventListener("finish", settle, { once: true });
  // Fall back to a timer, the same way the transitions.dev modal recipe does.
  window.setTimeout(settle, motionDuration("--duration-quick", 150) + 100);
}

// Slides hold a thumbnail at first, so a swipe never waits on the network.
function prepareSlide(index: number) {
  const img = imgEls[index];
  const button = activeButtons[index];
  if (!img || !button) return;
  const width = button.dataset.fullWidth;
  const height = button.dataset.fullHeight;
  if (width) img.width = Number(width);
  if (height) img.height = Number(height);
  img.alt = button.querySelector("img")?.alt ?? "";
}

function assignSlideSource(index: number, full: boolean) {
  const img = imgEls[index];
  const button = activeButtons[index];
  if (!img || !button) return;
  const thumb = button.querySelector<HTMLImageElement>("img");
  const src = full
    ? button.dataset.fullSrc
    : thumb?.currentSrc || thumb?.src;
  if (!src) return;
  slideDesired[index] = src;
  if (img.getAttribute("src") === src) return;
  // Swap to the full image only once it is decoded, so the thumbnail stays
  // visible and the box keeps its size while the larger file loads.
  if (!full || !img.getAttribute("src")) {
    img.src = src;
    return;
  }
  const preload = new Image();
  preload.src = src;
  void preload
    .decode()
    .catch(() => {})
    .finally(() => {
      if (!lightbox.open || slideDesired[index] !== src) return;
      const current = imgEls[index];
      if (!current || current.getAttribute("src") === src) return;
      current.src = src;
    });
}

function syncSlideSources(center: number) {
  for (let index = 0; index < imgEls.length; index += 1) {
    const img = imgEls[index];
    if (!img) continue;
    const distance = Math.abs(index - center);
    if (distance <= 1) assignSlideSource(index, true);
    else if (distance > 2 || !img.getAttribute("src"))
      assignSlideSource(index, false);
  }
}

function buildCarousel() {
  lightboxTrack.replaceChildren();
  slideEls = [];
  fitEls = [];
  zoomEls = [];
  imgEls = [];
  slideDesired = [];
  activeButtons.forEach((_, index) => {
    const slide = document.createElement("div");
    slide.className = "lightbox-slide";
    const fit = document.createElement("div");
    fit.className = "lightbox-fit";
    const zoom = document.createElement("div");
    zoom.className = "lightbox-zoom";
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    zoom.append(img);
    fit.append(zoom);
    slide.append(fit);
    lightboxTrack.append(slide);
    slideEls[index] = slide;
    fitEls[index] = fit;
    zoomEls[index] = zoom;
    imgEls[index] = img;
    prepareSlide(index);
    assignSlideSource(index, false);
  });
}

function setActiveSlide(index: number) {
  slideEls.forEach((slide, position) => {
    slide.classList.toggle("is-active", position === index);
  });
}

function updateRail(index: number) {
  const items = lightboxRail.children;
  for (let position = 0; position < items.length; position += 1) {
    const item = items[position] as HTMLElement | undefined;
    if (!item) continue;
    if (position === index) item.setAttribute("aria-current", "true");
    else item.removeAttribute("aria-current");
  }
  const current = items[index] as HTMLElement | undefined;
  if (!current || lightboxRail.hidden) return;
  lightboxRail.scrollTo({
    left:
      current.offsetLeft -
      lightboxRail.clientWidth / 2 +
      current.offsetWidth / 2,
    behavior: reducedMotion.matches ? "auto" : "smooth",
  });
}

function setActiveState(index: number) {
  activeIndex = index;
  const button = activeButtons[index];
  if (!button) return;
  const title = button.dataset.title ?? "Artwork";
  lightboxCaption.replaceChildren();
  for (const text of [
    title,
    button.dataset.medium,
    button.dataset.dimensions,
  ]) {
    if (!text) continue;
    const line = document.createElement("span");
    line.textContent = text;
    lightboxCaption.append(line);
  }
  lightboxCount.textContent =
    activeButtons.length > 1
      ? `${index + 1} / ${activeButtons.length}`
      : "";
  lightbox.setAttribute("aria-label", "Full image of " + title);
  updateRail(index);
  syncSlideSources(index);
  lightboxPrevious.disabled = index <= 0;
  lightboxNext.disabled = index >= activeButtons.length - 1;
  setActiveSlide(index);
}

function trackDuration(distance: number) {
  return Math.min(520, Math.max(240, 240 + distance * 30));
}

function setTrackTransform(
  x: number,
  y: number,
  animate: boolean,
  duration = 0,
) {
  const translate = `translate3d(${x}px, ${y}px, 0)`;
  if (!animate || reducedMotion.matches) {
    lightboxTrack.style.transition = "none";
    lightboxTrack.style.transform = translate;
    return;
  }
  lightboxTrack.style.transition = `transform ${duration}ms ${motionEasing()}`;
  lightboxTrack.style.transform = translate;
}

function liveTrackTransform() {
  const computed = getComputedStyle(lightboxTrack).transform;
  if (!computed || computed === "none") return { x: 0, y: 0 };
  const matrix = new DOMMatrixReadOnly(computed);
  return { x: matrix.m41, y: matrix.m42 };
}

function goToSlide(index: number, animate = true) {
  const count = activeButtons.length;
  if (!count || !slideWidth) return;
  const target = Math.min(count - 1, Math.max(0, index));
  const from = liveTrackTransform().x;
  const distance = Math.abs(-target * slideWidth - from) / slideWidth;
  resetZoom(false);
  setActiveState(target);
  setTrackTransform(-target * slideWidth, 0, animate, trackDuration(distance));
  noteActivity();
}

function moveBy(direction: -1 | 1) {
  if (!lightbox.open) return;
  goToSlide(activeIndex + direction);
}

function buildRail() {
  lightboxRail.replaceChildren();
  lightboxRail.hidden = activeButtons.length < 2;
  activeButtons.forEach((button, index) => {
    const source = button.querySelector<HTMLImageElement>("img");
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute(
      "aria-label",
      "Show " + (button.dataset.title ?? "artwork"),
    );
    const thumb = document.createElement("img");
    thumb.alt = "";
    thumb.decoding = "async";
    if (source) thumb.src = source.currentSrc || source.src;
    item.append(thumb);
    item.addEventListener("click", () => {
      if (index === activeIndex) return;
      goToSlide(index);
    });
    lightboxRail.append(item);
  });
}

function applyZoom(animate: boolean) {
  const zoom = currentZoom();
  if (!zoom) return;
  const transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  if (animate && !reducedMotion.matches) {
    window.clearTimeout(zoomTransitionTimer);
    zoom.style.transition = `transform ${motionDuration(
      "--duration-quick",
      150,
    )}ms ${motionEasing()}`;
    zoom.style.transform = transform;
    zoomTransitionTimer = window.setTimeout(() => {
      zoom.style.transition = "";
    }, 200);
  } else {
    zoom.style.transition = "none";
    zoom.style.transform = transform;
    void zoom.offsetWidth;
    zoom.style.transition = "";
  }
  if (zoomLevel > 1) lightbox.dataset.zoomed = "";
  else lightbox.removeAttribute("data-zoomed");
}

function resetZoom(animate: boolean) {
  const zoom = currentZoom();
  if (zoomLevel === 1 && panX === 0 && panY === 0) {
    if (zoom) {
      zoom.style.transition = "";
      zoom.style.transform = "";
    }
    lightbox.removeAttribute("data-zoomed");
    return;
  }
  zoomLevel = 1;
  panX = 0;
  panY = 0;
  applyZoom(animate);
}

function clampPan() {
  const fit = currentFit();
  if (!fit) return;
  const maxX = (fit.clientWidth * (zoomLevel - 1)) / 2;
  const maxY = (fit.clientHeight * (zoomLevel - 1)) / 2;
  panX = Math.max(-maxX, Math.min(maxX, panX));
  panY = Math.max(-maxY, Math.min(maxY, panY));
}

function zoomTo(level: number, x: number, y: number, animate: boolean) {
  const next = Math.max(1, Math.min(4, level));
  panX = x - (x - panX) * (next / zoomLevel);
  panY = y - (y - panY) * (next / zoomLevel);
  zoomLevel = next;
  clampPan();
  if (zoomLevel === 1) {
    panX = 0;
    panY = 0;
  }
  applyZoom(animate);
  noteActivity();
}

function startPinch() {
  const points = Array.from(activePointers.values());
  if (points.length < 2) return;
  const [first, second] = points;
  const rect = lightboxViewport.getBoundingClientRect();
  pinch = {
    startDistance:
      Math.hypot(first.x - second.x, first.y - second.y) || 1,
    startZoom: zoomLevel,
    startPanX: panX,
    startPanY: panY,
    startMidX: (first.x + second.x) / 2 - (rect.left + rect.width / 2),
    startMidY: (first.y + second.y) / 2 - (rect.top + rect.height / 2),
  };
  suppressClick = true;
}

function updatePinch() {
  if (!pinch) return;
  const points = Array.from(activePointers.values());
  if (points.length < 2) return;
  const zoom = currentZoom();
  if (!zoom) return;
  const [first, second] = points;
  const rect = lightboxViewport.getBoundingClientRect();
  const distance = Math.hypot(first.x - second.x, first.y - second.y) || 1;
  const midX = (first.x + second.x) / 2 - (rect.left + rect.width / 2);
  const midY = (first.y + second.y) / 2 - (rect.top + rect.height / 2);
  const level = Math.max(
    1,
    Math.min(4, pinch.startZoom * (distance / pinch.startDistance)),
  );
  // Keep the point between the fingers under the fingers as they move.
  const contentX = (pinch.startMidX - pinch.startPanX) / pinch.startZoom;
  const contentY = (pinch.startMidY - pinch.startPanY) / pinch.startZoom;
  zoomLevel = level;
  panX = midX - contentX * level;
  panY = midY - contentY * level;
  clampPan();
  if (level === 1) {
    panX = 0;
    panY = 0;
  }
  if (zoomLevel > 1) lightbox.dataset.zoomed = "";
  else lightbox.removeAttribute("data-zoomed");
  zoom.style.transition = "none";
  zoom.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
}

function chromeHasFocus() {
  const active = document.activeElement;
  if (!active || active === lightbox) return false;
  return Boolean(
    lightbox
      .querySelector(".lightbox-close, .lightbox-arrow, .lightbox-rail")
      ?.contains(active),
  );
}

function noteActivity() {
  if (reducedMotion.matches || !lightbox.open) return;
  window.clearTimeout(chromeTimer);
  lightbox.removeAttribute("data-chrome-hidden");
  chromeTimer = window.setTimeout(() => {
    if (
      !lightbox.open ||
      zoomLevel > 1 ||
      gesture ||
      pinch ||
      chromeHasFocus()
    )
      return;
    lightbox.setAttribute("data-chrome-hidden", "");
  }, 2500);
}

for (const button of imageButtons) {
  button.addEventListener("click", () => {
    activeButtons = imageButtons.filter(
      (candidate) => candidate.getClientRects().length > 0,
    );
    const index = activeButtons.indexOf(button);
    activeIndex = index < 0 ? 0 : index;
    buildRail();
    buildCarousel();
    syncSlideSources(activeIndex);
    setActiveState(activeIndex);
    resetZoom(false);
    closingLightbox = false;
    unlockScroll = lockDocumentScroll();
    lightbox.showModal();
    lightbox.focus({ preventScroll: true });
    slideWidth = lightboxTrack.clientWidth;
    setTrackTransform(-activeIndex * slideWidth, 0, false);
    if (!reducedMotion.matches) animateLightbox(true);
    noteActivity();
  });
}

lightboxClose.addEventListener("click", () => closeLightbox());
lightboxPrevious.addEventListener("click", () => moveBy(-1));
lightboxNext.addEventListener("click", () => moveBy(1));

lightboxStage.addEventListener("click", (event) => {
  if (!lightbox.open) return;
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  const target = event.target;
  if (target instanceof Element && target.closest(".lightbox-fit")) return;
  closeLightbox();
});
lightbox.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeLightbox();
});
lightbox.addEventListener("close", () => {
  // The native close event is queued and may arrive after another image opens.
  if (!lightbox.open) cleanupLightbox();
});
lightbox.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    moveBy(event.key === "ArrowLeft" ? -1 : 1);
  }
});

lightboxStage.addEventListener("dblclick", (event) => {
  if (!lightbox.open) return;
  const rect = lightboxViewport.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  if (zoomLevel === 1) zoomTo(2.4, x, y, true);
  else zoomTo(1, 0, 0, true);
});

lightbox.addEventListener(
  "wheel",
  (event) => {
    if (!lightbox.open) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const rect = lightboxViewport.getBoundingClientRect();
      zoomTo(
        zoomLevel * Math.exp(-event.deltaY * 0.012),
        event.clientX - (rect.left + rect.width / 2),
        event.clientY - (rect.top + rect.height / 2),
        true,
      );
      return;
    }
    // A horizontal two-finger trackpad swipe moves through the set.
    if (zoomLevel > 1) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".lightbox-rail")) return;
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    window.clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(() => {
      wheelAccumulator = 0;
    }, 140);
    wheelAccumulator += event.deltaX;
    if (Math.abs(wheelAccumulator) < 70) return;
    if (performance.now() - lastWheelNavigation < 260) return;
    const direction = wheelAccumulator > 0 ? 1 : -1;
    wheelAccumulator = 0;
    lastWheelNavigation = performance.now();
    moveBy(direction);
  },
  { passive: false },
);

lightboxStage.addEventListener("pointerdown", (event) => {
  if (!lightbox.open || event.button !== 0) return;
  suppressClick = false;
  noteActivity();
  activePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
  });
  if (activePointers.size === 2) {
    gesture = null;
    lightbox.removeAttribute("data-dragging");
    lightbox.style.opacity = "";
    startPinch();
    return;
  }
  if (activePointers.size > 2 || gesture) return;
  // Freeze the track where it is, even mid-transition, so the drag is 1:1.
  const live = liveTrackTransform();
  lightboxTrack.style.transition = "none";
  lightboxTrack.style.transform = `translate3d(${live.x}px, ${live.y}px, 0)`;
  gesture = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    time: performance.now(),
    axis: null,
    moved: false,
    touch: event.pointerType !== "mouse",
    trackStartX: live.x,
  };
});

lightboxStage.addEventListener("pointermove", (event) => {
  if (activePointers.has(event.pointerId)) {
    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }
  if (pinch) {
    updatePinch();
    event.preventDefault();
    return;
  }
  if (!gesture || event.pointerId !== gesture.id) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  const moveX = event.clientX - gesture.lastX;
  const moveY = event.clientY - gesture.lastY;
  gesture.lastX = event.clientX;
  gesture.lastY = event.clientY;
  if (!gesture.moved && Math.hypot(dx, dy) > 8) {
    gesture.moved = true;
    suppressClick = true;
  }
  if (!gesture.moved) return;
  if (zoomLevel > 1) {
    panX += moveX;
    panY += moveY;
    clampPan();
    lightbox.dataset.dragging = "";
    const zoom = currentZoom();
    if (zoom) {
      zoom.style.transition = "none";
      zoom.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    }
    return;
  }
  if (!gesture.axis) gesture.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  if (gesture.axis === "x") {
    if (!slideWidth) return;
    const last = Math.max(0, activeButtons.length - 1) * slideWidth;
    let x = gesture.trackStartX + dx;
    if (x > 0) x *= 0.35;
    else if (x < -last) x = -last + (x + last) * 0.35;
    setTrackTransform(x, 0, false);
  } else {
    if (!gesture.touch) return;
    const damped = dy > 0 ? dy : dy * 0.25;
    setTrackTransform(gesture.trackStartX, damped, false);
    lightbox.style.opacity = String(Math.max(0.3, 1 - Math.abs(dy) / 420));
  }
  event.preventDefault();
});

lightboxStage.addEventListener("pointerup", (event) => {
  activePointers.delete(event.pointerId);
  if (pinch) {
    if (activePointers.size < 2) {
      pinch = null;
      gesture = null;
    }
    return;
  }
  if (!gesture || event.pointerId !== gesture.id) return;
  const active = gesture;
  gesture = null;
  lightbox.removeAttribute("data-dragging");
  const dx = event.clientX - active.x;
  const dy = event.clientY - active.y;
  const elapsed = Math.max(1, performance.now() - active.time);
  const velocityX = dx / elapsed;
  const velocityY = dy / elapsed;
  if (zoomLevel > 1) {
    const before = `${panX},${panY}`;
    clampPan();
    if (before !== `${panX},${panY}`) applyZoom(true);
    return;
  }
  const live = liveTrackTransform();
  if (!active.moved || !active.axis) {
    lightbox.style.opacity = "";
    return;
  }
  if (active.axis === "x") {
    // Project the flick forward so a fast swipe can land two slides away.
    const projected = live.x + velocityX * 220;
    const target = Math.round(-projected / Math.max(1, slideWidth));
    lightbox.style.opacity = "";
    goToSlide(target);
    return;
  }
  if (!active.touch) return;
  if (dy > 90 || (velocityY > 0.11 && dy > 20)) {
    lightbox.style.opacity = "";
    closeLightbox();
    return;
  }
  lightbox.style.opacity = "";
  setTrackTransform(live.x, 0, true, 240);
});

lightboxStage.addEventListener("pointercancel", (event) => {
  activePointers.delete(event.pointerId);
  if (pinch && activePointers.size < 2) pinch = null;
  gesture = null;
  lightbox.removeAttribute("data-dragging");
  lightbox.style.opacity = "";
});

lightbox.addEventListener("pointermove", noteActivity);
lightbox.addEventListener("pointerdown", noteActivity);
lightbox.addEventListener("keydown", noteActivity);
lightbox.addEventListener("focusin", noteActivity);

window.addEventListener("hashchange", () => syncFromHash());
window.addEventListener("popstate", () => syncFromHash());
window.addEventListener("pageshow", () => syncFromHash(false));
window.addEventListener("resize", () => {
  positionFilterIndicator(false);
  if (!lightbox.open || !imgEls.length) return;
  slideWidth = lightboxTrack.clientWidth;
  setTrackTransform(-activeIndex * slideWidth, 0, false);
});
void document.fonts.ready.then(() => positionFilterIndicator(false));
window.addEventListener("pagehide", () => {
  categoryTransition?.skipTransition();
  closeLightbox(true);
  unlockScroll?.();
  unlockScroll = undefined;
});
reducedMotion.addEventListener("change", () => {
  if (!reducedMotion.matches) return;
  categoryTransition?.skipTransition();
  if (closingLightbox) closeLightbox(true);
  else stopLightboxMotion();
  lightbox.removeAttribute("data-chrome-hidden");
  resetZoom(false);
});
syncFromHash(false);
positionFilterIndicator(false);
