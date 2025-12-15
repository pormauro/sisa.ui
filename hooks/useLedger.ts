import { useContext } from 'react';
import { LedgerContext } from '@/contexts/LedgerContext';

export const useLedger = () => useContext(LedgerContext);
