import { createFileRoute } from "@tanstack/react-router";

const TITLE = "TRAFFIC RUSH — Endless Traffic Dodging Arcade Game";
const DESCRIPTION =
  "Weave through four lanes of highway traffic, chain near misses for huge combos and beat your best score in this fast top-down arcade game.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      <h1 className="sr-only">Traffic Rush — endless traffic dodging arcade game</h1>
      <iframe
        src="/game/index.html"
        title="Traffic Rush game"
        className="h-full w-full border-0"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </main>
  );
}
