import { useState } from "react";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Loader2, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptEditorProps {
  onRun: (prompt: string, enableCoT: boolean) => void;
  isRunning: boolean;
  onCancel: () => void;
}

export const PromptEditor = ({
  onRun,
  isRunning,
  onCancel,
}: PromptEditorProps) => {
  const [prompt, setPrompt] = useState("");
  const [enableCoT, setEnableCoT] = useState(true);
  const [error, setError] = useState("");

  const estimatedTokens = Math.ceil(prompt.length / 4);
  const maxTokens = 2048;
  const isOverLimit = estimatedTokens > maxTokens;

  const handleRun = () => {
    if (prompt.trim().length === 0) {
      setError("Please enter a prompt");
      return;
    }
    if (isOverLimit) {
      setError(`Prompt exceeds ${maxTokens} token limit`);
      return;
    }
    setError("");
    onRun(prompt, enableCoT);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setError("");
            }}
            placeholder=" "
            className={cn(
              "min-h-[120px] max-h-[600px] resize-y font-sans text-base transition-all",
              "bg-transparent backdrop-blur-sm focus:ring-2 focus:ring-primary focus:ring-offset-2",
              "peer",
              error && "border-destructive focus:ring-destructive"
            )}
            disabled={isRunning}
          />
          <Label
            htmlFor="prompt"
            className={cn("absolute left-4 top-4 text-muted-foreground transition-all duration-300 pointer-events-none",
            "peer-placeholder-shown:top-4 peer-placeholder-shown:text-base",
            "peer-focus:-top-3 peer-focus:left-2 peer-focus:text-sm peer-focus:bg-background peer-focus:px-1 peer-focus:text-primary",
            "text-sm -top-3 left-2 bg-background px-1 text-primary")}
          >
            Enter your prompt to analyze model behavior...
          </Label>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="cot"
                checked={enableCoT}
                onCheckedChange={(checked) => setEnableCoT(checked as boolean)}
                disabled={isRunning}
              />
              <Label
                htmlFor="cot"
                className="text-sm font-normal text-muted-foreground cursor-pointer"
              >
                Enable Chain-of-Thought
              </Label>
            </div>
          </div>
          <span
            className={cn(
              "text-muted-foreground",
              isOverLimit && "text-destructive font-medium"
            )}
          >
            ~{estimatedTokens} / {maxTokens} tokens
          </span>
        </div>
        {error && (
          <p className="text-sm text-destructive animate-slide-up">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {!isRunning ? (
          <Button
            onClick={handleRun}
            className="gap-2 hover-scale shadow-sm hover:shadow-glow"
            disabled={isRunning}
          >
            <Play className="w-4 h-4" />
            Run Analysis
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              className="gap-2 animate-pulse-glow"
              disabled
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Streaming
            </Button>
            <Button variant="outline" onClick={onCancel} className="gap-2">
              <Square className="w-4 h-4" />
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
};