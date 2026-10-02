import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy path from the original shell → AI Library lives at /ai-library.
export const Route = createFileRoute("/library")({
  beforeLoad: () => {
    throw redirect({ to: "/ai-library" });
  },
});
