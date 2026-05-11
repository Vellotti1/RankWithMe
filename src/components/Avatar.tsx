import type { Member } from "@/lib/mock-data";

export function Avatar({ member, size = 32 }: { member: Member; size?: number }) {
  return (
    <div
      className="inline-flex items-center justify-center rounded-full font-semibold text-background"
      style={{
        width: size,
        height: size,
        background: member.avatarColor,
        fontSize: size * 0.42,
      }}
      aria-label={member.name}
    >
      {member.name[0]}
    </div>
  );
}
