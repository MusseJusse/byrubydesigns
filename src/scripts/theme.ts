type Theme = "light" | "dark";

const storageKey = "ruby-theme";
const root = document.documentElement;
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const toggles = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]"));

function currentTheme(): Theme {
  return root.dataset.theme === "dark" ? "dark" : "light";
}

function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // The selected theme still applies for this page when storage is unavailable.
  }
}

function applyTheme(theme: Theme, persist: boolean) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  themeColor?.setAttribute("content", theme === "dark" ? "#1b1b1a" : "#ffffff");

  for (const toggle of toggles) {
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
  }

  if (persist) storeTheme(theme);
}

for (const toggle of toggles) {
  toggle.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
  });
}

applyTheme(currentTheme(), false);
