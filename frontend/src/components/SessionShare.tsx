import { useState } from "react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

interface SessionShareProps {
  sessionId: string;
}

export const SessionShare = ({ sessionId }: SessionShareProps) => {
  const [isPrivate, setIsPrivate] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateShareLink = () => {
    const baseUrl = window.location.origin;
    const expiryParam = isPrivate ? "?expire=24h" : "";
    return `${baseUrl}/session/${sessionId}${expiryParam}`;
  };

  const handleCopyLink = async () => {
    const link = generateShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Share Session</h3>
        <p className="text-xs text-muted-foreground">
          Generate a shareable link to this analysis session
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="private-link"
          checked={isPrivate}
          onCheckedChange={(checked) => setIsPrivate(checked as boolean)}
        />
        <Label
          htmlFor="private-link"
          className="text-sm font-normal cursor-pointer"
        >
          Private link (expires in 24h)
        </Label>
      </div>

      <Button
        onClick={handleCopyLink}
        className="w-full gap-2"
        variant={copied ? "secondary" : "default"}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4" />
            Copy Share Link
          </>
        )}
      </Button>

      {sessionId && (
        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono break-all text-muted-foreground">
          {generateShareLink()}
        </div>
      )}
    </div>
  );
};
