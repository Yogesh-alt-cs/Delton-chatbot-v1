import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      setIsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser.');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setIsEnabled(result === 'granted');
      
      if (result === 'granted') {
        toast.success('Push notifications enabled!');
        // Show a test notification
        sendNotification('Delton Chatbot', {
          body: 'You will now receive notifications.',
          icon: '/icon-192.png',
        });
        return true;
      } else if (result === 'denied') {
        toast.error('Notification permission denied. You can enable it in browser settings.');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to request notification permission.');
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  const toggleNotifications = useCallback(async () => {
    if (isEnabled) {
      // Can't programmatically disable, just update state
      setIsEnabled(false);
      toast.info('Notifications disabled. You can re-enable them anytime.');
      return false;
    } else {
      return await requestPermission();
    }
  }, [isEnabled, requestPermission]);

  return {
    isSupported,
    permission,
    isEnabled,
    requestPermission,
    sendNotification,
    toggleNotifications,
  };
}
