export function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("Page element is missing: " + selector);
  return element;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let scrollLocks = 0;
let restoreScroll: (() => void) | undefined;

// The menu and lightbox can overlap. Restore scrolling after both release it.
export function lockDocumentScroll() {
  if (scrollLocks === 0) {
    const body = document.body.style;
    const html = document.documentElement.style;
    const { overflow, paddingRight } = body;
    const htmlOverflow = html.overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.overflow = "hidden";
    html.overflow = "hidden";
    if (scrollbarWidth > 0) body.paddingRight = scrollbarWidth + "px";

    restoreScroll = () => {
      body.overflow = overflow;
      body.paddingRight = paddingRight;
      html.overflow = htmlOverflow;
    };
  }
  scrollLocks += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    scrollLocks -= 1;
    if (scrollLocks === 0) {
      restoreScroll?.();
      restoreScroll = undefined;
    }
  };
}

export function trapFocus(event: KeyboardEvent, container: HTMLElement) {
  if (event.key !== "Tab") return;

  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])'
    )
  ).filter((element) => element.getClientRects().length > 0);
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
