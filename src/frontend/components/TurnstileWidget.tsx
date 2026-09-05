/**
 * Cloudflare Turnstile React Widget
 * Dynamically loads Turnstile script and renders explicit dark-themed Turnstile widget.
 */

import React, { useEffect, useRef, useState } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (err: any) => void;
  siteKey?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          callback?: (token: string) => void;
          'error-callback'?: (err: any) => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

// Cloudflare Turnstile Site Key (loaded from VITE_TURNSTILE_SITE_KEY env)
const DEFAULT_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onVerify,
  onExpire,
  onError,
  siteKey = DEFAULT_SITE_KEY,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(() => typeof window !== 'undefined' && !!window.turnstile);

  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  }, [onVerify, onExpire, onError]);

  // Script Loader with Polling Fallback to handle script tag race conditions
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.turnstile) {
      setIsLoaded(true);
      return;
    }

    let intervalId: any = null;

    const checkLoaded = () => {
      if (window.turnstile) {
        setIsLoaded(true);
        if (intervalId) clearInterval(intervalId);
      }
    };

    window.onTurnstileLoaded = () => {
      setIsLoaded(true);
      if (intervalId) clearInterval(intervalId);
    };

    const existingScript = document.getElementById('cf-turnstile-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'cf-turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoaded&render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Polling fallback every 150ms in case script already loaded or onload fired early
    intervalId = setInterval(checkLoaded, 150);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Render Turnstile Widget
  useEffect(() => {
    if (!isLoaded || !window.turnstile || !containerRef.current) return;

    // If widget was previously rendered, clean it up before rendering again
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {}
      widgetIdRef.current = null;
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token: string) => {
          if (onVerifyRef.current) onVerifyRef.current(token);
        },
        'expired-callback': () => {
          if (onExpireRef.current) onExpireRef.current();
        },
        'error-callback': (err: any) => {
          if (onErrorRef.current) onErrorRef.current(err);
        },
      });
    } catch (err) {
      console.warn('Turnstile render warning:', err);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [isLoaded, siteKey]);

  return (
    <div className="w-full flex flex-col items-center justify-center my-4 min-h-[65px]">
      <div ref={containerRef} className="cf-turnstile min-h-[65px]" />
      {!isLoaded && (
        <span className="font-space-mono text-[11px] text-[#cdc5bd] animate-pulse">
          Loading security check...
        </span>
      )}
    </div>
  );
};
