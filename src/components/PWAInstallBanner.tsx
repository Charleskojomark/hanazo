"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if dismissed previously
    const dismissed = localStorage.getItem("hanazo_pwa_dismissed");
    if (dismissed === "true") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setShowBanner(false);
    localStorage.setItem("hanazo_pwa_dismissed", "true");
  }

  if (!showBanner || !deferredPrompt) return null;

  return (
    <aside
      aria-label="App installation notice"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl border border-amber-900/60 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-sm sm:left-auto"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
          <Download className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-white text-balance">
            Install Hanazo App
          </h4>
          <p className="mt-0.5 text-[11px] text-neutral-400 text-pretty">
            Install on your mobile or barcode scanner device for 100% offline sorting and instant launch.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 transition-colors"
            >
              Install App
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white"
            >
              Not Now
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Close install banner"
          className="size-6 rounded flex items-center justify-center text-neutral-500 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </aside>
  );
}

