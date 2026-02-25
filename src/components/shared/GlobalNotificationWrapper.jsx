// This component is no longer needed as notification provider is now in Layout
// Keeping for backwards compatibility but it's just a passthrough
import React from 'react';

export default function GlobalNotificationWrapper({ children }) {
  return <>{children}</>;
}