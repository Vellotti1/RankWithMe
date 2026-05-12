import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ScoreBadge } from "@/components/ScoreBadge";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { supabase, SUPABASE_URL, SUPABASE_KEY, callEdgeFunction } from "@/lib/supabase";
import { Pencil, Mic } from "lucide-react";
import { toast } from "sonner";

type ReviewMode = "text" | "voice";

interface ReviewFormProps {
  score: number;
  onScoreChange: (score: number) => void;
  text: string;
  onTextChange: (text: string) => void;
  reviewType: ReviewMode;
  onReviewTypeChange: (type: ReviewMode) => void;
  onSave: (data: {
    score: number;
    review_type: ReviewMode;
    text: string;
    voice_audio_url: string | null;
    voice_duration_seconds: number | null;
  }) => Promise<void>;
  saving: boolean;
  saveLabel?: string;
  textPlaceholder?: string;
  /** If provided, the existing voice audio URL for editing */
  existingVoiceUrl?: string | null;
  existingVoiceSummary?: string | null;
  existingVoiceDuration?: number | null;
  /** Title of the media being reviewed (for AI summary context) */
  mediaTitle?: string;
  /** media_type for AI summary context */
  mediaType?: "movie" | "show";
  /** Which table to update with voice summary */
  voiceSummaryTable?: string;
  voiceSummaryReviewId?: string;
  userId: string;
}

export function ReviewForm({
  score,
  onScoreChange,
  text,
  onTextChange,
  reviewType,
  onReviewTypeChange,
  onSave,
  saving,
  saveLabel = "Save review",
  textPlaceholder = "Write a review...",
  existingVoiceUrl,
  existingVoiceSummary,
  existingVoiceDuration,
  mediaTitle,
  mediaType,
  voiceSummaryTable,
  voiceSummaryReviewId,
  userId,
}: ReviewFormProps) {
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState<number | null>(existingVoiceDuration ?? null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(existingVoiceUrl ?? null);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  function handleRecordingComplete(blob: Blob, durationSeconds: number) {
    setVoiceBlob(blob);
    setVoiceDuration(durationSeconds);
  }

  function handleRecordingReset() {
    setVoiceBlob(null);
    setVoiceDuration(null);
    setVoiceAudioUrl(null);
  }

  async function handleSave() {
    if (reviewType === "voice" && !voiceBlob && !voiceAudioUrl) {
      toast.error("Please record a voice review first.");
      return;
    }
    if (reviewType === "text" && !text.trim()) {
      toast.error("Please write a review or switch to voice mode.");
      return;
    }

    setUploadingVoice(true);

    let audioUrl: string | null = voiceAudioUrl;

    // Upload voice recording if we have a new blob
    if (reviewType === "voice" && voiceBlob) {
      const ext = voiceBlob.type.includes("webm") ? "webm" : voiceBlob.type.includes("ogg") ? "ogg" : "mp4";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("review-voice-recordings")
        .upload(path, voiceBlob, { contentType: voiceBlob.type, upsert: true });

      if (uploadErr) {
        toast.error("Failed to upload voice recording.");
        setUploadingVoice(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("review-voice-recordings").getPublicUrl(path);
      audioUrl = urlData.publicUrl;
    }

    setUploadingVoice(false);

    await onSave({
      score,
      review_type: reviewType,
      text: reviewType === "text" ? text : "",
      voice_audio_url: reviewType === "voice" ? audioUrl : null,
      voice_duration_seconds: reviewType === "voice" ? voiceDuration : null,
    });

    // Trigger AI summary generation for voice reviews
    if (reviewType === "voice" && voiceSummaryTable && voiceSummaryReviewId) {
      callEdgeFunction("voice-summary", {
        review_id: voiceSummaryReviewId,
        table: voiceSummaryTable,
        user_id: userId,
        title: mediaTitle ?? "",
        media_type: mediaType ?? "movie",
        duration_seconds: voiceDuration ?? 0,
      }).catch(() => {});
    }
  }

  const isSaving = saving || uploadingVoice;

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Your score</p>
        <ScoreBadge score={score} size="lg" />
      </div>
      <Slider value={[score]} onValueChange={(v) => onScoreChange(v[0])} min={0} max={100} step={1} />
      <div className="flex justify-between text-xs text-muted-foreground"><span>0</span><span>50</span><span>100</span></div>

      {/* Review type toggle */}
      <div className="flex rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => onReviewTypeChange("text")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${reviewType === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          Write Review
        </button>
        <button
          type="button"
          onClick={() => { onReviewTypeChange("voice"); onTextChange(""); }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${reviewType === "voice" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Mic className="h-3.5 w-3.5" />
          Voice Review
        </button>
      </div>

      {/* Text or Voice input */}
      {reviewType === "text" ? (
        <Textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={textPlaceholder}
          className="resize-none bg-background"
          rows={4}
        />
      ) : (
        <div className="space-y-2">
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            onReset={handleRecordingReset}
            disabled={saving}
          />
          {voiceAudioUrl && !voiceBlob && (
            <div className="rounded-xl border border-border bg-background p-3">
              <audio controls className="w-full h-8" src={voiceAudioUrl} />
              {existingVoiceSummary && (
                <p className="mt-2 text-xs text-muted-foreground italic">{existingVoiceSummary}</p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">Max 30 seconds. Speak clearly!</p>
        </div>
      )}

      <Button className="w-full" onClick={handleSave} disabled={isSaving}>
        {uploadingVoice ? "Uploading voice..." : saving ? "Saving..." : saveLabel}
      </Button>
    </div>
  );
}
