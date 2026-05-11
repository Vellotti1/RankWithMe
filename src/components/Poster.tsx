import type { MediaItem } from "@/lib/mock-data";
import { Film, Tv, Clapperboard, PlaySquare } from "lucide-react";

const typeIcon = {
  movie: Film,
  show: Tv,
  season: Clapperboard,
  episode: PlaySquare,
};

export function Poster({
  item,
  className = "",
  ratio = "2/3",
}: {
  item: { title: string; poster: string; type?: MediaItem["type"] };
  className?: string;
  ratio?: string;
}) {
  const Icon = item.type ? typeIcon[item.type] : Film;
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{ aspectRatio: ratio, background: item.poster }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <Icon className="absolute right-2 top-2 h-4 w-4 text-white/70" />
      <div className="absolute inset-x-0 bottom-0 p-2">
        <p className="line-clamp-2 text-sm font-bold leading-tight text-white drop-shadow">
          {item.title}
        </p>
      </div>
    </div>
  );
}
