import { useCallback, useEffect, useState } from "react";
import type { SyncFeedback } from "./types";

export function useDashboardSyncFeedback() {
  const [syncFeedback, setSyncFeedback] = useState<SyncFeedback | null>(null);

  const showSyncFeedback = useCallback((tone: SyncFeedback["tone"], message: string) => {
    setSyncFeedback({
      id: Date.now(),
      tone,
      message,
    });
  }, []);

  const dismissSyncFeedback = useCallback(() => {
    setSyncFeedback(null);
  }, []);

  useEffect(() => {
    if (!syncFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSyncFeedback((current) => (current?.id === syncFeedback.id ? null : current));
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [syncFeedback]);

  return {
    syncFeedback,
    showSyncFeedback,
    dismissSyncFeedback,
  };
}
