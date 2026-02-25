import React, { useEffect, useCallback, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";

/**
 * PresenceManager - Tracks user presence and activity
 * Automatically updates user status based on activity
 */
export default function PresenceManager({ user }) {
  const lastActivityRef = useRef(Date.now());
  const updateIntervalRef = useRef(null);
  const activityListenersRef = useRef([]);

  // Activity threshold times (in milliseconds)
  const AWAY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  const OFFLINE_THRESHOLD = 15 * 60 * 1000; // 15 minutes
  const UPDATE_INTERVAL = 30 * 1000; // Update every 30 seconds

  const updatePresence = useCallback(async (status) => {
    if (!user) return;

    try {
      await groonabackend.auth.updateMe({
        presence_status: status,
        last_seen: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }, [user]);

  const checkActivity = useCallback(() => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;

    if (timeSinceActivity > OFFLINE_THRESHOLD) {
      updatePresence('offline');
    } else if (timeSinceActivity > AWAY_THRESHOLD) {
      updatePresence('away');
    } else {
      updatePresence('online');
    }
  }, [updatePresence, AWAY_THRESHOLD, OFFLINE_THRESHOLD]);

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Set initial status to online
    updatePresence('online');

    // Activity events to track
    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
      activityListenersRef.current.push({ event, handler: handleActivity });
    });

    // Set up periodic status check
    updateIntervalRef.current = setInterval(checkActivity, UPDATE_INTERVAL);

    // Handle page visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('away');
      } else {
        lastActivityRef.current = Date.now();
        updatePresence('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle beforeunload (user leaving page)
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline status update
      const data = JSON.stringify({
        presence_status: 'offline',
        last_seen: new Date().toISOString(),
      });
      
      // Note: This is a simplified version. In production, you'd use a proper API endpoint
      updatePresence('offline');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      // Remove all event listeners
      activityListenersRef.current.forEach(({ event, handler }) => {
        window.removeEventListener(event, handler);
      });

      // Clear interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }

      // Remove other listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Set status to offline on unmount
      updatePresence('offline');
    };
  }, [user, updatePresence, checkActivity, handleActivity, UPDATE_INTERVAL]);

  // This component doesn't render anything
  return null;
}

