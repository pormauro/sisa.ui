import { useContext } from 'react';
import { JournalEntriesContext } from '@/contexts/JournalEntriesContext';

export const useJournalEntries = () => useContext(JournalEntriesContext);
