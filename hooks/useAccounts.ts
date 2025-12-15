import { useContext } from 'react';
import { AccountsContext } from '@/contexts/AccountsContext';

export const useAccounts = () => useContext(AccountsContext);
