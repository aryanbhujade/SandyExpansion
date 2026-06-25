import type { Variants, Transition } from "framer-motion";

/* Easing curves — exponential ease-outs, never bounce/elastic. */
type Bezier = [number, number, number, number];
export const EASE_OUT_QUART: Bezier = [0.25, 1, 0.5, 1];
export const EASE_OUT_QUINT: Bezier = [0.22, 1, 0.36, 1];
export const EASE_OUT_EXPO: Bezier = [0.16, 1, 0.3, 1];

/* Spring presets. mass kept low for snappy, physical feedback. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 24,
  mass: 0.8,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 28,
  mass: 0.6,
};

export const springGentle: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 22,
  mass: 1,
};

/* Staggered container + rising item — used for grids, lists, sections. */
export const staggerContainer = (stagger = 0.07, delayChildren = 0.05): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const itemRise: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT_QUART },
  },
};

export const itemRiseSoft: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT_QUART },
  },
};

/* Route crossfade/slide — used by AnimatePresence in App. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: EASE_OUT_QUART },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.18, ease: EASE_OUT_QUART },
  },
};

/* Shared viewport config for scroll-triggered reveals. */
export const viewportOnce = { once: true, margin: "-40px 0px -40px 0px" } as const;