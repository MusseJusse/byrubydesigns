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
const lightboxImage = requireElement<HTMLImageElement>("[data-lightbox-image]");
const lightboxCaption = requireElement<HTMLElement>("[data-lightbox-caption]");
const lightboxCount = requireElement<HTMLElement>("[data-lightbox-count]");
const lightboxFigure = requireElement<HTMLElement>("[data-lightbox] figure");
const lightboxStage = requireElement<HTMLElement>("[data-lightbox-stage]");
const lightboxFit = requireElement<HTMLElement>("[data-lightbox-fit]");
const lightboxZoom = requireElement<HTMLElement>("[data-lightbox-zoom]");
const lightboxRail = requireElement<HTMLElement>("[data-lightbox-rail]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const preloadedSources = new Set<string>();

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
  captured: boolean;
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
let imageRequest = 0;
let loadingIndicatorTimer: number | undefined;
let chromeTimer: number | undefined;
let zoomTransitionTimer: number | undefined;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let gesture: LightboxGesture | null = null;
let suppressClick = false;

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

function thumbImage(index: number) {
  return (
    activeButtons[index]?.querySelector<HTMLImageElement>("img") ?? null
  );
}

// Where the figure sits so it looks like the thumbnail it grows from.
function thumbnailTransform(index: number) {
  const thumb = thumbImage(index);
  if (!thumb) return null;
  const from = thumb.getBoundingClientRect();
  const to = lightboxFit.getBoundingClientRect();
  if (!from.width || !to.width) return null;
  const x = from.left + from.width / 2 - (to.left + to.width / 2);
  const y = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${x}px, ${y}px) scale(${from.width / to.width})`;
}

// Read the current frame so closing during the entrance does not jump.
function animateLightbox(opening: boolean) {
  const interrupted = lightboxAnimations.some(
    (animation) => animation.playState === "running",
  );
  const opacity = getComputedStyle(lightbox).opacity;
  const transform = getComputedStyle(lightboxFit).transform;
  stopLightboxMotion();
  const options = {
    duration: opening
      ? motionDuration("--duration-fast", 250)
      : motionDuration("--duration-quick", 150),
    easing: motionEasing(),
  };
  const fade = lightbox.animate(
    [
      { opacity: interrupted ? opacity : opening ? 0 : 1 },
      { opacity: opening ? 1 : 0 },
    ],
    options,
  );
  const target = thumbnailTransform(activeIndex);
  const fallback = `scale(${motionScale()})`;
  const scale = lightboxFit.animate(
    [
      { transform: opening ? (interrupted ? transform : target ?? fallback) : transform },
      { transform: opening ? "none" : target ?? fallback },
    ],
    options,
  );
  lightboxAnimations = [fade, scale];
  return fade;
}

function clearDragStyles() {
  lightboxFit.style.transform = "";
  lightbox.style.opacity = "";
}

function snapBack(from: string) {
  stopLightboxMotion();
  clearDragStyles();
  const animation = lightboxFit.animate(
    [{ transform: from }, { transform: "none" }],
    {
      duration: motionDuration("--duration-fast", 250),
      easing: motionEasing(),
    },
  );
  lightboxAnimations = [animation];
}

function glideTo(direction: -1 | 1, fromX: number) {
  stopLightboxMotion();
  const glide = lightboxFit.animate(
    [
      { transform: `translateX(${fromX}px)`, opacity: 1 },
      {
        transform: `translateX(${-direction * lightbox.clientWidth * 0.4}px)`,
        opacity: 0,
      },
    ],
    {
      duration: motionDuration("--duration-quick", 150),
      easing: motionEasing(),
    },
  );
  lightboxAnimations = [glide];
  glide.onfinish = () => moveTo(activeIndex + direction, direction);
}

function cleanupLightbox() {
  stopLightboxMotion();
  closingLightbox = false;
  imageRequest += 1;
  window.clearTimeout(loadingIndicatorTimer);
  loadingIndicatorTimer = undefined;
  window.clearTimeout(chromeTimer);
  chromeTimer = undefined;
  window.clearTimeout(zoomTransitionTimer);
  zoomTransitionTimer = undefined;
  lightbox.removeAttribute("data-chrome-hidden");
  lightbox.removeAttribute("data-dragging");
  lightbox.removeAttribute("data-zoomed");
  lightbox.style.opacity = "";
  resetZoom(false);
  lightboxFigure.removeAttribute("aria-busy");
  lightboxFigure.removeAttribute("data-image-state");
  unlockScroll?.();
  unlockScroll = undefined;
  lightboxImage.removeAttribute("src");
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
  animateLightbox(false).onfinish = () => {
    lightbox.close();
    cleanupLightbox();
  };
}

function showImage() {
  const button = activeButtons[activeIndex];
  if (!button) return;
  const title = button.dataset.title ?? "Artwork";
  const request = ++imageRequest;
  window.clearTimeout(loadingIndicatorTimer);
  lightboxFigure.setAttribute("aria-busy", "true");
  lightboxFigure.dataset.imageState = "pending";
  lightboxImage.width = Number(button.dataset.fullWidth);
  lightboxImage.height = Number(button.dataset.fullHeight);
  lightboxImage.alt = button.querySelector("img")?.alt ?? title;
  lightboxImage.src = button.dataset.fullSrc ?? "";
  loadingIndicatorTimer = window.setTimeout(() => {
    if (request !== imageRequest) return;
    lightboxFigure.dataset.imageState = "loading";
    loadingIndicatorTimer = undefined;
  }, 150);
  void lightboxImage.decode().catch(() => {}).finally(() => {
    if (request !== imageRequest) return;
    window.clearTimeout(loadingIndicatorTimer);
    loadingIndicatorTimer = undefined;
    lightboxFigure.removeAttribute("aria-busy");
    lightboxFigure.removeAttribute("data-image-state");
  });
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
      ? `${activeIndex + 1} / ${activeButtons.length}`
      : "";
  updateRail();
  preloadNeighbours();
  lightbox.setAttribute("aria-label", "Full image of " + title);
}

function moveTo(index: number, direction: -1 | 1) {
  if (!activeButtons.length) return;
  if (closingLightbox) {
    closingLightbox = false;
    animateLightbox(true);
  }
  activeIndex =
    ((index % activeButtons.length) + activeButtons.length) %
    activeButtons.length;
  resetZoom(false);
  showImage();
  if (!reducedMotion.matches) {
    stopLightboxMotion();
    const slide = lightboxFit.animate(
      [
        { transform: `translateX(${direction * 24}px)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      {
        duration: motionDuration("--duration-quick", 150),
        easing: motionEasing(),
      },
    );
    lightboxAnimations = [slide];
  }
  noteActivity();
}

