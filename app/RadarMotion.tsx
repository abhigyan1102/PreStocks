"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function RadarMotion() {
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".radar-illustration", { scale: .8 }, { scale: 1, duration: 1.4, ease: "power2.out" });
      gsap.fromTo(".radar-illustration", { opacity: 1 }, { opacity: .2, immediateRender: false, ease: "none", scrollTrigger: { trigger: ".radar-illustration", start: "center top", end: "bottom top", scrub: true } });
      gsap.utils.toArray<HTMLElement>(".how-steps li").forEach((step) => {
        gsap.fromTo(step, { opacity: .4 }, { opacity: 1, ease: "none", scrollTrigger: { trigger: step, start: "top 92%", end: "top 70%", scrub: true } });
      });
    });
    return () => media.revert();
  });
  return null;
}
