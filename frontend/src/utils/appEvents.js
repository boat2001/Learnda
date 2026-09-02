export const APP_EVENTS = {
  STATE_CHANGED: "learnda:stateChanged",
  THEME_CHANGED: "learnda:themeChanged",
};

export const APP_STATE_SCOPES = {
  ACADEMIC: "academic",
  PROFILE: "profile",
  SUBSCRIPTION: "subscription",
  PREFERENCES: "preferences",
  SETTINGS: "settings",
};

export const emitStateChanged = (scopes = [], extra = {}) => {
  if (typeof window === "undefined") return;
  const normalizedScopes = Array.isArray(scopes) ? scopes : [scopes];
  window.dispatchEvent(
    new CustomEvent(APP_EVENTS.STATE_CHANGED, {
      detail: {
        scopes: normalizedScopes.filter(Boolean),
        ...extra,
      },
    })
  );
};

export const emitThemeChanged = (theme) => {
  if (typeof window === "undefined" || !theme) return;
  window.dispatchEvent(
    new CustomEvent(APP_EVENTS.THEME_CHANGED, {
      detail: { theme },
    })
  );
};
