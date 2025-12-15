import { useContext } from 'react';
import { AccountingReportsContext } from '@/contexts/AccountingReportsContext';

export const useAccountingReports = () => useContext(AccountingReportsContext);
