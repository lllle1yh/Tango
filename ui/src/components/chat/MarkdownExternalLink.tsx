// 搬自 T3 的 MarkdownExternalLinkContent：外链前面带站点图标，长链接可以在任意处断行。
// T3 对 GitHub 一类站点用品牌图标；Tango 只取 favicon（Google 的 s2 服务），失败回退地球。
import { GlobeIcon } from "lucide-react";
import { Children, memo, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";

// 行内、可选中：三击选择停在块级元素，不会把图标一起选中。
const MARKDOWN_LINK_FAVICON_CLASS_NAME = "inline-block size-[14px] [vertical-align:-0.125em]";

const failedFaviconHosts = new Set<string>();

function faviconUrlForHost(host: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
}

const MarkdownLinkFavicon = memo(function MarkdownLinkFavicon({ host }: { host: string }) {
  const [failedHost, setFailedHost] = useState<string | null>(null);
  if (failedHost === host || failedFaviconHosts.has(host)) {
    return (
      <span className="ms-[0.25em] me-[0.2em]" aria-hidden>
        <GlobeIcon className={MARKDOWN_LINK_FAVICON_CLASS_NAME} />
      </span>
    );
  }
  return (
    <span className="ms-[0.25em] me-[0.2em]" aria-hidden>
      <img
        src={faviconUrlForHost(host)}
        alt=""
        loading="lazy"
        draggable={false}
        className={cn(MARKDOWN_LINK_FAVICON_CLASS_NAME, "rounded-sm")}
        onError={() => {
          failedFaviconHosts.add(host);
          setFailedHost(host);
        }}
      />
    </span>
  );
});

function leadingExternalLinkTextLength(text: string): number {
  const protocol = /^(?:https?:\/\/)/i.exec(text)?.[0];
  if (protocol) return protocol.length;
  // 整个码点，避免把代理对拆到两个元素里。
  return Array.from(text.slice(0, 2))[0]?.length ?? 0;
}

// 短标签（例如 PR 号）在窄表格里保持完整。
function breakableExternalLinkText(text: string): ReactNode[] {
  return Array.from(text.matchAll(/\s+|\S+/g), ({ 0: word, index: start }) =>
    word.length <= 16 ? (
      word
    ) : (
      <span key={start} className="[overflow-wrap:anywhere]">
        {word}
      </span>
    ),
  );
}

export function MarkdownExternalLinkContent({
  host,
  plainText,
  children,
}: {
  host: string;
  plainText: string | null;
  children: ReactNode;
}) {
  if (plainText) {
    const leadingLength = leadingExternalLinkTextLength(plainText);
    return (
      <>
        <span className="whitespace-nowrap">
          <MarkdownLinkFavicon host={host} />
          {plainText.slice(0, leadingLength)}
        </span>
        {breakableExternalLinkText(plainText.slice(leadingLength))}
      </>
    );
  }

  const childNodes = Children.toArray(children);
  const firstChild = childNodes[0];

  if (typeof firstChild === "string" && firstChild.length > 0) {
    const leadingLength = leadingExternalLinkTextLength(firstChild);
    return (
      <>
        <span className="whitespace-nowrap">
          <MarkdownLinkFavicon host={host} />
          {firstChild.slice(0, leadingLength)}
        </span>
        {breakableExternalLinkText(firstChild.slice(leadingLength))}
        {childNodes.slice(1)}
      </>
    );
  }

  return (
    <>
      <span className="[overflow-wrap:anywhere]">
        <MarkdownLinkFavicon host={host} />
        {firstChild}
      </span>
      {childNodes.slice(1)}
    </>
  );
}
