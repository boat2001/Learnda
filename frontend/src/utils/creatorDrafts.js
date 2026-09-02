export const CREATOR_DRAFTS_KEY = 'learnda.creatorDrafts';

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const readCreatorDrafts = () => {
  if (!canUseStorage()) return [];

  try {
    const drafts = JSON.parse(window.localStorage.getItem(CREATOR_DRAFTS_KEY) || '[]');
    return Array.isArray(drafts) ? drafts : [];
  } catch (_error) {
    return [];
  }
};

export const saveCreatorDraft = (draft) => {
  const drafts = readCreatorDrafts();
  const nextDrafts = [draft, ...drafts.filter((item) => item.id !== draft.id)].slice(0, 24);

  if (canUseStorage()) {
    window.localStorage.setItem(CREATOR_DRAFTS_KEY, JSON.stringify(nextDrafts));
  }

  return nextDrafts;
};

export const removeCreatorDraft = (draftId) => {
  const nextDrafts = readCreatorDrafts().filter((draft) => draft.id !== draftId);

  if (canUseStorage()) {
    window.localStorage.setItem(CREATOR_DRAFTS_KEY, JSON.stringify(nextDrafts));
  }

  return nextDrafts;
};
