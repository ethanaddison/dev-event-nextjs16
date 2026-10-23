import posthog from "posthog-js";

const logSource = "event_catalog";

export const posthogLogs = {
  eventExplorerOpened() {
    posthog.captureLog({
      body: "Event explorer opened",
      level: "info",
      attributes: { source: logSource },
    });
  },
  eventCardSelected(eventSlug: string) {
    posthog.captureLog({
      body: "Event card selected",
      level: "info",
      attributes: { source: logSource, event_slug: eventSlug },
    });
  },
};
