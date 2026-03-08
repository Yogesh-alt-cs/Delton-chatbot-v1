import { useEffect, useRef } from 'react';

export function useTabTitle(isLoading: boolean) {
  const defaultTitle = 'Delton AI';
  const wasHiddenWhileLoading = useRef(false);

  useEffect(() => {
    if (isLoading) {
      document.title = '⏳ Delton — Thinking...';
    } else {
      // If we were hidden while loading and now done, show ready
      if (wasHiddenWhileLoading.current && document.hidden) {
        document.title = '✅ Delton — Response ready';
      } else {
        document.title = defaultTitle;
      }
      wasHiddenWhileLoading.current = false;
    }
  }, [isLoading]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isLoading) {
        wasHiddenWhileLoading.current = true;
      }
      if (!document.hidden) {
        // User came back — reset title
        document.title = defaultTitle;
        wasHiddenWhileLoading.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.title = defaultTitle;
    };
  }, [isLoading]);
}
