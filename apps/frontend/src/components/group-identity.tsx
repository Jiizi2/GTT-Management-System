import type { ReactNode } from "react";

/** Shared identity content; family membership and navigation remain domain concerns. */
export function GroupIdentity({
  code,
  name,
  metadata,
  badge,
  headingLevel,
  className = "",
}: {
  code: string;
  name?: string;
  metadata?: ReactNode;
  badge?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Container = headingLevel ? "div" : "span";
  const Name = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "span";
  return (
    <Container className={`block min-w-0 ${className}`.trim()}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <strong className="break-all text-sm font-extrabold text-primary">{code}</strong>
        {badge}
      </span>
      {name ? <Name className="mt-1 block break-words text-sm font-bold text-on-surface">{name}</Name> : null}
      {metadata ? <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{metadata}</span> : null}
    </Container>
  );
}
