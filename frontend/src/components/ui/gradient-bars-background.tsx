import React from 'react';
import { motion } from 'framer-motion';

interface GradientBarsProps {
  numBars?: number;
  gradientFrom?: string;
  gradientTo?: string;
  animationDuration?: number;
  className?: string;
}

const GradientBars: React.FC<GradientBarsProps> = ({
  numBars = 15,
  gradientFrom = 'rgba(52, 211, 153, 0.4)',
  gradientTo = 'transparent',
  animationDuration = 2,
  className = '',
}) => {
  const calculateHeight = (index: number, total: number) => {
    const position = index / (total - 1);
    const maxHeight = 100;
    const minHeight = 30;
    
    const center = 0.5;
    const distanceFromCenter = Math.abs(position - center);
    const heightPercentage = Math.pow(distanceFromCenter * 2, 1.2);
    
    return minHeight + (maxHeight - minHeight) * heightPercentage;
  };

  return (
    <div className={`absolute inset-0 z-0 overflow-hidden ${className}`}>
      <div 
        className="flex h-full items-end"
        style={{
          width: '100%',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {Array.from({ length: numBars }).map((_, index) => {
          const baseScale = calculateHeight(index, numBars) / 100;
          return (
            <motion.div
              key={index}
              initial={{ scaleY: baseScale }}
              animate={{ scaleY: baseScale * 0.6 }}
              transition={{
                duration: animationDuration,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "reverse",
                delay: index * 0.15, // Staggered wave effect
              }}
              style={{
                flex: `1 0 calc(100% / ${numBars})`,
                maxWidth: `calc(100% / ${numBars})`,
                height: '100%',
                background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
                transformOrigin: 'bottom',
                outline: '1px solid rgba(0, 0, 0, 0)',
                boxSizing: 'border-box',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

interface ComponentProps {
  numBars?: number;
  gradientFrom?: string;
  gradientTo?: string;
  animationDuration?: number;
  backgroundColor?: string;
  children?: React.ReactNode;
}

export default function GradientBarsBackground({
  numBars = 11,
  gradientFrom = 'rgba(52, 211, 153, 0.4)',
  gradientTo = 'transparent',
  animationDuration = 3,
  backgroundColor = 'rgb(0, 0, 0)', // Matching the black theme
  children,
}: ComponentProps) {
  return (
    <section 
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor }}
    >
      <GradientBars
        numBars={numBars}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
        animationDuration={animationDuration}
      />
      
      {children && (
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-4">
          {children}
        </div>
      )}
    </section>
  );
}

export { GradientBarsBackground };
