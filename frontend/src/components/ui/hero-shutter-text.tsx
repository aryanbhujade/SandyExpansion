"use client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface HeroTextProps {
  text?: string;
  className?: string;
  textClassName?: string;
}

export default function HeroText({
  text = "IMMERSE",
  className = "",
  textClassName = "text-5xl md:text-7xl lg:text-8xl",
}: HeroTextProps) {
  const count = 0;
  // Split by words to allow natural wrapping, then map characters within words
  const words = text.split(" ");

  return (
    <div
      className={`relative flex flex-col items-start justify-center w-full transition-colors duration-700 ${className}`}
    >
      {/* Main Text Container */}
      <div className="relative z-10 w-full flex flex-col items-start">
        <AnimatePresence mode="wait">
          <motion.div
            key={count}
            className="flex flex-wrap justify-start items-center w-full gap-x-3 md:gap-x-4 gap-y-2 md:gap-y-4"
          >
            {words.map((word, wordIndex) => (
              <div key={wordIndex} className="flex flex-nowrap">
                {word.split("").map((char, i) => {
                  const delayBase = (wordIndex * word.length + i) * 0.03;
                  return (
                    <div
                      key={i}
                      className="relative overflow-hidden group flex items-center justify-center py-4 -my-4 px-1"
                    >
                      {/* Main Character */}
                      <motion.span
                        initial={{ opacity: 0, filter: "blur(10px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        transition={{ delay: delayBase + 0.3, duration: 0.8 }}
                        className={cn(
                          "leading-[1.1] font-black text-white tracking-tighter drop-shadow-[0_0_1px_rgba(255,255,255,0.8)]",
                          textClassName
                        )}
                      >
                        {char}
                      </motion.span>

                      {/* Top Slice Layer */}
                      <motion.span
                        initial={{ x: "-100%", opacity: 0 }}
                        animate={{ x: "100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.7,
                          delay: delayBase,
                          ease: "easeInOut",
                        }}
                        className={cn(
                          "absolute inset-0 leading-[1.1] font-black text-emerald-400 z-10 pointer-events-none drop-shadow-md",
                          textClassName
                        )}
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 35%, 0 35%)" }}
                      >
                        {char}
                      </motion.span>

                      {/* Middle Slice Layer */}
                      <motion.span
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: "-100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.7,
                          delay: delayBase + 0.1,
                          ease: "easeInOut",
                        }}
                        className={cn(
                          "absolute inset-0 leading-[1.1] font-black text-emerald-200 z-10 pointer-events-none drop-shadow-md",
                          textClassName
                        )}
                        style={{
                          clipPath: "polygon(0 35%, 100% 35%, 100% 65%, 0 65%)",
                        }}
                      >
                        {char}
                      </motion.span>

                      {/* Bottom Slice Layer */}
                      <motion.span
                        initial={{ x: "-100%", opacity: 0 }}
                        animate={{ x: "100%", opacity: [0, 1, 0] }}
                        transition={{
                          duration: 0.7,
                          delay: delayBase + 0.2,
                          ease: "easeInOut",
                        }}
                        className={cn(
                          "absolute inset-0 leading-[1.1] font-black text-emerald-400 z-10 pointer-events-none drop-shadow-md",
                          textClassName
                        )}
                        style={{
                          clipPath: "polygon(0 65%, 100% 65%, 100% 100%, 0 100%)",
                        }}
                      >
                        {char}
                      </motion.span>
                    </div>
                  );
                })}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
