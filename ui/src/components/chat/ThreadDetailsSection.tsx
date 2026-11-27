// 搬自 T3 的 ThreadDetailsSection：详情栏里的一组行，小标题 + 可选动作 + 内容。
// T3 要求调用方给 headingId；Tango 的调用点只有标题，所以 headingId 可选，缺省按标题生成。
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/utils";

function headingIdFor(title: string) {
  return "thread-details-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ThreadDetailsSection({
  headingId,
  title,
  actions,
  separated = true,
  showHeading = true,
  children,
  ...props
}: Omit<ComponentProps<"section">, "className" | "style" | "title" | "aria-labelledby"> & {
  headingId?: string;
  title: string;
  actions?: ReactNode;
  separated?: boolean;
  showHeading?: boolean;
}) {
  const id = headingId ?? headingIdFor(title);
  return (
    <section
      {...props}
      aria-labelledby={showHeading ? id : undefined}
      aria-label={showHeading ? undefined : title}
      // 某一行可能是空的（例如草稿还没有 Git 信息），空组直接折叠；分隔线只跟在有内容的组后面。
      className={cn(
        "px-2 pt-2 pb-2.5 has-[>div:last-child:empty]:hidden",
        separated && "border-border/65 [section:not(:has(>div:last-child:empty))~&]:border-t",
      )}
    >
      <div
        className={cn(
          "mb-1 flex min-h-8 min-w-0 items-center justify-between gap-2 px-2.5",
          !showHeading && "hidden",
        )}
      >
        <h3 id={id} className="min-w-0 truncate text-2xs font-medium text-muted-foreground select-none">
          {title}
        </h3>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
