import { useSyncExternalStore } from 'react';

/** Must match StudyGroupRoom.css overlay breakpoint (≤900px). */
export const CHAT_SIDE_PANEL_MOBILE_MQ = '(max-width: 900px)';

export function subscribeChatSidePanelMobileMq(onStoreChange) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(CHAT_SIDE_PANEL_MOBILE_MQ);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

export function getChatSidePanelMobileMqSnapshot() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(CHAT_SIDE_PANEL_MOBILE_MQ).matches;
}

/** True when side panels behave as full-height overlays (tap outside to dismiss). */
export default function useChatSidePanelMobileLayout() {
  return useSyncExternalStore(subscribeChatSidePanelMobileMq, getChatSidePanelMobileMqSnapshot, () => false);
}
