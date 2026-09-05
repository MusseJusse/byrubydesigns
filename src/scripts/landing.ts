import { prefersReducedMotion, requireElement } from "./dom";
import { createMobileMenu } from "./mobile-menu";

createMobileMenu();

const track = requireElement<HTMLElement>("[data-carousel-track]");
const slides = Array.from(document.querySelectorAll<HTMLElement>("[data-carousel-slide]"));
const markers = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-carousel-marker]")
);
const counts = Array.from(
  document.querySelectorAll<HTMLElement>("[data-carousel-count]")
);
const titles = Array.from(
  document.querySelectorAll<HTMLElement>("[data-carousel-title]:not(button)")
);
if (counts.length === 0) throw new Error("Landing-page carousel count is missing");
if (titles.length === 0) throw new Error("Landing-page carousel title is missing");
let activeIndex = 0;
let drag: { pointerId: number; pointerX: number; scrollLeft: number } | null = null;

function scrollToCarouselItem(index: number) {
  track.scrollTo({
    left: index * track.clientWidth,
    behavior: prefersReducedMotion() ? "auto" : "smooth"
  });
}

function updateCarousel() {
  const progress = track.scrollLeft / Math.max(track.clientWidth, 1);
  const nextIndex = Math.min(slides.length - 1, Math.max(0, Math.round(progress)));

  slides.forEach((slide, index) => {
    const activeAmount = Math.max(0, 1 - Math.abs(progress - index));
    slide.style.opacity = String(activeAmount);
    slide.style.transform = `scale(${0.985 + activeAmount * 0.015})`;
  });

  markers.forEach((marker, index) => {
    const activeAmount = Math.max(0, 1 - Math.abs(progress - index));
    marker.style.flexGrow = String(1 + activeAmount * 3);
    marker.style.backgroundColor = `rgba(144, 52, 76, ${0.22 + activeAmount * 0.78})`;
    if (index === nextIndex) marker.setAttribute("aria-current", "true");
    else marker.removeAttribute("aria-current");
  });

  if (nextIndex === activeIndex) return;
  activeIndex = nextIndex;

  const nextCount = `${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
  const nextTitle = markers[activeIndex]?.dataset.carouselTitle ?? "";
  counts.forEach((count) => (count.textContent = nextCount));
  titles.forEach((title) => (title.textContent = nextTitle));
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
