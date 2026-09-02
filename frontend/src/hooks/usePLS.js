import { useContext } from 'react';
import { PLSContext } from '../components/contexts/PLSContext';

export const usePLS = () => {
  const context = useContext(PLSContext);
  if (!context) {
    throw new Error('usePLS must be used within a PLSProvider');
  }
  return context;
};

export default usePLS;
