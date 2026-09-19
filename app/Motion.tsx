"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function Motion() {
  useEffect(() => {
    function scrollToHash() {
      if (!window.location.hash) return;
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    const frame = window.requestAnimationFrame(scrollToHash);
    window.addEventListener("hashchange", scrollToHash);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, []);

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

    gsap.to(".model-reveal", {
      opacity: 1,
      stagger: 0.18,
      ease: "none",
      scrollTrigger: {
        trigger: ".product-model-intro",
        start: "top 82%",
        end: "bottom 48%",
        scrub: true,
      },
    });

    gsap.utils.toArray<HTMLElement>(".integration-stage").forEach((stage, index) => {
      gsap.fromTo(stage,
        { y: 34 + index * 14, scale: 0.98, opacity: 0.86 },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: stage, start: "top 90%", end: "top 58%", scrub: true },
        },
      );
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
