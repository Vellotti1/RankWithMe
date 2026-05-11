export type Member = {
  id: string;
  name: string;
  avatarColor: string;
};

export type Review = {
  memberId: string;
  rating: number; // 0 - 100
  text: string;
};

export type MediaType = "movie" | "show" | "season" | "episode";

export type MediaItem = {
  id: string;
  title: string;
  subtitle?: string;
  type: MediaType;
  year: number;
  description: string;
  poster: string; // gradient string
  reviews: Review[];
};

export type Recommendation = {
  id: string;
  title: string;
  year: number;
  description: string;
  poster: string;
  reason: string;
};

export const MEMBERS: Member[] = [
  { id: "jack", name: "Jack", avatarColor: "oklch(0.7 0.18 30)" },
  { id: "alex", name: "Alex", avatarColor: "oklch(0.7 0.18 220)" },
  { id: "mia", name: "Mia", avatarColor: "oklch(0.72 0.18 320)" },
  { id: "sam", name: "Sam", avatarColor: "oklch(0.78 0.17 145)" },
];

export const GROUP = {
  name: "Movie Night Crew",
  inviteCode: "MNC-7421",
  members: MEMBERS,
};

const poster = (a: string, b: string) =>
  `linear-gradient(135deg, ${a}, ${b})`;

export const ITEMS: MediaItem[] = [
  {
    id: "dark-knight",
    title: "The Dark Knight",
    type: "movie",
    year: 2008,
    description:
      "Batman faces a new menace in the chaotic Joker, testing the limits of justice in Gotham.",
    poster: poster("oklch(0.3 0.04 270)", "oklch(0.5 0.15 60)"),
    reviews: [
      { memberId: "jack", rating: 100, text: "Great pacing, strong characters, and one of the best endings." },
      { memberId: "alex", rating: 90, text: "Heath Ledger is unmatched. A near-perfect crime epic." },
      { memberId: "mia", rating: 85, text: "Loved it overall, but the third act gets a bit busy." },
      { memberId: "sam", rating: 95, text: "Re-watchable forever. The interrogation scene alone is worth it." },
    ],
  },
  {
    id: "interstellar",
    title: "Interstellar",
    type: "movie",
    year: 2014,
    description:
      "A team of explorers travels through a wormhole in space in an attempt to save humanity.",
    poster: poster("oklch(0.25 0.04 240)", "oklch(0.7 0.15 70)"),
    reviews: [
      { memberId: "jack", rating: 92, text: "Cooper and Murph wreck me every time." },
      { memberId: "alex", rating: 88, text: "Score + visuals carry it past the rough exposition." },
      { memberId: "mia", rating: 80, text: "Beautiful, but the science talk slows the middle." },
      { memberId: "sam", rating: 94, text: "Docking scene is cinema. No notes." },
    ],
  },
  {
    id: "breaking-bad-s1",
    title: "Breaking Bad",
    subtitle: "Season 1",
    type: "season",
    year: 2008,
    description:
      "A high school chemistry teacher turns to making meth after a life-changing diagnosis.",
    poster: poster("oklch(0.35 0.06 145)", "oklch(0.25 0.04 60)"),
    reviews: [
      { memberId: "jack", rating: 86, text: "Slow burn but every episode lands." },
      { memberId: "alex", rating: 90, text: "Best pilot of the 2000s, no contest." },
      { memberId: "mia", rating: 78, text: "Took me a few episodes to get hooked." },
      { memberId: "sam", rating: 88, text: "Walt's transformation starts here. Iconic." },
    ],
  },
  {
    id: "tlou-e1",
    title: "The Last of Us",
    subtitle: "Episode 1 — When You're Lost in the Darkness",
    type: "episode",
    year: 2023,
    description:
      "The outbreak begins. Joel's life is shattered, setting the stage for a 20-year journey.",
    poster: poster("oklch(0.28 0.04 30)", "oklch(0.45 0.1 145)"),
    reviews: [
      { memberId: "jack", rating: 95, text: "Opening 20 minutes are devastating." },
      { memberId: "alex", rating: 92, text: "Faithful adaptation done with real care." },
      { memberId: "mia", rating: 90, text: "Pedro Pascal nails the grief immediately." },
      { memberId: "sam", rating: 88, text: "Strong setup, can't wait for the rest." },
    ],
  },
  {
    id: "spiderverse",
    title: "Spider-Man: Into the Spider-Verse",
    type: "movie",
    year: 2018,
    description:
      "Miles Morales becomes Spider-Man and teams up with Spider-People from other dimensions.",
    poster: poster("oklch(0.45 0.18 320)", "oklch(0.55 0.2 30)"),
    reviews: [
      { memberId: "jack", rating: 96, text: "Every frame is a poster. A genre reset." },
      { memberId: "alex", rating: 93, text: "Animation peak. Soundtrack slaps." },
      { memberId: "mia", rating: 95, text: "Made me care about Miles in 10 minutes." },
      { memberId: "sam", rating: 90, text: "Fun, fresh, and emotional. Loved it." },
    ],
  },
];

