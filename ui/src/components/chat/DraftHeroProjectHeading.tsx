import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { observeResize } from "../../lib/observeResize";

// Private-use placeholder marking where the project name goes; it never reaches the screen.
const PROJECT_SLOT = "";

// 搬自 T3 的 DraftHeroProjectHeading：空任务的大标题「在 <项目> 里做点什么？」。
// 宽度够就排成一行，不够就把项目名折到下一行；测宽用的是不可见的整行副本，
// 所以来回换行不会互相影响。

export function DraftHeroProjectHeading({
  children,
  projectName,
}: {
  children: ReactNode;
  projectName: string;
}) {
  // 句子里的占位符换成项目名；split 不到时退回两句默认值，不能让它抛错把整页打白。
  const [before = "", after = ""] = `What should we build in ${String.fromCodePoint(0xe000)}?`.split(PROJECT_SLOT);
  const buildIn = before.trim();
  const buildInSuffix = after.trimEnd();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inlineRef = useRef<HTMLSpanElement | null>(null);
  const [fitsInline, setFitsInline] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inline = inlineRef.current;
    if (!container || !inline) return;
    const update = () =>
      setFitsInline(inline.getBoundingClientRect().width <= container.getBoundingClientRect().width);
    update();
    return observeResize([container, inline], update);
  }, []);

  return (
    <div ref={containerRef} className="group/draft-hero relative w-full" data-inline={fitsInline}>
      <span aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
        <span
          ref={inlineRef}
          className="flex w-max items-baseline gap-2 whitespace-nowrap text-3xl font-normal tracking-tight"
        >
          <span>{buildIn}</span>
          <span>
            <span className="font-medium">{projectName}</span>
            {buildInSuffix}
          </span>
        </span>
      </span>
      <h1 className="flex w-full flex-col items-center justify-center gap-2 text-center text-2xl font-normal tracking-tight text-foreground sm:text-3xl lg:group-data-[inline=true]/draft-hero:flex-row">
        <span className="max-w-full lg:group-data-[inline=true]/draft-hero:shrink-0">
          <span className="lg:group-data-[inline=true]/draft-hero:hidden">What should we build?</span>
          <span className="hidden lg:group-data-[inline=true]/draft-hero:inline">{buildIn}</span>
        </span>
        <span className="flex min-w-0 max-w-full items-baseline justify-center text-base tracking-normal lg:group-data-[inline=true]/draft-hero:text-3xl lg:group-data-[inline=true]/draft-hero:tracking-tight">
          <span className="min-w-0">{children}</span>
          <span className="hidden shrink-0 whitespace-pre lg:group-data-[inline=true]/draft-hero:inline">
            {buildInSuffix}
          </span>
        </span>
      </h1>
    </div>
  );
}
