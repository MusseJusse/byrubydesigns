import { lockDocumentScroll, requireElement, trapFocus } from "./dom";

export function createMobileMenu({
  onOpened,
  restoreFocus,
}: { onOpened?: () => void; restoreFocus?: (button: HTMLButtonElement) => void } = {}) {
  const button = requireElement<HTMLButtonElement>("[data-menu-button]");
  const menu = requireElement<HTMLElement>("[data-mobile-menu]");
  const items = menu.querySelectorAll<HTMLElement>("a, button");
  let isOpen = false;
  let unlockScroll: (() => void) | undefined;

  function setOpen(open: boolean) {
    isOpen = open;
    button.classList.toggle("is-open", open);
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    button.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    for (const item of items) item.tabIndex = open ? 0 : -1;
  }

  function close(shouldRestoreFocus = true) {
    if (!isOpen) return;
    setOpen(false);
    unlockScroll?.();
    unlockScroll = undefined;
    if (shouldRestoreFocus) {
      if (restoreFocus) restoreFocus(button);
      else button.focus();
    }
  }

  button.addEventListener("click", () => {
    if (isOpen) {
      close();
      return;
    }
    setOpen(true);
    unlockScroll = lockDocumentScroll();
    requestAnimationFrame(() => {
      if (isOpen) items[0]?.focus();
    });
  });

  menu.addEventListener("transitionend", (event) => {
    if (event.target === menu && event.propertyName === "opacity" && isOpen) {
      onOpened?.();
    }
  });

  for (const link of menu.querySelectorAll<HTMLElement>("[data-menu-close]")) {
    link.addEventListener("click", () => close(false));
  }

  document.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else trapFocus(event, menu);
  });

  window.matchMedia("(max-width: 640px)").addEventListener("change", (event) => {
    if (!event.matches) close(false);
  });
  window.addEventListener("pagehide", () => close(false));

  return {
    close,
    get isOpen() { return isOpen; }
  };
}
