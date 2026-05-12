import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_DURATION = 30;

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecordingComplete, onReset, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "review">("idle");
  const [seconds, setSeconds] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  function startRecording() {
    if (disabled) return;
    chunksRef.current = [];
    setSeconds(0);
    secondsRef.current = 0;
    setState("recording");

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const recorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type ?? "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setPlaybackUrl(url);
        setState("review");
        onRecordingComplete(blob, secondsRef.current);
      };

      recorder.start(250);

      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_DURATION) {
          stopRecording();
        }
      }, 1000);
    }).catch(() => {
      setState("idle");
      setSeconds(0);
      secondsRef.current = 0;
    });
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function handleReset() {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    setPlaybackUrl(null);
    setAudioBlob(null);
    setSeconds(0);
    secondsRef.current = 0;
    setState("idle");
    setIsPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    onReset();
  }

  function togglePlayback() {
    if (!playbackUrl) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const audio = new Audio(playbackUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      audioRef.current = audio;
      setIsPlaying(true);
    }
  }

  const progress = (seconds / MAX_DURATION) * 100;

  return (
    <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
      {state === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary/10 py-4 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          <Mic className="h-5 w-5" />
          <span className="text-sm font-semibold">Tap to record</span>
        </button>
      )}

      {state === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-semibold text-red-500">Recording</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">{formatTime(seconds)} / {formatTime(MAX_DURATION)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-red-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 py-3 text-red-600 transition-colors hover:bg-red-500/20"
          >
            <Square className="h-4 w-4 fill-current" />
            <span className="text-sm font-semibold">Stop</span>
          </button>
        </div>
      )}

      {state === "review" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Recording ready</span>
            <span className="text-xs text-muted-foreground">{formatTime(seconds)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={togglePlayback} className="gap-1.5">
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Re-record
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function getSupportedMimeType(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}
