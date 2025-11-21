import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface Token {
  id: string;
  text: string;
  activation: number;
  probabilities: { token: string; prob: number }[];
  timestamp: number;
}

interface TokenTimelineProps {
  tokens: Token[];
  selectedTokenId: string | null;
  onTokenSelect: (tokenId: string) => void;
  isStreaming: boolean;
  isLoading: boolean;
}

export const TokenTimeline = ({
  tokens,
  selectedTokenId,
  onTokenSelect,
  isStreaming,
  isLoading,
}: TokenTimelineProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTokenCountRef = useRef(tokens.length);

  useEffect(() => {
    if (
      isStreaming &&
      scrollRef.current &&
      tokens.length > prevTokenCountRef.current
    ) {
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollWidth,
        behavior: "smooth",
      });
    }
    prevTokenCountRef.current = tokens.length;
  }, [tokens.length, isStreaming]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24 border border-dashed border-border rounded-lg">
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading analysis...
        </p>
      </div>
    );
  }
  
  if (tokens.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 border border-dashed border-border rounded-lg">
        <p className="text-sm text-muted-foreground">
          Tokens will appear here during generation
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="relative overflow-x-auto custom-scrollbar py-4"
      role="region"
      aria-label="Token timeline"
    >
      <div className="flex items-center gap-2 px-4 min-w-max">
        {tokens.map((token, index) => {
          const isSelected = token.id === selectedTokenId;
          const activationPercent = Math.min(token.activation * 100, 100);

          return (
            <button
              key={token.id}
              onClick={() => onTokenSelect(token.id)}
              className={cn(
                "group relative px-3 py-2 rounded-md font-mono text-[13px]",
                "transition-all duration-base",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md scale-105"
                  : "bg-token-bg hover:bg-token-hover",
                "animate-token-slide-in"
              )}
              aria-label={`Token ${index + 1}: ${token.text}`}
              title={`Activation: ${activationPercent.toFixed(1)}%\nTop prob: ${token.probabilities[0]?.token} (${(token.probabilities[0]?.prob * 100).toFixed(1)}%)`}
            >
              <span className="relative z-10">{token.text}</span>

              {/* Activation bar */}
              <div
                className={cn(
                  "absolute bottom-0 left-0 h-0.5 rounded-full transition-all duration-300",
                  isSelected ? "bg-primary-foreground/50" : "bg-primary/40"
                )}
                style={{ width: `${activationPercent}%` }}
              />

              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg text-xs whitespace-nowrap border border-border">
                  <div className="font-medium mb-1">
                    Activation: {activationPercent.toFixed(1)}%
                  </div>
                  <div className="space-y-0.5 text-muted-foreground">
                    {token.probabilities.slice(0, 3).map((prob, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="font-mono">{prob.token}</span>
                        <span>{(prob.prob * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};