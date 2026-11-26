// 搬自 T3 的 MarkdownDetails：Markdown 里的 <details> 折叠块。
// T3 为了「查找能展开折叠」在 hover/focus 时才挂 Base UI 的 Collapsible；
// Tango 用原生 details + 受控 open，保留它的外观（分隔线、旋转箭头、缩进正文）。
import { ChevronRightIcon } from "lucide-react";
import {
  Children,
  isValidElement,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

export function MarkdownDetails({
  children,
  open = false,
  dir,
}: Pick<ComponentProps<"details">, "children" | "open" | "dir">) {
  const [isOpen, setIsOpen] = useState(open);
  const childNodes = Children.toArray(children);
  const summaryIndex = childNodes.findIndex(
    (child) => isValidElement(child) && child.type === "summary",
  );
  const summaryNode = summaryIndex >= 0 ? childNodes[summaryIndex] : null;
  const summary =
    isValidElement<{ children?: ReactNode }>(summaryNode) && summaryNode.props.children
      ? summaryNode.props.children
      : "Details";
  const content = childNodes.filter((_, index) => index !== summaryIndex);

  return (
    <div className="my-2 border-y border-border/60" dir={dir}>
      <div
        data-markdown-details=""
        data-markdown-details-open={isOpen ? "true" : "false"}
        className="[&_button>svg]:transition-transform"
      >
        <button
          type="button"
          aria-expanded={isOpen}
          className="flex w-full cursor-pointer items-center gap-2 py-2 text-start text-sm font-medium text-foreground"
          data-markdown-details-summary=""
          onClick={() => setIsOpen((value) => !value)}
        >
          <ChevronRightIcon
            className={
              "size-4 shrink-0 text-muted-foreground transition-transform " +
              (isOpen ? "rotate-90 [&:dir(rtl)]:-rotate-90" : "")
            }
            aria-hidden
          />
          <span>{summary}</span>
        </button>
        {isOpen && (
          <div className="pb-3 ps-6" data-markdown-details-content="">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}
