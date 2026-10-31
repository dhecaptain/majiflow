"use client";

import { Download } from "lucide-react";
import { usePwaInstall } from "@/lib/pwa-install";
import { useToast } from "@/components/ui/toast";

function installInstructions() {
  const isAppleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return isAppleMobile
    ? "In Safari, tap Share, then choose Add to Home Screen."
    : "Open your browser menu and choose Install app or Add to Home screen.";
}

export function AppDownload() {
  const { canInstall, installed, install } = usePwaInstall();
  const { toast } = useToast();

  const onInstall = async () => {
    if (installed) return;

    if (!canInstall) {
      toast({
        kind: "info",
        title: "Install MajiFlow",
        message: installInstructions(),
      });
      return;
    }

    try {
      await install();
    } catch {
      toast({
        kind: "info",
        title: "Install MajiFlow",
        message: installInstructions(),
      });
    }
  };

  return (
    <section className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-border sm:px-10">
        <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
          {installed ? "MajiFlow is installed" : "Install MajiFlow"}
        </h2>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
          Add the MajiFlow web app to your home screen for quick, app-like access.
        </p>
        <button
          type="button"
          onClick={() => void onInstall()}
          disabled={installed}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-foreground px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60"
        >
          <Download className="size-4" aria-hidden />
          {installed ? "Already installed" : canInstall ? "Install MajiFlow" : "How to install"}
        </button>
      </div>
    </section>
  );
}
