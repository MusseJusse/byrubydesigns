import type { GalleryCategoryId as CategoryId } from "../data/artwork";
import { lockDocumentScroll, prefersReducedMotion, requireElement, trapFocus } from "./dom";
import { createMobileMenu } from "./mobile-menu";

function isCategoryId(value: string | undefined): value is CategoryId {
  return categoryPanels.some((panel) => panel.dataset.categoryPanel === value);
}

function categoryFromHash(): CategoryId | undefined {
  const category = window.location.hash.slice(1);
  return isCategoryId(category) ? category : undefined;
}

const categoryTriggers = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-category-trigger]")
);
const categoryPanels = Array.from(
  document.querySelectorAll<HTMLElement>("[data-category-panel]")
);
const lightbox = requireElement<HTMLElement>("[data-lightbox]");
const lightboxImage = requireElement<HTMLImageElement>("[data-lightbox-image]");
const lightboxCaption = requireElement<HTMLElement>("[data-lightbox-caption]");
const lightboxClose = requireElement<HTMLButtonElement>("[data-lightbox-close]");
const lightboxPrevious = requireElement<HTMLButtonElement>("[data-lightbox-previous]");
const lightboxNext = requireElement<HTMLButtonElement>("[data-lightbox-next]");

let selectedCategory: CategoryId = "tattoo";
let activeIndex: number | null = null;
let requestedLightboxIndex: number | null = null;
let activeTrigger: HTMLButtonElement | null = null;
let lightboxUnlockScroll: (() => void) | null = null;
let finishLightboxClose: (() => void) | null = null;
let layoutFrame = 0;
const resizeObserver = new ResizeObserver(scheduleLayout);
let categoryTransitionId = 0;
let lightboxTransitionId = 0;

const mobileMenu = createMobileMenu({
  onOpened: () => closeLightbox({ restoreFocus: false, animate: false }),
  restoreFocus: (button) => {
    (activeIndex === null ? button : lightboxClose).focus();
  }
});

function activePanel() {
  const panel = categoryPanels.find(
    (candidate) => candidate.dataset.categoryPanel === selectedCategory
  );
  if (!panel) throw new Error("Category panel is missing: " + selectedCategory);
  return panel;
}

function activeImageButtons() {
  return Array.from(
    activePanel().querySelectorAll<HTMLButtonElement>("[data-lightbox-open]")
  );
}

function scheduleLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(layoutActiveGallery);
}

function layoutActiveGallery() {
  const panel = activePanel();
  const gallery = panel.querySelector<HTMLElement>("[data-gallery-grid]");
  if (!gallery) throw new Error("The active gallery grid is missing");

  const items = Array.from(gallery.querySelectorAll<HTMLElement>(".gallery-item"));
  const isMobile = window.innerWidth <= 640;
  const columnCount = window.innerWidth >= 900 ? 3 : 2;
  const horizontalGap = isMobile ? 2 : 11;
  const verticalGap = 28;
  const itemWidth = (gallery.clientWidth - horizontalGap * (columnCount - 1)) / columnCount;

  for (const item of items) {
    item.style.width = itemWidth + "px";
  }

  function layoutItems(group: HTMLElement[], startY: number) {
    const columnHeights = Array.from({ length: columnCount }, () => startY);

    group.forEach((item, index) => {
      const columnIndex = index % columnCount;
      const x = columnIndex * (itemWidth + horizontalGap);
      const y = columnHeights[columnIndex] ?? startY;

      item.style.transform = "translate3d(" + x + "px, " + y + "px, 0)";
      columnHeights[columnIndex] = y + item.offsetHeight + verticalGap;
    });

    return Math.max(...columnHeights) - verticalGap;
  }

  const yearDivider = gallery.querySelector<HTMLElement>("[data-year-divider]");
  const parsedBreakIndex = Number.parseInt(gallery.dataset.yearBreakIndex ?? "", 10);
  const yearBreakIndex = Number.isFinite(parsedBreakIndex) ? parsedBreakIndex : -1;
  let galleryBottom: number;

  if (yearDivider && yearBreakIndex > 0) {
    const firstYearBottom = layoutItems(items.slice(0, yearBreakIndex), 0);
    const dividerY = firstYearBottom + (isMobile ? 48 : 64);

    yearDivider.style.width = gallery.clientWidth + "px";
    yearDivider.style.transform = "translate3d(0, " + dividerY + "px, 0)";

    const secondYearStart = dividerY + yearDivider.offsetHeight + (isMobile ? 24 : 32);
    galleryBottom = layoutItems(items.slice(yearBreakIndex), secondYearStart);
  } else {
    galleryBottom = layoutItems(items, 0);
  }

  gallery.style.height = Math.max(0, galleryBottom) + "px";
  gallery.classList.add("is-ready");
}

