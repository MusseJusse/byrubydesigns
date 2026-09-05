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
let activeIndex = 0;
let activeButtons: HTMLButtonElement[] = [];
let unlockScroll: (() => void) | undefined;

function syncFromHash() {
  const hash = window.location.hash.slice(1);
  // Keep existing /gallery#tattoo, #paintings, and #drawings links working.
  const filter = filters.find((input) => input.value === (hash || "selected"));
  if (filter) filter.checked = true;
}

for (const filter of filters) {
  filter.addEventListener("change", () => {
    if (lightbox.open) lightbox.close();
    window.history.pushState(null, "", "#" + filter.value);
    syncFromHash();
    if (gallery.getBoundingClientRect().top < 0) gallery.scrollIntoView();
  });
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
  });
}

requireElement<HTMLButtonElement>("[data-lightbox-close]").addEventListener(
  "click",
  () => lightbox.close(),
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
  if (event.target === lightbox) lightbox.close();
});
lightbox.addEventListener("close", () => {
  unlockScroll?.();
  unlockScroll = undefined;
  lightboxImage.removeAttribute("src");
});
lightbox.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    moveImage(event.key === "ArrowLeft" ? -1 : 1);
  }
});
window.addEventListener("hashchange", syncFromHash);
window.addEventListener("popstate", syncFromHash);
window.addEventListener("pageshow", syncFromHash);
window.addEventListener("pagehide", () => {
  lightbox.close();
  unlockScroll?.();
  unlockScroll = undefined;
});
syncFromHash();
