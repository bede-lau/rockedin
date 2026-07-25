import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SectionEyebrow({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <p className="eyebrow">
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