function observeActiveGallery() {
  resizeObserver.disconnect();

  const gallery = activePanel().querySelector<HTMLElement>("[data-gallery-grid]");
  if (!gallery) throw new Error("The active gallery grid is missing");

  gallery.classList.remove("is-ready");
  resizeObserver.observe(gallery);

  for (const item of gallery.querySelectorAll<HTMLElement>(".gallery-item")) {
    resizeObserver.observe(item);
  }

  const divider = gallery.querySelector<HTMLElement>("[data-year-divider]");
  if (divider) resizeObserver.observe(divider);
  scheduleLayout();
}

function updateSelectedCategory(category: CategoryId) {
  closeLightbox({ restoreFocus: false, animate: false });
  selectedCategory = category;

  for (const trigger of categoryTriggers) {
    const active = trigger.dataset.categoryTrigger === category;
    trigger.classList.toggle("active", active);
    trigger.setAttribute("aria-pressed", String(active));
  }

  for (const panel of categoryPanels) {
    panel.hidden = panel.dataset.categoryPanel !== category;
  }

  observeActiveGallery();
  mobileMenu.close();
}

function selectCategory(category: CategoryId, animate = true) {
  if (category === selectedCategory) {
    mobileMenu.close();
    return;
  }

  if (!animate || prefersReducedMotion() || !document.startViewTransition) {
    updateSelectedCategory(category);
    return;
  }

  const transitionId = ++categoryTransitionId;
  const outgoingPanel = activePanel();
  let incomingPanel: HTMLElement | null = null;
  outgoingPanel.style.viewTransitionName = "gallery-category";
  document.documentElement.dataset.motion = "gallery-category";

  const transition = document.startViewTransition(() => {
    updateSelectedCategory(category);
    incomingPanel = activePanel();
    outgoingPanel.style.removeProperty("view-transition-name");
    incomingPanel.style.viewTransitionName = "gallery-category";
    cancelAnimationFrame(layoutFrame);
    layoutActiveGallery();
  });
  // Rapid navigation can skip the animation while still completing the DOM update.
  void transition.ready.catch(() => {});

  const clearTransitionState = () => {
    if (transitionId !== categoryTransitionId) return;
    outgoingPanel.style.removeProperty("view-transition-name");
    incomingPanel?.style.removeProperty("view-transition-name");
    delete document.documentElement.dataset.motion;
  };
  void transition.finished.then(clearTransitionState, clearTransitionState);
}

function selectCategoryFromHash() {
  const category = categoryFromHash();
  if (category) selectCategory(category);
  else if (!window.location.hash) {
    selectCategory("tattoo");
    window.history.replaceState(null, "", "#tattoo");
  }
}

function updateCategoryHash(category: CategoryId) {
  if (categoryFromHash() === category) return;
  window.history.pushState(null, "", "#" + category);
}

function showActiveImage() {
  const buttons = activeImageButtons();
  if (activeIndex === null || buttons.length === 0) return;

  const button = buttons[activeIndex];
  if (!button) return;
  const titleText = button.dataset.title ?? "Artwork";
  const title = document.createElement("cite");
  title.textContent = titleText;

  const captionLines: HTMLElement[] = [title];
  for (const detail of [button.dataset.medium, button.dataset.dimensions]) {
    if (!detail) continue;
    const line = document.createElement("span");
    line.textContent = detail;
    captionLines.push(line);
  }

  lightboxImage.src = button.dataset.fullSrc ?? "";
  lightboxImage.alt = button.querySelector("img")?.alt ?? "";
  lightboxCaption.replaceChildren(...captionLines);
  lightbox.setAttribute("aria-label", "Full image of " + titleText);
}

function clearLightboxPictureTransition() {
  lightboxImage.style.removeProperty("view-transition-name");
  if (document.documentElement.dataset.motion === "lightbox-picture") {
    delete document.documentElement.dataset.motion;
  }
}

async function preloadImage(source: string) {
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
    return true;
  } catch {
    return false;
  }
}

