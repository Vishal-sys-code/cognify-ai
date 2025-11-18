// src/components/AnimatedBackground.tsx
import React from "react";

export const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden bg-background">
      <div className="absolute w-full h-full bg-grid-pattern opacity-[0.03] pointer-events-none" />
      <div className="absolute inset-0 w-full h-full bg-radial-gradient pointer-events-none" />
      <div className="relative w-full h-full">
        <div className="absolute bottom-[-10%] left-[-18%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_farthest-side,hsla(214,98%,57%,0.06),rgba(255,255,255,0))] animate-float" />
        <div className="absolute top-[-12%] right-[-18%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_farthest-side,hsla(214,98%,57%,0.04),rgba(255,255,255,0))] animate-float-slow" />
      </div>
    </div>
  );
};