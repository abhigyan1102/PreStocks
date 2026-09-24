"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function RadarMotion({ boardReady }: { boardReady: boolean }) {
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(".radar-hero-art img", { scale: 0.94 }, {
      scale: 1, ease: "none",
      scrollTrigger: { trigger: ".radar-hero-art", start: "top bottom", end: "bottom 45%", scrub: true },
    });
    gsap.utils.toArray<HTMLElement>(".how-card").forEach((card, index) => {
      gsap.fromTo(card, { y: 54 + index * 9, opacity: 0.25 }, {
        y: 0, opacity: 1, ease: "none",
        scrollTrigger: { trigger: card, start: "top 92%", end: "top 66%", scrub: true },
      });
    });
    if (boardReady && window.matchMedia("(min-width: 1101px)").matches) {
      ScrollTrigger.create({ trigger: ".board-list", pin: ".board-aside", pinSpacing: false, start: "top 110px", end: "bottom bottom" });
    }
  }, { dependencies: [boardReady], revertOnUpdate: true });
  return null;
}
