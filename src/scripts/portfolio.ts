import { lockDocumentScroll, requireElement } from "./dom";

const filters = Array.from(
  document.querySelectorAll<HTMLInputElement>('[name="artwork-filter"]'),
);
const imageButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-lightbox-open]"),
);
const gallery = requireElement<HTMLElement>("#work");
const lightbox = requireElement<HTMLDialogElement>("[data-lightbox]");
const lightboxImage = requireElement<HTMLImageElement>("[data-lightbox-image]");
const lightboxCaption = requireElement<HTMLElement>("[data-lightbox-caption]");
const lightboxFigure = requireElement<HTMLElement>("[data-lightbox] figure");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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

function selectFilter(filter: HTMLInputElement, animate = true) {
  if (filter === requestedFilter) return;
  requestedFilter = filter;
  categoryTransition?.skipTransition();
  const update = () => {
    // A skipped transition can still run its callback. Always use the latest choice.
    requestedFilter.checked = true;
    renderedFilter = requestedFilter;
  };
  if (!animate || reducedMotion.matches || !document.startViewTransition) {
    update();
    return;
  }
  categoryTransition = document.startViewTransition(update);
  void categoryTransition.ready.catch(() => {
    // Skipped or unavailable snapshots still apply the category update.
  });
}

function syncFromHash(animate = true) {
  const hash = window.location.hash.slice(1);
  // Keep existing /gallery#tattoo, #paintings, and #drawings links working.
  const filter = filters.find((input) => input.value === (hash || "selected"));
  if (filter) selectFilter(filter, animate);
}

for (const filter of filters) {
  filter.addEventListener("change", () => {
    // Radios update before change fires; restore the old view for its snapshot.
    renderedFilter.checked = true;
    closeLightbox(true);
    window.history.pushState(null, "", "#" + filter.value);
    if (gallery.getBoundingClientRect().top < 0) gallery.scrollIntoView();
    selectFilter(filter);
  });
}

function stopLightboxMotion() {
  for (const animation of lightboxAnimations) animation.cancel();
  lightboxAnimations = [];
}

// Read the current frame so closing during the entrance does not jump.
function animateLightbox(opening: boolean) {
  const interrupted = lightboxAnimations.some(
    (animation) => animation.playState === "running",
  );
  const opacity = getComputedStyle(lightbox).opacity;
  const transform = getComputedStyle(lightboxFigure).transform;
  stopLightboxMotion();
  const options = { duration: 220, easing: "cubic-bezier(.22, 1, .36, 1)" };
  const fade = lightbox.animate(
    [
      { opacity: interrupted ? opacity : opening ? 0 : 1 },
      { opacity: opening ? 1 : 0 },
    ],
    options,
  );
  const lift = lightboxFigure.animate(
    [
      {
        transform: interrupted ? transform : opening ? "translateY(6px)" : "none",
      },
      { transform: opening ? "none" : "translateY(6px)" },
    ],
    options,
  );
  lightboxAnimations = [fade, lift];
  return fade;
}

function cleanupLightbox() {
  stopLightboxMotion();
  closingLightbox = false;
  unlockScroll?.();
  unlockScroll = undefined;
  lightboxImage.removeAttribute("src");
}

function closeLightbox(immediate = false) {
  if (!lightbox.open) return;
  if (immediate || reducedMotion.matches) {
    lightbox.close();
    cleanupLightbox();
    return;
  }
  if (closingLightbox) return;
  closingLightbox = true;
  animateLightbox(false).onfinish = () => {
    lightbox.close();
    cleanupLightbox();
  };
}

function showImage() {
  const button = activeButtons[activeIndex];
  if (!button) return;
  const title = button.dataset.title ?? "Artwork";
  lightboxImage.src = button.dataset.fullSrc ?? "";
  lightboxImage.alt = button.querySelector("img")?.alt ?? title;
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
  lightbox.setAttribute("aria-label", "Full image of " + title);
}

function moveImage(direction: -1 | 1) {
  if (!activeButtons.length) return;
  if (closingLightbox) {
    closingLightbox = false;
    animateLightbox(true);
  }
  activeIndex =
    (activeIndex + direction + activeButtons.length) % activeButtons.length;
  showImage();
}

for (const button of imageButtons) {
  button.addEventListener("click", () => {
    activeButtons = imageButtons.filter(
      (candidate) => candidate.getClientRects().length > 0,
    );
    activeIndex = activeButtons.indexOf(button);
    showImage();
    unlockScroll = lockDocumentScroll();
    lightbox.showModal();
    if (!reducedMotion.matches) animateLightbox(true);
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
  if (event.target === lightbox) closeLightbox();
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
window.addEventListener("hashchange", () => syncFromHash());
window.addEventListener("popstate", () => syncFromHash());
window.addEventListener("pageshow", () => syncFromHash(false));
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
});
syncFromHash(false);
