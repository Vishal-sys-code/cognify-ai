import { useState } from "react";
import { ChevronDown, ChevronUp, Highlighter } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export interface CoTStep {
  id: string;
  stepNumber: number;
  summary: string;
  fullText: string;
  tokenRange: [number, number];
}

interface CoTPanelProps {
  steps: CoTStep[];
  onHighlightTokens: (tokenRange: [number, number]) => void;
  isLoading: boolean;
}

export const CoTPanel = ({ steps, onHighlightTokens, isLoading }: CoTPanelProps) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 border border-dashed border-border rounded-lg">
        <p className="text-sm text-muted-foreground animate-pulse">
          Loading analysis...
        </p>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 border border-dashed border-border rounded-lg">
        <p className="text-sm text-muted-foreground">
          Chain-of-thought steps will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step) => {
        const isExpanded = expandedSteps.has(step.id);

        return (
          <div
            key={step.id}
            className="border border-border rounded-lg bg-card overflow-hidden transition-all duration-base animate-slide-up"
          >
            <button
              onClick={() => toggleStep(step.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/50 transition-colors"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  {step.stepNumber}
                </div>
                <span className="text-sm font-medium">{step.summary}</span>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.fullText}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onHighlightTokens(step.tokenRange)}
                  className="gap-2"
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  Highlight Tokens
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
