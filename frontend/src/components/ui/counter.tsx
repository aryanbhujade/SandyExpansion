import { useEffect, useRef } from "react";
import { animate, useInView, useMotionValue } from "framer-motion";

/**
 * Counts up to `value` when scrolled into view. Animates an EXISTING
 * number — no new element, no color change. Renders a plain <span>.
 */
export function CountUp({
  value,
  duration = 1.2,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const outRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(wrapperRef, { once: true, margin: "-20px 0px -20px 0px" });
  const mv = useMotionValue(0);

  const render = (v: number) => {
    if (!outRef.current) return;
    const rounded = Math.round(v);
    const formatted = Number.isFinite(rounded) ? rounded.toLocaleString("en-US") : "0";
    outRef.current.textContent = `${prefix}${formatted}${suffix}`;
  };

  useEffect(() => {
    render(0);
    if (!inView) return;
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => render(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, duration]);

  return (
    <span ref={wrapperRef} className={className}>
      <span ref={outRef} />
    </span>
  );
}