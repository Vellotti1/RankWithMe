import { scoreColor } from "@/lib/mock-data";

type Props = {
  score: number;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
};

const sizeMap = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-2xl",
};

export function ScoreBadge({ score, size = "md", onClick }: Props) {
  const color = scoreColor(score);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`${sizeMap[size]} relative inline-flex items-center justify-center rounded-full font-bold tracking-tight transition-transform ${onClick ? "cursor-pointer hover:scale-105 active:scale-95" : "cursor-default"}`}
      style={{
        background: `radial-gradient(circle at 30% 30%, color-mix(in oklab, ${color} 30%, transparent), transparent 70%), color-mix(in oklab, ${color} 18%, var(--color-surface-elevated))`,
        color,
        boxShadow: `inset 0 0 0 2px color-mix(in oklab, ${color} 70%, transparent)`,
      }}
      aria-label={`Score ${score}`}
    >
      {score % 1 === 0 ? score : score.toFixed(1)}
    </button>
  );
}