function moveImage(direction: -1 | 1) {
  moveTo(activeIndex + direction, direction);
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
      moveTo(index, index > activeIndex ? 1 : -1);
    });
    lightboxRail.append(item);
  });
}

function updateRail() {
  const items = lightboxRail.children;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as HTMLElement | undefined;
    if (!item) continue;
    if (index === activeIndex) item.setAttribute("aria-current", "true");
    else item.removeAttribute("aria-current");
  }
  const current = items[activeIndex] as HTMLElement | undefined;
  if (!current || lightboxRail.hidden) return;
  lightboxRail.scrollTo({
    left:
      current.offsetLeft -
      lightboxRail.clientWidth / 2 +
      current.offsetWidth / 2,
    behavior: reducedMotion.matches ? "auto" : "smooth",
  });
}

function preloadNeighbours() {
  if (activeButtons.length < 2) return;
  for (const offset of [1, -1]) {
    const button =
      activeButtons[
        (activeIndex + offset + activeButtons.length) % activeButtons.length
      ];
    const src = button?.dataset.fullSrc;
    if (!src || preloadedSources.has(src)) continue;
    preloadedSources.add(src);
    const image = new Image();
    image.src = src;
  }
}

function applyZoom(animate: boolean) {
  const transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  if (animate && !reducedMotion.matches) {
    window.clearTimeout(zoomTransitionTimer);
    lightboxZoom.style.transition = `transform ${motionDuration(
      "--duration-quick",
      150,
    )}ms ${motionEasing()}`;
    lightboxZoom.style.transform = transform;
    zoomTransitionTimer = window.setTimeout(() => {
      lightboxZoom.style.transition = "";
    }, 200);
  } else {
    lightboxZoom.style.transition = "none";
    lightboxZoom.style.transform = transform;
    void lightboxZoom.offsetWidth;
    lightboxZoom.style.transition = "";
  }
  if (zoomLevel > 1) lightbox.dataset.zoomed = "";
  else lightbox.removeAttribute("data-zoomed");
}

function resetZoom(animate: boolean) {
  if (zoomLevel === 1 && panX === 0 && panY === 0) {
    lightboxZoom.style.transition = "";
    lightboxZoom.style.transform = "";
    lightbox.removeAttribute("data-zoomed");
    return;
  }
  zoomLevel = 1;
  panX = 0;
  panY = 0;
  applyZoom(animate);
}

function clampPan() {
  const maxX = (lightboxFit.clientWidth * (zoomLevel - 1)) / 2;
  const maxY = (lightboxFit.clientHeight * (zoomLevel - 1)) / 2;
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
    if (!lightbox.open || zoomLevel > 1 || gesture || chromeHasFocus()) return;
    lightbox.setAttribute("data-chrome-hidden", "");
  }, 2500);
}

