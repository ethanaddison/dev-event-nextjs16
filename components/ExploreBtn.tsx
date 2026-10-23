'use client';

import Image from "next/image";
import { posthogLogs } from "@/lib/posthog-logs";
import posthog from "posthog-js";

const ExploreBtn = () => {
  const handleExploreEvents = () => {
    posthog.capture("event_explorer_opened")
    posthogLogs.eventExplorerOpened()
  }

  return (
    <button type="button" id="explore-btn" className="mt-7 mx-auto" onClick={handleExploreEvents}>
      <a href="#events">
        Explore Events
        <Image src="/icons/arrow-down.svg" alt="arrow-down" width={20} height={20} />
      </a>
    </button>
  )
}

export default ExploreBtn
