import { useSubscriptionContext } from '../components/contexts/SubscriptionContext';

export function useSubscription() {
  return useSubscriptionContext();
}
