import { useState } from "react";
import { Mic, Volume2 } from "lucide-react";

interface VoiceReviewPlayerProps {
  audioUrl: string;
  summary?: string | null;
  duration?: number | null;
}

export function VoiceReviewPlayer({ audioUrl, summary, duration }: VoiceReviewPlayerProps) {
  const [summaryLoading, setSummaryLoading] = useState(!summary && !!audioUrl);

  // If no summary yet, show loading state briefly then hide
  // (summary is generated async by edge function)
  if (summaryLoading && !summary) {
    setTimeout(() => setSummaryLoading(false), 5000);
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
        <Mic className="h-3.5 w-3.5 shrink-0 text-primary" />
        <audio controls className="h-7 flex-1" src={audioUrl} preload="metadata" />
        {duration != null && (
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{duration}s</span>
        )}
      </div>
      {summary && (
        <p className="text-xs text-muted-foreground italic pl-1">{summary}</p>
      )}
      {summaryLoading && !summary && (
        <p className="text-xs text-muted-foreground animate-pulse pl-1">Generating summary...</p>
      )}
    </div>
  );
}
