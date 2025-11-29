import { useContext, useEffect, useState } from 'react';

import { FileContext } from '@/contexts/FilesContext';

export const useCompanyLogo = (fileId?: string | number | null) => {
  const { getFile } = useContext(FileContext);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLogo = async () => {
      if (!fileId) {
        setUri(null);
        return;
      }

      const parsedId = Number(fileId);
      if (!Number.isFinite(parsedId)) {
        setUri(null);
        return;
      }

      const fileUri = await getFile(parsedId);
      if (!cancelled) {
        setUri(fileUri);
      }
    };

    void loadLogo();

    return () => {
      cancelled = true;
    };
  }, [fileId, getFile]);

  return uri;
};
