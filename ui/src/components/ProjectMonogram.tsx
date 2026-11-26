import { projectIconColorClassName } from "../lib/projectIconColors";
import { cn } from "../lib/utils";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// 搬自 T3 的 ProjectMonogram：项目图标是一块带底色的小方块，里面写两个字母。
export function ProjectMonogram({
  text,
  color,
  className,
}: {
  text: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-slot="project-monogram"
      className={cn("inline-flex size-4 shrink-0 items-center justify-center", className)}
    >
      <svg
        viewBox="0 0 16 16"
        className={cn("size-full overflow-hidden rounded-[25%] font-mono select-none", projectIconColorClassName(color))}
        style={{ backgroundColor: "color-mix(in srgb, currentColor 14%, transparent)" }}
      >
        <text
          x="8"
          y="10.8"
          textAnchor="middle"
          fill="currentColor"
          fontSize="8.25"
          fontWeight="700"
          textLength={Array.from(segmenter.segment(text)).length === 1 ? 6 : 12}
          lengthAdjust="spacingAndGlyphs"
          textRendering="geometricPrecision"
        >
          {text}
        </text>
      </svg>
    </span>
  );
}
