type CategoryId = "tattoo" | "drawings" | "paintings";

const categoryIds: readonly CategoryId[] = ["tattoo", "drawings", "paintings"];

function isCategoryId(value: string | undefined): value is CategoryId {
  return value !== undefined && categoryIds.some((category) => category === value);
}

function categoryFromHash(): CategoryId | undefined {
  const category = window.location.hash.slice(1);
  return isCategoryId(category) ? category : undefined;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("Portfolio element is missing: " + selector);
  return element;
}

function lockDocumentScroll() {
  const previousBodyOverflow = document.body.style.overflow;
  const previousBodyPaddingRight = document.body.style.paddingRight;
  const previousHtmlOverflow = document.documentElement.style.overflow;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  let locked = true;

  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  if (scrollbarWidth > 0) document.body.style.paddingRight = scrollbarWidth + "px";

  return () => {
    if (!locked) return;
    locked = false;
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
    document.documentElement.style.overflow = previousHtmlOverflow;
  };
}

function trapFocus(event: KeyboardEvent, container: HTMLElement) {
  if (event.key !== "Tab") return;

  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"])'
    )
  );
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
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
let activeTrigger: HTMLButtonElement | null = null;
let unlockLightboxScroll: (() => void) | null = null;
let layoutFrame = 0;
let resizeObserver: ResizeObserver | null = null;

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
  ).filter((button) => button.getClientRects().length > 0);
}

function scheduleLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(layoutActiveGallery);
}

function clearDesktopLayout(gallery: HTMLElement) {
  gallery.style.removeProperty("height");
  for (const item of gallery.querySelectorAll<HTMLElement>(".sonia-gallery-item")) {
    item.style.removeProperty("width");
    item.style.removeProperty("transform");
  }
  const divider = gallery.querySelector<HTMLElement>("[data-year-divider]");
  divider?.style.removeProperty("width");
  divider?.style.removeProperty("transform");
  gallery.classList.add("is-ready");
}

function layoutActiveGallery() {
  const gallery = activePanel().querySelector<HTMLElement>("[data-gallery-grid]");
  if (!gallery) throw new Error("The active gallery grid is missing");

  if (window.innerWidth <= 640) {
    clearDesktopLayout(gallery);
    return;
  }

  const items = Array.from(gallery.querySelectorAll<HTMLElement>(".sonia-gallery-item"));
  const columnCount = window.innerWidth >= 900 ? 3 : 2;
  const columnRatios = columnCount === 3 ? [1.18, 0.82, 1] : [1, 1];
  const horizontalGap = Math.min(22, Math.max(12, window.innerWidth * 0.015));
  const verticalGap = Math.min(42, Math.max(26, window.innerWidth * 0.03));
  const galleryStyle = getComputedStyle(gallery);
  const paddingLeft = Number.parseFloat(galleryStyle.paddingLeft);
  const paddingRight = Number.parseFloat(galleryStyle.paddingRight);
  const paddingTop = Number.parseFloat(galleryStyle.paddingTop);
  const paddingBottom = Number.parseFloat(galleryStyle.paddingBottom);
  const contentWidth = gallery.clientWidth - paddingLeft - paddingRight;
  const ratioTotal = columnRatios.reduce((total, ratio) => total + ratio, 0);
  const widthUnit = (contentWidth - horizontalGap * (columnCount - 1)) / ratioTotal;
  const columnWidths = columnRatios.map((ratio) => widthUnit * ratio);
  const columnOffsets = columnWidths.map((_, index) =>
    columnWidths
      .slice(0, index)
      .reduce((offset, width) => offset + width + horizontalGap, paddingLeft)
  );

  items.forEach((item, index) => {
    item.style.width = columnWidths[index % columnCount] + "px";
  });

  function layoutItems(group: HTMLElement[], startY: number) {
    const columnHeights = Array.from({ length: columnCount }, () => startY);

    group.forEach((item, index) => {
      const columnIndex = index % columnCount;
      const x = columnOffsets[columnIndex] ?? paddingLeft;
      const y = columnHeights[columnIndex] ?? startY;
      item.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      columnHeights[columnIndex] = y + item.offsetHeight + verticalGap;
    });

    return Math.max(...columnHeights) - verticalGap;
  }

  const yearDivider = gallery.querySelector<HTMLElement>("[data-year-divider]");
  const parsedBreakIndex = Number.parseInt(gallery.dataset.yearBreakIndex ?? "", 10);
  const yearBreakIndex = Number.isFinite(parsedBreakIndex) ? parsedBreakIndex : -1;
  let galleryBottom: number;

  if (yearDivider && yearBreakIndex > 0) {
    const firstYearBottom = layoutItems(items.slice(0, yearBreakIndex), paddingTop);
    const dividerY = firstYearBottom + 64;
    yearDivider.style.width = contentWidth + "px";
    yearDivider.style.transform = `translate3d(${paddingLeft}px, ${dividerY}px, 0)`;
    galleryBottom = layoutItems(
      items.slice(yearBreakIndex),
      dividerY + yearDivider.offsetHeight + 32
    );
  } else {
    galleryBottom = layoutItems(items, paddingTop);
  }

  gallery.style.height = Math.max(0, galleryBottom + paddingBottom) + "px";
  gallery.classList.add("is-ready");
}

