"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function RadarMotion() {
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(".how-word", {
      opacity: 1,
      stagger: 0.12,
      ease: "none",
      scrollTrigger: { trigger: ".how-intro", start: "top 82%", end: "bottom 42%", scrub: true },
    });
    gsap.utils.toArray<HTMLElement>(".how-card").forEach((card, index) => {
      gsap.fromTo(card, { y: 58 + index * 12, scale: 0.94, opacity: 0.45 }, {
        y: 0, scale: 1, opacity: 1, ease: "none",
        scrollTrigger: { trigger: card, start: "top 92%", end: "top 61%", scrub: true },
      });
    });
  });
  return null;
}