function openLightbox(button: HTMLButtonElement) {
  const index = activeImageButtons().indexOf(button);
  if (index < 0) return;

  mobileMenu.close(false);

  if (finishLightboxClose) {
    lightbox.removeEventListener("animationend", finishLightboxClose);
    finishLightboxClose = null;
    lightbox.classList.remove("is-closing");
  }

  activeIndex = index;
  requestedLightboxIndex = index;
  activeTrigger = button;
  showActiveImage();
  lightbox.inert = false;
  lightbox.hidden = false;
  lightboxUnlockScroll ??= lockDocumentScroll();
  requestAnimationFrame(() => lightboxClose.focus());
}

function closeLightbox({
  restoreFocus = true,
  animate = true,
}: { restoreFocus?: boolean; animate?: boolean } = {}) {
  if (activeIndex === null) return;
  lightboxTransitionId += 1;
  clearLightboxPictureTransition();
  const trigger = activeTrigger;
  activeIndex = null;
  requestedLightboxIndex = null;
  activeTrigger = null;
  lightbox.inert = true;

  const finishClosing = () => {
    if (finishLightboxClose !== finishClosing) return;
    lightbox.removeEventListener("animationend", finishClosing);
    finishLightboxClose = null;
    lightbox.classList.remove("is-closing");
    lightbox.hidden = true;
    lightboxImage.removeAttribute("src");
    lightboxUnlockScroll?.();
    lightboxUnlockScroll = null;
  };
  finishLightboxClose = finishClosing;

  if (restoreFocus) trigger?.focus();

  if (!animate || prefersReducedMotion()) {
    finishClosing();
    return;
  }

  lightbox.classList.add("is-closing");
  lightbox.addEventListener("animationend", finishClosing, { once: true });
}

async function moveLightbox(direction: -1 | 1) {
  const buttons = activeImageButtons();
  if (activeIndex === null || buttons.length === 0) return;
  const currentIndex = requestedLightboxIndex ?? activeIndex;
  const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
  requestedLightboxIndex = nextIndex;

  if (prefersReducedMotion() || !document.startViewTransition) {
    activeIndex = nextIndex;
    showActiveImage();
    return;
  }

  clearLightboxPictureTransition();
  const transitionId = ++lightboxTransitionId;
  const nextSource = buttons[nextIndex]?.dataset.fullSrc ?? "";
  const imageReady = await preloadImage(nextSource);
  if (transitionId !== lightboxTransitionId || activeIndex === null) return;
  if (nextIndex === activeIndex) return;

  if (!imageReady) {
    activeIndex = nextIndex;
    showActiveImage();
    return;
  }

  lightboxImage.style.viewTransitionName = "lightbox-picture";
  document.documentElement.dataset.motion = "lightbox-picture";

  const transition = document.startViewTransition(() => {
    if (transitionId !== lightboxTransitionId || activeIndex === null) return;
    activeIndex = nextIndex;
    showActiveImage();
  });
  void transition.ready.catch(() => {});

  const clearTransitionState = () => {
    if (transitionId !== lightboxTransitionId) return;
    clearLightboxPictureTransition();
  };
  void transition.finished.then(clearTransitionState, clearTransitionState);
}

for (const trigger of categoryTriggers) {
  trigger.addEventListener("click", () => {
    const category = trigger.dataset.categoryTrigger;
    if (isCategoryId(category)) {
      selectCategory(category);
      updateCategoryHash(category);
    }
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-lightbox-open]")) {
  button.addEventListener("click", () => openLightbox(button));
}

lightboxClose.addEventListener("click", () => closeLightbox());
lightboxPrevious.addEventListener("click", () => moveLightbox(-1));
lightboxNext.addEventListener("click", () => moveLightbox(1));
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if (mobileMenu.isOpen || event.defaultPrevented || activeIndex === null) return;
  if (event.key === "Escape") closeLightbox();
  else if (event.key === "ArrowLeft") moveLightbox(-1);
  else if (event.key === "ArrowRight") moveLightbox(1);
  else trapFocus(event, lightbox);
});

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(layoutFrame);
  resizeObserver.disconnect();
  closeLightbox({ restoreFocus: false, animate: false });
  finishLightboxClose?.();
});

window.addEventListener("popstate", selectCategoryFromHash);
window.addEventListener("hashchange", selectCategoryFromHash);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) observeActiveGallery();
});

document.documentElement.classList.add("portfolio-enhanced");
const initialCategory = categoryFromHash();
if (initialCategory && initialCategory !== selectedCategory) selectCategory(initialCategory, false);
else {
  observeActiveGallery();
  if (!window.location.hash) window.history.replaceState(null, "", "#tattoo");
}
