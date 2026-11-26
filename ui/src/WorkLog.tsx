// 直接取自 T3 的 WorkLog（apps/web/src/components/chat/WorkLog.tsx）并去掉 Tailwind 依赖：
// 行结构、展开方式、详情区规则都保持一致，只把类名换成本仓库的 CSS。
import { createContext, use, useId, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from "react";

const GroupedRows = createContext(false);

/** Groups may span virtualized timeline items. Each part owns its trailing space. */
export function WorkLogBlock({
  layout = "standalone",
  continues = false,
  children,
}: {
  layout?: "standalone" | "group-header" | "group-content";
  continues?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <div className={"work-log-block " + (continues || layout === "group-header" ? "tight" : layout === "group-content" ? "content" : "")}>
      {children}
    </div>
  );
}

export function WorkLogList({ children }: { children: ReactNode }) {
  return (
    <GroupedRows value>
      <div className="work-log-list">{children}</div>
    </GroupedRows>
  );
}

type RowContent = {
  icon?: ReactNode;
  label: ReactNode;
  trailing?: ReactNode;
  wrapLabel?: boolean;
};

type LineProps = Omit<ComponentProps<"div">, "className" | "style" | "children">;

function WorkLogLine({ icon, label, trailing, wrapLabel, ...lineProps }: RowContent & LineProps) {
  return (
    <div {...lineProps} className={"work-log-line" + (wrapLabel ? " wrap" : "")}>
      <div className="work-log-main">
        {icon ? (
          <span className="work-log-icon">
            <span className="work-log-icon-inner">{icon}</span>
          </span>
        ) : null}
        <div className={"work-log-label" + (wrapLabel ? " wrap" : "")}>{label}</div>
      </div>
      {trailing}
    </div>
  );
}

function rowClassName(interactive: boolean) {
  const grouped = use(GroupedRows);
  return "work-log-row" + (interactive ? " interactive" : "") + (grouped ? " grouped" : "");
}

export function WorkLogButton({
  icon,
  label,
  trailing,
  wrapLabel = false,
  ...buttonProps
}: RowContent & Omit<ComponentProps<"button">, "className" | "style" | "children">) {
  return (
    <button {...buttonProps} type="button" className={rowClassName(true)}>
      <WorkLogLine icon={icon} label={label} trailing={trailing} wrapLabel={wrapLabel} />
    </button>
  );
}

type RowProps = Omit<ComponentProps<"div">, "className" | "style"> & {
  toggle?: LineProps | undefined;
};

/**
 * Div disclosure permits selectable detail and nested actions. `toggle` goes on
 * the header line only: assistive tech hides a button's children.
 */
export function WorkLogRow({ icon, label, trailing, wrapLabel = false, toggle, children, ...rowProps }: RowContent & RowProps) {
  const className = rowClassName(rowProps.onClick !== undefined);
  const detailsId = useId();
  return (
    <div {...rowProps} className={className}>
      <WorkLogLine aria-controls={toggle ? detailsId : undefined} {...toggle} icon={icon} label={label} trailing={trailing} wrapLabel={wrapLabel} />
      {toggle ? <div id={detailsId}>{children}</div> : children}
    </div>
  );
}

const LIVE_EDGE_PX = 4;

/** Detail stays inside a 384px window that scrolls; live output keeps pinning to the bottom. */
export function WorkLogDetails({
  children,
  kind = "text",
  followLive = false,
}: {
  children: ReactNode;
  kind?: "text" | "panel" | "media";
  followLive?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atLiveEdgeRef = useRef(true);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (followLive && atLiveEdgeRef.current && scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  return (
    <div
      ref={scrollerRef}
      onScroll={(event) => {
        const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
        atLiveEdgeRef.current = scrollHeight - scrollTop - clientHeight <= LIVE_EDGE_PX;
      }}
      className={"work-log-details " + kind}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
