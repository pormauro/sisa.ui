import { useState, useEffect, useCallback } from 'react';
import { fetchFolders } from '../services/folderService';

export const useFolders = () => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchFolders();
      setFolders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  return { folders, loading, error, reload: loadFolders };
};

