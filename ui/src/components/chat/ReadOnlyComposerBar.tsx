// 搬自 T3 的 ReadOnlyComposerBar：输入框位置换成一条只读说明。
// 用在所选 Agent 不可用时——这时候发不出去，让输入框换成一句原因，比留一个
// 能打字但注定失败的框更直接。
import type { ComponentProps, ReactNode } from "react";

export function ReadOnlyComposerBar(props: {
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-2xl py-2 ps-5 pe-2 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3 @max-[560px]/composer-surface:flex-col @max-[560px]/composer-surface:items-start @max-[560px]/composer-surface:gap-0.5">
        {props.children}
      </div>
      {props.actions}
    </div>
  );
}

/** 第一行：一个图标和“这个任务是什么”。 */
export function ReadOnlyComposerLead(props: { readonly children: ReactNode }) {
  return <span className="flex min-w-0 max-w-full items-center gap-2">{props.children}</span>;
}

/** 第二行：状态说明；输入框窄时换到第一行下面。 */
export function ReadOnlyComposerStatus(props: Omit<ComponentProps<"span">, "className">) {
  return (
    <span
      className="min-w-0 max-w-full truncate text-muted-foreground tabular-nums @max-[560px]/composer-surface:text-xs"
      {...props}
    />
  );
}
