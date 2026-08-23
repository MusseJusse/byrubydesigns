type CategoryId = "tattoo" | "drawings" | "paintings";

const categoryIds: readonly CategoryId[] = ["tattoo", "drawings", "paintings"];

function isCategoryId(value: string | undefined): value is CategoryId {
  return value !== undefined && categoryIds.some((category) => category === value);
}

function categoryFromHash(): CategoryId | undefined {
  const category = window.location.hash.slice(1);
  return isCategoryId(category) ? category : undefined;
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

  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = scrollbarWidth + "px";
  }

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
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("hidden"));

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

const menuButton = requireElement<HTMLButtonElement>("[data-menu-button]");
const mobileMenu = requireElement<HTMLElement>("[data-mobile-menu]");
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
let mobileMenuOpen = false;
let menuUnlockScroll: (() => void) | null = null;
let lightboxUnlockScroll: (() => void) | null = null;
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

  const items = Array.from(gallery.querySelectorAll<HTMLElement>(".sonia-gallery-item"));
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
    const viewportWidth = document.documentElement.clientWidth;
    const dividerPageInset = viewportWidth * 0.0405;
    const dividerX = dividerPageInset - gallery.getBoundingClientRect().left;

    yearDivider.style.width = viewportWidth - dividerPageInset * 2 + "px";
    yearDivider.style.transform = "translate3d(" + dividerX + "px, " + dividerY + "px, 0)";

    const secondYearStart = dividerY + yearDivider.offsetHeight + (isMobile ? 24 : 32);
    galleryBottom = layoutItems(items.slice(yearBreakIndex), secondYearStart);
  } else {
    galleryBottom = layoutItems(items, 0);
  }

  gallery.style.height = Math.max(0, galleryBottom) + "px";
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

  const divider = gallery.querySelector<HTMLElement>("[data-year-divider]");
  if (divider) resizeObserver.observe(divider);
  scheduleLayout();
}

function selectCategory(category: CategoryId) {
  if (category === selectedCategory) {
    if (mobileMenuOpen) closeMobileMenu(true);
    return;
  }

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
  if (mobileMenuOpen) closeMobileMenu(true);
}

function selectCategoryFromHash() {
  const category = categoryFromHash();
  if (category) selectCategory(category);
  else if (!window.location.hash) selectCategory("tattoo");
}

function updateCategoryHash(category: CategoryId) {
  if (categoryFromHash() === category) return;
  window.history.pushState(null, "", "#" + category);
}

function setMobileMenuTabStops(enabled: boolean) {
  for (const element of mobileMenu.querySelectorAll<HTMLElement>("a, button")) {
    element.tabIndex = enabled ? 0 : -1;
  }
}

function openMobileMenu() {
  closeLightbox(false);
  mobileMenuOpen = true;
  menuButton.classList.add("is-open");
  menuButton.setAttribute("aria-label", "Close menu");
  menuButton.setAttribute("aria-expanded", "true");
  mobileMenu.classList.add("is-open");
  mobileMenu.setAttribute("aria-hidden", "false");
  setMobileMenuTabStops(true);
  menuUnlockScroll = lockDocumentScroll();

  requestAnimationFrame(() => {
    mobileMenu.querySelector<HTMLElement>("button, a")?.focus();
  });
}

function closeMobileMenu(restoreFocus: boolean) {
  if (!mobileMenuOpen) return;
  mobileMenuOpen = false;
  menuButton.classList.remove("is-open");
  menuButton.setAttribute("aria-label", "Open menu");
  menuButton.setAttribute("aria-expanded", "false");
  mobileMenu.classList.remove("is-open");
  mobileMenu.setAttribute("aria-hidden", "true");
  setMobileMenuTabStops(false);
  menuUnlockScroll?.();
  menuUnlockScroll = null;
  if (restoreFocus) menuButton.focus();
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
  lightboxImage.alt = button.dataset.alt ?? "";
  lightboxCaption.replaceChildren(...captionLines);
  lightbox.setAttribute("aria-label", "Full image of " + titleText);
}

function openLightbox(button: HTMLButtonElement) {
  const category = button.dataset.category;
  const index = Number.parseInt(button.dataset.index ?? "", 10);
  if (!isCategoryId(category) || category !== selectedCategory || !Number.isFinite(index)) return;

  closeMobileMenu(false);
  activeIndex = index;
  activeTrigger = button;
  showActiveImage();
  lightbox.hidden = false;
  lightboxUnlockScroll = lockDocumentScroll();
  requestAnimationFrame(() => lightboxClose.focus());
}

function closeLightbox(restoreFocus = true) {
  if (activeIndex === null) return;
  const trigger = activeTrigger;
  activeIndex = null;
  activeTrigger = null;
  lightbox.hidden = true;
  lightboxImage.removeAttribute("src");
  lightboxUnlockScroll?.();
  lightboxUnlockScroll = null;
  if (restoreFocus) trigger?.focus();
}

function moveLightbox(direction: -1 | 1) {
  const buttons = activeImageButtons();
  if (activeIndex === null || buttons.length === 0) return;
  activeIndex = (activeIndex + direction + buttons.length) % buttons.length;
  showActiveImage();
}

menuButton.addEventListener("click", () => {
  if (mobileMenuOpen) closeMobileMenu(true);
  else openMobileMenu();
});

for (const trigger of categoryTriggers) {
  trigger.addEventListener("click", () => {
    const category = trigger.dataset.categoryTrigger;
    if (isCategoryId(category)) {
      selectCategory(category);
      updateCategoryHash(category);
    }
  });
}

for (const element of mobileMenu.querySelectorAll<HTMLElement>("[data-menu-close]")) {
  element.addEventListener("click", () => closeMobileMenu(true));
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
  if (activeIndex !== null) {
    if (event.key === "Escape") closeLightbox();
    else if (event.key === "ArrowLeft") moveLightbox(-1);
    else if (event.key === "ArrowRight") moveLightbox(1);
    else trapFocus(event, lightbox);
    return;
  }

  if (mobileMenuOpen) {
    if (event.key === "Escape") closeMobileMenu(true);
    else trapFocus(event, mobileMenu);
  }
});

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(layoutFrame);
  resizeObserver?.disconnect();
  menuUnlockScroll?.();
  lightboxUnlockScroll?.();
});

window.addEventListener("popstate", selectCategoryFromHash);
window.addEventListener("hashchange", selectCategoryFromHash);

document.documentElement.classList.add("portfolio-enhanced");
const initialCategory = categoryFromHash();
if (initialCategory && initialCategory !== selectedCategory) selectCategory(initialCategory);
else observeActiveGallery();
