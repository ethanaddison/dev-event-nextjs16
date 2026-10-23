'use client';

import Image from "next/image";


const ExploreBtn = () => {
  return (
    <button type="button" id="explore-btn" className="mt-7 mx-auto" onClick={() => console.log("Click")}>
      <a href="#events">
        Explore Events
        <Image src="/icons/arrow-down.svg" alt="arrow-down" width={20} height={20} />
      </a>
    </button>
  )
}

export default ExploreBtn
