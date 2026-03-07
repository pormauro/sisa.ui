import { useEffect } from "react";
import ReceiveSharingIntent from "react-native-receive-sharing-intent";

export function useShareIntent(onReceive: (files: any[]) => void) {
  useEffect(() => {
    ReceiveSharingIntent.getReceivedFiles(
      (files) => {
        if (!files || files.length === 0) return;
        onReceive(files);
      },
      (error) => {
        console.log("Share error", error);
      },
      "com.pormauro.sisa"
    );

    return () => {
      ReceiveSharingIntent.clearReceivedFiles();
    };
  }, []);
}