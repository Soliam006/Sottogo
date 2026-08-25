import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import type { PublicProfile } from "@/core/models";

const SIZES = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base" };

export function Avatar({
  profile,
  size = "md",
  className,
}: {
  profile: Pick<PublicProfile, "name" | "avatarUrl"> | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const name = profile?.name ?? "?";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200",
        SIZES[size],
        className,
      )}
      title={name}
    >
      {profile?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function AvatarStack({
  profiles,
  max = 4,
}: {
  profiles: Array<Pick<PublicProfile, "name" | "avatarUrl">>;
  max?: number;
}) {
  const shown = profiles.slice(0, max);
  const rest = profiles.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p, i) => (
        <Avatar key={i} profile={p} size="sm" className="ring-2 ring-[var(--surface-1)]" />
      ))}
      {rest > 0 && (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full surface-2 text-xs font-semibold ink-secondary ring-2 ring-[var(--surface-1)]">
          +{rest}
        </span>
      )}
    </div>
  );
}