for (const button of imageButtons) {
  button.addEventListener("click", () => {
    activeButtons = imageButtons.filter(
      (candidate) => candidate.getClientRects().length > 0,
    );
    activeIndex = activeButtons.indexOf(button);
    buildRail();
    resetZoom(false);
    showImage();
    unlockScroll = lockDocumentScroll();
    lightbox.showModal();
    lightbox.focus({ preventScroll: true });
    if (!reducedMotion.matches) animateLightbox(true);
    noteActivity();
  });
}

requireElement<HTMLButtonElement>("[data-lightbox-close]").addEventListener(
  "click",
  () => closeLightbox(),
);
requireElement<HTMLButtonElement>("[data-lightbox-previous]").addEventListener(
  "click",
  () => moveImage(-1),
);
requireElement<HTMLButtonElement>("[data-lightbox-next]").addEventListener(
  "click",
  () => moveImage(1),
);

lightbox.addEventListener("click", (event) => {
  if (event.target !== lightbox) return;
  if (suppressClick) {
    suppressClick = false;
    return;
  }
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
    moveImage(event.key === "ArrowLeft" ? -1 : 1);
  }
});

lightboxStage.addEventListener("dblclick", (event) => {
  if (!lightbox.open) return;
  const rect = lightboxStage.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  if (zoomLevel === 1) zoomTo(2.4, x, y, true);
  else zoomTo(1, 0, 0, true);
});

lightbox.addEventListener(
  "wheel",
  (event) => {
    if (!lightbox.open || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const rect = lightboxStage.getBoundingClientRect();
    zoomTo(
      zoomLevel * Math.exp(-event.deltaY * 0.012),
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
      true,
    );
  },
  { passive: false },
);

lightboxStage.addEventListener("pointerdown", (event) => {
  if (!lightbox.open || event.button !== 0 || gesture) return;
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
    captured: false,
  };
  noteActivity();
});

lightboxStage.addEventListener("pointermove", (event) => {
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
  if (!gesture.captured) {
    gesture.captured = true;
    try {
      lightboxStage.setPointerCapture(event.pointerId);
    } catch {
      // The pointer can already be gone; dragging still works without capture.
    }
  }
  if (zoomLevel > 1) {
    panX += moveX;
    panY += moveY;
    clampPan();
    lightbox.dataset.dragging = "";
    lightboxZoom.style.transition = "none";
    lightboxZoom.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    return;
  }
  if (!gesture.touch) return;
  if (!gesture.axis) gesture.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  if (gesture.axis === "x") {
    lightboxFit.style.transform = `translateX(${dx}px)`;
    lightbox.style.opacity = String(
      Math.max(0.35, 1 - Math.abs(dx) / (lightbox.clientWidth * 0.9)),
    );
  } else {
    const damped = dy > 0 ? dy : dy * 0.25;
    lightboxFit.style.transform = `translateY(${damped}px)`;
    lightbox.style.opacity = String(Math.max(0.3, 1 - Math.abs(dy) / 420));
  }
  event.preventDefault();
});

lightboxStage.addEventListener("pointerup", (event) => {
  if (!gesture || event.pointerId !== gesture.id) return;
  const active = gesture;
  gesture = null;
  lightbox.removeAttribute("data-dragging");
  const dx = event.clientX - active.x;
  const dy = event.clientY - active.y;
  const elapsed = Math.max(1, performance.now() - active.time);
  const velocityX = dx / elapsed;
  const velocityY = dy / elapsed;
  window.setTimeout(() => {
    suppressClick = false;
  }, 0);
  if (zoomLevel > 1) {
    const before = `${panX},${panY}`;
    clampPan();
    if (before !== `${panX},${panY}`) applyZoom(true);
    return;
  }
  if (!active.touch || !active.moved || !active.axis) {
    clearDragStyles();
    return;
  }
  if (active.axis === "x") {
    if (Math.abs(dx) > 64 || Math.abs(velocityX) > 0.11) {
      clearDragStyles();
      glideTo(dx < 0 ? 1 : -1, dx);
    } else {
      snapBack(`translateX(${dx}px)`);
    }
    return;
  }
  if (dy > 90 || (velocityY > 0.11 && dy > 20)) {
    clearDragStyles();
    closeLightbox();
    return;
  }
  const damped = dy > 0 ? dy : dy * 0.25;
  snapBack(`translateY(${damped}px)`);
});

lightboxStage.addEventListener("pointercancel", () => {
  gesture = null;
  lightbox.removeAttribute("data-dragging");
  clearDragStyles();
});

lightbox.addEventListener("pointermove", noteActivity);
lightbox.addEventListener("pointerdown", noteActivity);
lightbox.addEventListener("keydown", noteActivity);
lightbox.addEventListener("focusin", noteActivity);

window.addEventListener("hashchange", () => syncFromHash());
window.addEventListener("popstate", () => syncFromHash());
window.addEventListener("pageshow", () => syncFromHash(false));
window.addEventListener("resize", () => positionFilterIndicator(false));
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
