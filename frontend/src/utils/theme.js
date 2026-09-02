export const THEME_STORAGE_KEY = "theme";

const VALID_THEME_PREFERENCES = new Set(["light", "dark", "auto"]);

export const normalizeThemePreference = (value) =>
  VALID_THEME_PREFERENCES.has(value) ? value : "auto";

export const getSystemTheme = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const getStoredThemePreference = () => {
  if (typeof window === "undefined") {
    return "auto";
  }

  return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
};

export const resolveThemePreference = (preference) => {
  const normalizedPreference = normalizeThemePreference(preference);
  return normalizedPreference === "auto" ? getSystemTheme() : normalizedPreference;
};

export const applyThemePreference = (preference) => {
  const normalizedPreference = normalizeThemePreference(preference);
  const resolvedTheme = resolveThemePreference(normalizedPreference);

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("data-theme-switching", "true");
    root.setAttribute("data-theme", resolvedTheme);
    root.setAttribute("data-theme-mode", normalizedPreference);
    root.style.colorScheme = resolvedTheme;
    root.style.backgroundColor = resolvedTheme === "dark" ? "#131b24" : "#f7f8fb";

    // Keep the mobile browser chrome (address bar) in step with the chosen
    // theme, not just the OS preference.
    const themeColorMeta =
      document.getElementById("theme-color-meta") ||
      document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", resolvedTheme === "dark" ? "#0f141c" : "#2b62c4");
    }

    if (document.body) {
      document.body.style.backgroundColor = resolvedTheme === "dark" ? "#131b24" : "#f7f8fb";
    }

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          root.removeAttribute("data-theme-switching");
          if (document.body) {
            document.body.style.backgroundColor = "";
          }
        });
      });
    } else {
      root.removeAttribute("data-theme-switching");
      if (document.body) {
        document.body.style.backgroundColor = "";
      }
    }
  }

  return {
    preference: normalizedPreference,
    resolved: resolvedTheme,
  };
};

export const saveThemePreference = (preference) => {
  const normalizedPreference = normalizeThemePreference(preference);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizedPreference);
  }

  return applyThemePreference(normalizedPreference);
};

export const subscribeToSystemThemeChange = (onChange) => {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    typeof onChange !== "function"
  ) {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => onChange(getSystemTheme());

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }

  mediaQuery.addListener(handleChange);
  return () => mediaQuery.removeListener(handleChange);
};
