import { useEffect, useState } from 'react';
import ContributionPlansModal from './ContributionPlansModal';

/**
 * Listens for the `openContributionModal` event and renders the contribution
 * plans modal. Mounted once at the app shell, alongside UpgradeModalHost.
 */
export default function ContributionModalHost() {
  const [state, setState] = useState({ open: false, source: 'contribution_banner' });

  useEffect(() => {
    const handleOpen = (event) => {
      setState({ open: true, source: event?.detail?.source || 'contribution_banner' });
    };
    window.addEventListener('openContributionModal', handleOpen);
    return () => window.removeEventListener('openContributionModal', handleOpen);
  }, []);

  return (
    <ContributionPlansModal
      isOpen={state.open}
      source={state.source}
      onClose={() => setState((prev) => ({ ...prev, open: false }))}
    />
  );
}