export const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "inception",
    title: "Inception",
    year: 2010,
    description: "A thief who steals corporate secrets through dream-sharing tech is given a chance at redemption.",
    poster: poster("oklch(0.3 0.04 250)", "oklch(0.6 0.15 60)"),
    reason: "Your group highly rated The Dark Knight and Interstellar — Nolan's signature style fits your taste.",
  },
  {
    id: "arcane",
    title: "Arcane",
    year: 2021,
    description: "Two sisters are torn apart by the conflict between the utopian Piltover and the oppressed Zaun.",
    poster: poster("oklch(0.4 0.16 320)", "oklch(0.5 0.16 220)"),
    reason: "You loved Spider-Verse — Arcane is the same level of stylized, story-first animation.",
  },
  {
    id: "better-call-saul",
    title: "Better Call Saul",
    year: 2015,
    description: "The trials of small-time lawyer Jimmy McGill in the years leading up to Breaking Bad.",
    poster: poster("oklch(0.35 0.05 60)", "oklch(0.25 0.04 270)"),
    reason: "Breaking Bad S1 hit hard for the group — its prequel is just as strong.",
  },
  {
    id: "chernobyl",
    title: "Chernobyl",
    year: 2019,
    description: "A dramatization of the 1986 nuclear disaster and the cleanup that followed.",
    poster: poster("oklch(0.3 0.03 145)", "oklch(0.25 0.02 30)"),
    reason: "The Last of Us E1 landed for you — Chernobyl's grounded tension scratches the same itch.",
  },
];

export const averageRating = (item: MediaItem) =>
  Math.round(
    (item.reviews.reduce((s, r) => s + r.rating, 0) / item.reviews.length) * 10,
  ) / 10;

export const scoreColor = (score: number) => {
  if (score >= 80) return "var(--color-score-high)";
  if (score >= 65) return "var(--color-score-mid)";
  return "var(--color-score-low)";
};

export const getMember = (id: string) =>
  MEMBERS.find((m) => m.id === id) ?? MEMBERS[0];

export const getItem = (id: string) => ITEMS.find((i) => i.id === id);

export const summarize = (item: MediaItem): string => {
  const avg = averageRating(item);
  const high = item.reviews.filter((r) => r.rating >= 90).length;
  const low = item.reviews.filter((r) => r.rating < 80).length;
  const mood =
    avg >= 90 ? "very positive" : avg >= 80 ? "positive" : avg >= 70 ? "mixed-positive" : "mixed";
  const highlights =
    high >= 2
      ? "Several members called out the performances and standout moments."
      : "The group appreciated the craft, especially the visuals and sound.";
  const caveats =
    low > 0
      ? " A couple of members felt the pacing dipped in the middle, but it didn't derail the experience."
      : " There weren't many strong critiques — the group was largely on the same page.";
  return `Overall the group's reaction was ${mood} (avg ${avg}/100). ${highlights}${caveats}`;
};
