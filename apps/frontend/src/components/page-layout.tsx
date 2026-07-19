import type { ReactNode } from "react";

const widthClasses = {
  standard: "max-w-7xl",
  wide: "max-w-[88rem]",
  workspace: "max-w-[96rem]",
  detail: "max-w-[88rem]",
} as const;

export function PageLayout({
  width = "standard",
  children,
  className = "",
}: {
  width?: keyof typeof widthClasses;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full ${widthClasses[width]} space-y-5 px-4 pb-24 pt-4 sm:space-y-6 sm:px-6 lg:px-8 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
