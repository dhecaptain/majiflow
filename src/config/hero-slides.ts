import type { StaticImageData } from "next/image";
import waterCansBg from "@/assets/images/hero/water-cans-bg.webp";
import waterGlass from "@/assets/images/business/aqua-spring-kisumu.webp";
import clearWater from "@/assets/images/business/pure-blue-nakuru.webp";
import waterDrop from "@/assets/images/backdrops/water-liquid.webp";

export interface HeroSlide {
  id: string;
  eyebrow: string;
  headline: string;
  body: string;
  image: StaticImageData;
  alt: string;
}

export const HERO_WASH =
  "linear-gradient(90deg, rgba(2,18,40,0.72) 0%, rgba(2,18,40,0.45) 55%, rgba(2,18,40,0.22) 100%)";

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "fresh-water",
    eyebrow: "MajiFlow",
    headline: "Fresh water, just a tap away.",
    body: "Order clean water from refill stations near you and get it delivered to your door.",
    image: waterGlass,
    alt: "Fresh water being poured into a glass",
  },
  {
    id: "majiflow-door",
    eyebrow: "Delivered",
    headline: "Majiflow, straight to your door.",
    body: "Fast, reliable doorstep delivery across Nairobi and beyond.",
    image: waterCansBg,
    alt: "Refill containers ready to be delivered",
  },
  {
    id: "nearby-refill",
    eyebrow: "Nearby",
    headline: "Your next refill is close by.",
    body: "Find trusted local stations, compare options, and order from your phone.",
    image: clearWater,
    alt: "Clear blue water rippling in the light",
  },
  {
    id: "pure-easy",
    eyebrow: "Pure & easy",
    headline: "Pure water, the easy way.",
    body: "Affordable refills from trusted local stations, paid your way.",
    image: waterDrop,
    alt: "A clear drop falling into rippling water",
  },
];

export const HERO_SLIDE_INTERVAL = 3000;
