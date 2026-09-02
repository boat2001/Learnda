const FEATURE_LABEL_MAP = {
  text_lessons:    "Text lessons",
  premium_content: "Access all content",
  commenting:      "Comment on resources",
  contributions:   "Contribute & earn",
  personalization: "Personalised experience",
  save_to_pls:     "Save to Personal Learning Space",
  unlimited_pls:   "Unlimited Personal Learning Space",
};

const ACRONYM_TOKENS = new Set(["pls", "ai", "api", "otp"]);

const isLikelyFeatureKey = (value = "") =>
  /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(String(value || "").trim());

const normalizeFeatureKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

const toLabelFromKey = (key = "") =>
  key
    .split("_")
    .filter(Boolean)
    .map((part) => {
      if (ACRONYM_TOKENS.has(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");

const resolveFeatureLabel = (feature) => {
  if (typeof feature === "string") {
    const trimmed = feature.trim();
    if (!trimmed) return null;
    if (!isLikelyFeatureKey(trimmed)) {
      return trimmed;
    }
    const normalizedKey = normalizeFeatureKey(trimmed);
    return FEATURE_LABEL_MAP[normalizedKey] || toLabelFromKey(normalizedKey);
  }

  if (!feature || typeof feature !== "object") {
    return null;
  }

  const preferredLabel =
    (typeof feature.label === "string" && feature.label.trim()) ||
    (typeof feature.name === "string" && feature.name.trim()) ||
    (typeof feature.title === "string" && feature.title.trim()) ||
    "";

  if (preferredLabel && !isLikelyFeatureKey(preferredLabel)) {
    return preferredLabel;
  }

  const featureKey =
    (typeof feature.feature_key === "string" && feature.feature_key.trim()) ||
    (typeof feature.key === "string" && feature.key.trim()) ||
    preferredLabel;

  if (!featureKey) return null;

  const normalizedKey = normalizeFeatureKey(featureKey);
  return FEATURE_LABEL_MAP[normalizedKey] || toLabelFromKey(normalizedKey);
};

export const normalizePlanFeatures = (features = []) => {
  if (!Array.isArray(features)) return [];

  const labels = [];
  const seen = new Set();

  features.forEach((feature) => {
    if (feature && typeof feature === "object" && feature.enabled === false) {
      return;
    }

    const label = resolveFeatureLabel(feature);
    if (!label) return;

    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    labels.push(label);
  });

  return labels;
};

