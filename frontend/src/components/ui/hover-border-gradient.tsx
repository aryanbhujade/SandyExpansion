"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type HoverBorderGradientProps = React.PropsWithChildren<
  React.HTMLAttributes<HTMLElement> & {
    containerClassName?: string;
    as?: React.ElementType;
  }
>;

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  onClick,
  ...props
}: HoverBorderGradientProps) {
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "group relative flex rounded-full bg-black/10 backdrop-blur-xl transition duration-500 overflow-hidden items-center justify-center p-[2px] cursor-pointer",
        containerClassName
      )}
      {...props}
    >
      <div
        className={cn(
          "relative z-10 flex items-center justify-center bg-black/80 hover:bg-transparent px-8 py-3 rounded-[inherit] w-full text-white font-medium transition duration-500",
          className
        )}
      >
        {children}
      </div>
      
      <motion.div
        className="absolute inset-[-100%] z-0 bg-[conic-gradient(from_90deg_at_50%_50%,#000000_0%,#34d399_50%,#000000_100%)] opacity-30 group-hover:opacity-100 transition-opacity duration-500"
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          repeat: Infinity,
          duration: 3,
          ease: "linear",
        }}
      />
    </Tag>
  );
}
