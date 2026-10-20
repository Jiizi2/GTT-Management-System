import type { ReactNode } from "react";
import { Icon } from "./icon";

export function SectionHeader({
  title,
  id,
  description,
  icon,
  actions,
  level = 2,
  className = "",
}: {
  title: ReactNode;
  id?: string;
  description?: ReactNode;
  icon?: string;
  actions?: ReactNode;
  level?: 2 | 3;
  className?: string;
}) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}>
      <div className="min-w-0">
        <Heading
          id={id}
          className={`flex items-center gap-2 font-extrabold text-on-surface ${level === 3 ? "text-sm" : "text-lg"}`}
        >
          {icon ? <Icon name={icon} className="text-xl text-primary" /> : null}
          {title}
        </Heading>
        {description ? <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
