export function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("Page element is missing: " + selector);
  return element;
}

let scrollLocks = 0;
let restoreScroll: (() => void) | undefined;

// Keep the page in place while the artwork viewer is open.
export function lockDocumentScroll() {
  if (scrollLocks === 0) {
    const body = document.body.style;
    const html = document.documentElement.style;
    const { overflow, paddingRight } = body;
    const htmlOverflow = html.overflow;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

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
