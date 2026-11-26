// 搬自 T3 的 ComposerBannerStack：把若干条「发送前提醒」叠成输入框上方的一摞卡片。
// 顺序固定为「环境」在前、「需要注意」在后，卡片来去不会互换位置。
// T3 的 NoticeText 会测量文字是否溢出再弹一个详情浮层；Tango 先用 title 属性给出全文。
import type { ReactNode } from "react";

import { ComposerBanner, type ComposerBannerVariant } from "./ComposerBanner";

export type ComposerBannerGroup = "environment" | "attention";

export interface ComposerBannerStackItem {
  readonly id: string;
  readonly variant: ComposerBannerVariant;
  readonly group?: ComposerBannerGroup;
  readonly icon: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly dismissLabel?: string;
  readonly onDismiss?: () => void;
}

const GROUPS = ["environment", "attention"] as const;

const FADE_IN =
  "transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none";

/** 同一个 composer 上方的提醒；相邻卡片首尾相接，最后一张贴住输入框。 */
export function ComposerBannerStack({
  items,
  detached = false,
}: {
  readonly items: ReadonlyArray<ComposerBannerStackItem>;
  readonly detached?: boolean;
}) {
  const ordered = GROUPS.flatMap((group) =>
    items.filter((item) => (item.group ?? "attention") === group),
  );
  if (detached) {
    return ordered.map((item) => (
      <div key={item.id} data-composer-banner-stack="true" className={FADE_IN}>
        <NoticeCard item={item} detached />
      </div>
    ));
  }
  return ordered.map((item) => (
    <ComposerBanner.Attachment key={item.id} data-composer-banner-stack="true" className={FADE_IN}>
      <NoticeCard item={item} />
    </ComposerBanner.Attachment>
  ));
}

/** 一行说明文字：单行截断，全文放在 title 里。 */
export function NoticeText({
  children,
  className,
  detailsLabel,
}: {
  readonly children: ReactNode;
  readonly className: string;
  readonly detailsLabel: string;
}) {
  return (
    <span className={className} title={typeof children === "string" ? children : detailsLabel}>
      {children}
    </span>
  );
}

function NoticeCard({
  item,
  detached = false,
}: {
  readonly item: ComposerBannerStackItem;
  readonly detached?: boolean;
}) {
  return (
    <ComposerBanner.Root
      role={item.variant === "error" || item.variant === "warning" ? "alert" : undefined}
      variant={item.variant}
      detached={detached}
      density="comfortable"
      data-chat-composer-collapsed-controls="true"
    >
      <ComposerBanner.Row layout="wrap-actions">
        <ComposerBanner.Icon className="h-(--composer-banner-icon-column) self-start">
          {item.icon}
        </ComposerBanner.Icon>
        <ComposerBanner.Content className="items-baseline whitespace-nowrap">
          <NoticeText
            detailsLabel={typeof item.title === "string" ? item.title : "Notice"}
            className="min-w-0 truncate font-medium leading-7 sm:leading-6"
          >
            {item.title}
          </NoticeText>
          {item.description ? (
            <NoticeText
              detailsLabel={typeof item.description === "string" ? item.description : "Notice details"}
              className="w-0 min-w-0 grow truncate text-muted-foreground @max-[400px]:sr-only"
            >
              {item.description}
            </NoticeText>
          ) : null}
        </ComposerBanner.Content>
        {item.actions || item.onDismiss ? (
          <ComposerBanner.Actions className="min-w-14 sm:min-w-12">
            {item.actions}
            {item.onDismiss ? (
              <ComposerBanner.Dismiss
                aria-label={item.dismissLabel ?? "Dismiss warning"}
                onClick={item.onDismiss}
              />
            ) : null}
          </ComposerBanner.Actions>
        ) : null}
      </ComposerBanner.Row>
      {item.children ? <ComposerBanner.Children>{item.children}</ComposerBanner.Children> : null}
    </ComposerBanner.Root>
  );
}
