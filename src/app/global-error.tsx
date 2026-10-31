'use client';

import './globals.css';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';

/** Last-resort error page: replaces the root layout, so it brings its own document and styles. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <Container className="flex min-h-screen flex-col items-center justify-center gap-4 py-24 text-center">
          <h1 className="font-display text-3xl">Something went wrong</h1>
          <p className="text-muted-foreground">
            Sorry - MajiFlow hit an unexpected problem. Your cart and orders are safe.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => reset()}>Try again</Button>
            {/* A full reload, not client navigation: the app itself just failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium">
              Go to the home page
            </a>
          </div>
        </Container>
      </body>
    </html>
  );
}
