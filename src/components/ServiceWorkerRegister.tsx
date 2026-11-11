"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[Hanazo PWA] Service worker registered with scope:", registration.scope);
        })
        .catch((error) => {
          console.warn("[Hanazo PWA] Service worker registration failed:", error);
        });
    }
  }, []);

  return null;
}

