"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function Motion() {
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.to(".reveal-word", {
      opacity: 1,
      stagger: 0.12,
      ease: "none",
      scrollTrigger: {
        trigger: ".developer-heading",
        start: "top 85%",
        end: "bottom 45%",
        scrub: true,
      },
    });

    gsap.utils.toArray<HTMLElement>(".source-card").forEach((card, index) => {
      gsap.fromTo(card,
        { y: 55 + index * 12, scale: 0.94, opacity: 0.65 },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: ".source-ledger", start: "top 85%", end: "bottom 55%", scrub: true },
        },
      );
    });
  });
  return null;
}
