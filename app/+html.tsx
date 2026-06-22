import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// This file is web-only and defines the root HTML shell.
// It ensures that apple-touch-icon links and PWA meta tags are statically embedded 
// into every server-rendered or exported static web page.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Link the apple-touch-icon for iOS Safari */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        {/* iOS PWA compatibility meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Menama" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
