const GOOGLE_SCRIPT_ID = "google-identity-script";
let googleScriptPromise = null;

/** Path on this SPA where Google redirects after consent (must match Google Cloud Console). */
export const GOOGLE_OAUTH_CALLBACK_PATH = "/auth/google/callback";

export const GOOGLE_OAUTH_SESSION_KEYS = {
  RETURN: "learnda_google_oauth_return",
  STATE: "learnda_google_oauth_state",
};

export const getGoogleOAuthRedirectUri = () => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${GOOGLE_OAUTH_CALLBACK_PATH}`;
};

export const loadGoogleIdentityScript = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Identity Services requires a browser environment"));
  }

  if (window.google?.accounts?.id || window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Identity script")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity script"));
    document.head.appendChild(script);
  }).catch((error) => {
    googleScriptPromise = null;
    throw error;
  });

  return googleScriptPromise;
};