function observeActiveGallery() {
  resizeObserver?.disconnect();
  const gallery = activePanel().querySelector<HTMLElement>("[data-gallery-grid]");
  if (!gallery) throw new Error("The active gallery grid is missing");

  gallery.classList.remove("is-ready");
  resizeObserver = new ResizeObserver(scheduleLayout);
  resizeObserver.observe(gallery);
  for (const item of gallery.querySelectorAll<HTMLElement>(".sonia-gallery-item")) {
    resizeObserver.observe(item);
  }
  scheduleLayout();
}

function selectCategory(category: CategoryId) {
  closeLightbox(false);
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
}

function updateCategoryFromHash() {
  const category = categoryFromHash();
  if (category && category !== selectedCategory) selectCategory(category);
}

function showActiveImage() {
  const buttons = activeImageButtons();
  if (activeIndex === null) return;
  const button = buttons[activeIndex];
  if (!button) return;

  const title = document.createElement("cite");
  const titleText = button.dataset.title ?? "Artwork";
  title.textContent = titleText;
  const captionLines: HTMLElement[] = [title];

  for (const detail of [button.dataset.medium, button.dataset.dimensions]) {
    if (!detail) continue;
    const line = document.createElement("span");
    line.textContent = detail;
    captionLines.push(line);
  }

  lightboxImage.src = button.dataset.fullSrc ?? "";
  lightboxImage.alt = button.dataset.alt ?? "";
  lightboxCaption.replaceChildren(...captionLines);
  lightbox.setAttribute("aria-label", "Full image of " + titleText);
}

function openLightbox(button: HTMLButtonElement) {
  const category = button.dataset.category;
  const index = Number.parseInt(button.dataset.index ?? "", 10);
  if (!isCategoryId(category) || category !== selectedCategory || !Number.isFinite(index)) return;

  activeIndex = index;
  activeTrigger = button;
  showActiveImage();
  lightbox.inert = false;
  lightbox.hidden = false;
  unlockLightboxScroll ??= lockDocumentScroll();
  requestAnimationFrame(() => lightboxClose.focus());
}

function closeLightbox(restoreFocus = true) {
  if (activeIndex === null) return;
  const trigger = activeTrigger;
  activeIndex = null;
  activeTrigger = null;
  lightbox.inert = true;
  lightbox.hidden = true;
  lightboxImage.removeAttribute("src");
  unlockLightboxScroll?.();
  unlockLightboxScroll = null;
  if (restoreFocus) trigger?.focus();
}

function moveLightbox(direction: -1 | 1) {
  const buttons = activeImageButtons();
  if (activeIndex === null || buttons.length === 0) return;
  activeIndex = (activeIndex + direction + buttons.length) % buttons.length;
  showActiveImage();
}

for (const trigger of categoryTriggers) {
  trigger.addEventListener("click", () => {
    const category = trigger.dataset.categoryTrigger;
    if (!isCategoryId(category)) return;
    selectCategory(category);
    window.history.pushState(null, "", "#" + category);
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
  if (activeIndex === null) return;
  if (event.key === "Escape") closeLightbox();
  else if (event.key === "ArrowLeft") moveLightbox(-1);
  else if (event.key === "ArrowRight") moveLightbox(1);
  else trapFocus(event, lightbox);
});

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(layoutFrame);
  resizeObserver?.disconnect();
  unlockLightboxScroll?.();
});
window.addEventListener("popstate", updateCategoryFromHash);
window.addEventListener("hashchange", updateCategoryFromHash);

document.documentElement.classList.add("portfolio-enhanced");
const initialCategory = categoryFromHash();
if (initialCategory) selectCategory(initialCategory);
else {
  observeActiveGallery();
  window.history.replaceState(null, "", "#tattoo");
}

if (prefersReducedMotion()) document.documentElement.dataset.reducedMotion = "true";
