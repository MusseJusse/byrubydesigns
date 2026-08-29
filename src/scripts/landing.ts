export {};

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("Landing-page element is missing: " + selector);
  return element;
}

function lockDocumentScroll() {
  const previousBodyOverflow = document.body.style.overflow;
  const previousHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
  };
}

function trapFocus(event: KeyboardEvent, container: HTMLElement) {
  if (event.key !== "Tab") return;

  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])'
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

const menuButton = requireElement<HTMLButtonElement>("[data-menu-button]");
const mobileMenu = requireElement<HTMLElement>("[data-mobile-menu]");
let mobileMenuOpen = false;
let unlockScroll: (() => void) | null = null;

function setMobileMenuTabStops(enabled: boolean) {
  for (const element of mobileMenu.querySelectorAll<HTMLElement>("a, button")) {
    element.tabIndex = enabled ? 0 : -1;
  }
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
  unlockScroll?.();
  unlockScroll = null;
  if (restoreFocus) menuButton.focus();
}

function openMobileMenu() {
  mobileMenuOpen = true;
  menuButton.classList.add("is-open");
  menuButton.setAttribute("aria-label", "Close menu");
  menuButton.setAttribute("aria-expanded", "true");
  mobileMenu.classList.add("is-open");
  mobileMenu.setAttribute("aria-hidden", "false");
  setMobileMenuTabStops(true);
  unlockScroll = lockDocumentScroll();
  requestAnimationFrame(() => mobileMenu.querySelector<HTMLElement>("a, button")?.focus());
}

menuButton.addEventListener("click", () => {
  if (mobileMenuOpen) closeMobileMenu(true);
  else openMobileMenu();
});

for (const link of mobileMenu.querySelectorAll<HTMLElement>("[data-menu-close]")) {
  link.addEventListener("click", () => closeMobileMenu(false));
}

document.addEventListener("keydown", (event) => {
  if (!mobileMenuOpen) return;
  if (event.key === "Escape") closeMobileMenu(true);
  else trapFocus(event, mobileMenu);
});

const track = requireElement<HTMLElement>("[data-carousel-track]");
const slides = Array.from(document.querySelectorAll<HTMLElement>("[data-carousel-slide]"));
const markers = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-carousel-marker]")
);
const count = requireElement<HTMLElement>("[data-carousel-count]");
const title = requireElement<HTMLElement>("[data-carousel-title]:not(button)");
let activeIndex = 0;
let drag: { pointerId: number; pointerX: number; scrollLeft: number } | null = null;

function scrollToCarouselItem(index: number) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  track.scrollTo({
    left: index * track.clientWidth,
    behavior: reducedMotion ? "auto" : "smooth"
  });
}

function updateCarousel() {
  const progress = track.scrollLeft / Math.max(track.clientWidth, 1);
  activeIndex = Math.min(slides.length - 1, Math.max(0, Math.round(progress)));

  slides.forEach((slide, index) => {
    const activeAmount = Math.max(0, 1 - Math.abs(progress - index));
    slide.style.opacity = String(activeAmount);
    slide.style.transform = `scale(${0.985 + activeAmount * 0.015})`;
  });

  markers.forEach((marker, index) => {
    const activeAmount = Math.max(0, 1 - Math.abs(progress - index));
    marker.style.flexGrow = String(1 + activeAmount * 3);
    marker.style.backgroundColor = `rgba(144, 52, 76, ${0.22 + activeAmount * 0.78})`;
    if (index === activeIndex) marker.setAttribute("aria-current", "true");
    else marker.removeAttribute("aria-current");
  });

  count.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
  title.textContent = markers[activeIndex]?.dataset.carouselTitle ?? "";
}

track.addEventListener("scroll", updateCarousel, { passive: true });
track.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    scrollToCarouselItem(Math.min(activeIndex + 1, slides.length - 1));
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    scrollToCarouselItem(Math.max(activeIndex - 1, 0));
  }
});

track.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse") return;
  drag = { pointerId: event.pointerId, pointerX: event.clientX, scrollLeft: track.scrollLeft };
  track.classList.add("is-dragging");
  track.setPointerCapture(event.pointerId);
});

track.addEventListener("pointermove", (event) => {
  if (!drag) return;
  track.scrollLeft = drag.scrollLeft - (event.clientX - drag.pointerX);
});

function finishDrag(event: PointerEvent) {
  if (!drag) return;
  const pointerId = drag.pointerId;
  drag = null;
  track.classList.remove("is-dragging");
  if (track.hasPointerCapture(pointerId)) track.releasePointerCapture(pointerId);
  scrollToCarouselItem(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)));
  event.preventDefault();
}

track.addEventListener("pointerup", finishDrag);
track.addEventListener("pointercancel", finishDrag);

markers.forEach((marker, index) => {
  marker.addEventListener("click", () => scrollToCarouselItem(index));
});
