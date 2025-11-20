import { useState } from "react";
import { Button } from "./ui/button";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

interface SessionShareProps {
  sessionId: string;
}

export const SessionShare = ({ sessionId }: SessionShareProps) => {
  const [copied, setCopied] = useState(false);

  const generateShareLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/session/${sessionId}`;
  };

  const handleShare = async () => {
    const shareLink = generateShareLink();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Cognify.AI Session",
          text: "Check out this analysis session!",
          url: shareLink,
        });
        toast.success("Session shared successfully!");
      } catch (error) {
        console.error("Error sharing session:", error);
        toast.error("Failed to share session");
      }
    } else {
      // Fallback for browsers that don't support the Share API
      try {
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error("Failed to copy link");
      }
    }
  };

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Share Session</h3>
        <p className="text-xs text-muted-foreground">
          Share a link to this analysis session.
        </p>
      </div>

      <Button
        onClick={handleShare}
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
            <Share2 className="w-4 h-4" />
            Share Session
          </>
        )}
      </Button>
    </div>
  );
};