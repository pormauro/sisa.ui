import { useEffect } from 'react';
import { Platform } from 'react-native';

import { recordShareDebug } from '@/utils/shareDebug';

export interface SharedIntentFile {
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  text?: string;
  weblink?: string;
  contentUri?: string;
  extension?: string;
}

type ReceiveSharingIntentModule = {
  getReceivedFiles: (
    onSuccess: (files: SharedIntentFile[]) => void,
    onError: (error: unknown) => void,
    appGroupId?: string
  ) => void;
  clearReceivedFiles: () => void;
};

const APP_PACKAGE = 'com.pormauro.sisa';

export function useShareIntent(onReceive: (files: SharedIntentFile[]) => void): void {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const receiveSharingIntent = require('react-native-receive-sharing-intent')
      ?.default as ReceiveSharingIntentModule | undefined;

    if (!receiveSharingIntent) {
      recordShareDebug('share-intent:module-missing', { platform: Platform.OS });
      return;
    }

    receiveSharingIntent.getReceivedFiles(
      files => {
        if (!files || files.length === 0) {
          recordShareDebug('share-intent:empty-payload', { platform: Platform.OS });
          return;
        }

        recordShareDebug('share-intent:received', {
          platform: Platform.OS,
          filesCount: files.length,
          firstFile: files[0],
        });

        onReceive(files);
      },
      error => {
        recordShareDebug('share-intent:error', {
          platform: Platform.OS,
          error,
        });
      },
      APP_PACKAGE
    );

    return () => {
      receiveSharingIntent.clearReceivedFiles();
      recordShareDebug('share-intent:cleared', { platform: Platform.OS });
    };
  }, [onReceive]);
}
