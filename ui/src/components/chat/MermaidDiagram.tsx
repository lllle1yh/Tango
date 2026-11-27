// 搬自 T3 的 MermaidDiagram：用 pele 把 ```mermaid 画成 SVG。
// 与 T3 的区别：
// - 没有 katex 的 $$ 数学标签支持（Tango 尚未引入 katex），带 $$ 的图按普通文本渲染；
// - 点图展开走 Tango 自己的 ExpandedImageDialog（T3 是 ChatOverlayHosts 的图片预览）。
import DOMPurify from "dompurify";
import type { DiagramType } from "pele/lazy";
import { useState } from "react";

import { serializeCodeBlockToMarkdown } from "../../lib/markdownCodeBlock";

type Pele = typeof import("pele/lazy");
type PeleLoad = { readonly status: "loaded"; readonly pele: Pele } | { readonly status: "failed" };

let coreLoad: Promise<PeleLoad> | null = null;
// 每种图单独一个 chunk：一张流程图只加载流程图的解析与排版。
const diagramLoads = new Map<DiagramType, Promise<PeleLoad>>();

function loadCore(): Promise<PeleLoad> {
  coreLoad ??= import("pele/lazy").then(
    (pele): PeleLoad => ({ status: "loaded", pele }),
    (): PeleLoad => ({ status: "failed" }),
  );
  return coreLoad;
}

function loadDiagramType(pele: Pele, type: DiagramType): Promise<PeleLoad> {
  const cached = diagramLoads.get(type);
  if (cached) return cached;
  const load = pele.load(type).then(
    (): PeleLoad => ({ status: "loaded", pele }),
    (): PeleLoad => ({ status: "failed" }),
  );
  diagramLoads.set(type, load);
  return load;
}

function detectDiagramType(pele: Pele, source: string): DiagramType | null {
  try {
    return pele.detectType(source);
  } catch {
    return null;
  }
}

let purifier: ReturnType<typeof DOMPurify> | null = null;

// 图可以来自 Agent 输出或 PR 描述，按不可信内容处理：标签 pele 已转义，
// 这里再禁掉一切能导航、执行脚本或远程取资源的东西。
function sanitizeDiagramSvg(svg: string): Node {
  // DOMPurify 的类型在不同版本里对 window 参数要求不一，这里按运行时对象传。
  purifier ??= DOMPurify(window as unknown as Parameters<typeof DOMPurify>[0]);
  return purifier.sanitize(svg, {
    FORBID_ATTR: ["href", "xlink:href", "src", "srcset"],
    FORBID_TAGS: ["a", "image", "foreignObject", "style"],
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM_FRAGMENT: true,
  }) as Node;
}

// Pele 用这些变量给图上色，导出成图片时要一起写进克隆的 SVG。
const PELE_COLOR_VARIABLES = [
  "--pele-bg",
  "--pele-fg",
  "--pele-muted",
  "--pele-line",
  "--pele-surface",
  "--pele-surface-alt",
  "--pele-border",
  "--pele-accent",
  "--pele-critical",
  ...Array.from({ length: 8 }, (_, index) => `--pele-series-${index + 1}`),
];

/**
 * blob URL（而不是 data URL）才能通过桌面端的 connect-src 策略；
 * 这个 URL 的生命周期交给调用方（对话框打开期间）。
 */
function diagramImageUrl(svg: SVGSVGElement): string {
  const element = svg.cloneNode(true) as SVGSVGElement;
  const computed = getComputedStyle(svg);
  for (const name of PELE_COLOR_VARIABLES) {
    const value = computed.getPropertyValue(name).trim();
    if (value) element.style.setProperty(name, value);
  }
  element.style.maxWidth = "none";
  element.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
  return URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(element)], { type: "image/svg+xml" }),
  );
}

export function MermaidDiagram({
  source,
  onExpand,
}: {
  source: string;
  onExpand: (imageUrl: string, name: string) => void;
}) {
  // 加载状态变化或重试时 +1，让下面的 use() 重新挂载。
  const [attempt, setAttempt] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const trimmedSource = source.trim();
  // 这里不用 React 的 use()：它在不同版本下的缓存语义不同，Tango 用普通异步状态。
  const [core, setCore] = useState<PeleLoad | null>(null);
  const [loadedType, setLoadedType] = useState<PeleLoad | null>(null);
  if (core === null) {
    void loadCore().then(setCore, () => setCore({ status: "failed" }));
  }
  const type = core?.status === "loaded" ? detectDiagramType(core.pele, trimmedSource) : null;
  if (core?.status === "loaded" && type && loadedType === null) {
    void loadDiagramType(core.pele, type).then(setLoadedType, () => setLoadedType({ status: "failed" }));
  }
  // $$ 数学标签需要 katex，Tango 目前不带；带 $$ 的图直接显示源码，避免渲染出错位文字。
  const needsMath = trimmedSource.includes("$$");

  const mountDiagram = (container: HTMLSpanElement) => {
    if (loadedType?.status !== "loaded" || needsMath) return;
    const mounted = loadedType.pele.mount(container, trimmedSource, {
      links: false,
      images: false,
      zoom: false,
      // 保留作者的排版方向；太宽的图整体缩小，而不是转成竖排。
      autoDirection: false,
      sanitize: sanitizeDiagramSvg,
      onRender: () => setRenderError(null),
      onError: (error) => setRenderError(error instanceof Error ? error.message : "The diagram could not be rendered."),
    });
    return () => mounted.destroy();
  };

  const failed = core?.status === "failed" || loadedType?.status === "failed" || needsMath;
  if (failed) {
    return (
      <DiagramError
        message={
          needsMath
            ? "Diagrams with $$ math labels are not supported yet."
            : "The diagram renderer failed to load."
        }
        source={source}
        onRetry={
          needsMath
            ? undefined
            : () => {
                if (core?.status === "failed") coreLoad = null;
                if (type) diagramLoads.delete(type);
                setCore(null);
                setLoadedType(null);
                setAttempt((value) => value + 1);
              }
        }
      />
    );
  }

  if (!loadedType || loadedType.status !== "loaded") {
    return (
      <div className="chat-markdown-mermaid px-3 py-2 text-xs text-muted-foreground" data-markdown-mermaid="">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      key={attempt}
      className="chat-markdown-mermaid my-[0.65rem] overflow-x-auto rounded-lg border border-border/70 bg-secondary p-2"
      data-markdown-mermaid=""
      data-markdown-copy={serializeCodeBlockToMarkdown(source, "mermaid")}
    >
      {renderError ? <DiagramError message={renderError} source={source} /> : null}
      <button
        type="button"
        aria-label="Expand diagram"
        hidden={renderError !== null}
        className="block w-full cursor-zoom-in rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        onClick={(event) => {
          const svg = event.currentTarget.querySelector("svg");
          if (svg) onExpand(diagramImageUrl(svg as SVGSVGElement), "diagram.svg");
        }}
      >
        <span ref={mountDiagram} className="flex w-full justify-center" />
      </button>
    </div>
  );
}

function DiagramError({
  message,
  source,
  onRetry,
}: {
  message: string;
  source: string;
  onRetry?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-xs text-destructive">Unable to render diagram: {message}</p>
        {onRetry ? (
          <button
            type="button"
            className="h-6 shrink-0 rounded-md px-2 text-xs font-medium text-foreground hover:bg-accent"
            onClick={onRetry}
          >
            Retry
          </button>
        ) : null}
      </div>
      <pre className="mt-2 mb-0 overflow-auto font-mono text-xs whitespace-pre-wrap">{source}</pre>
    </div>
  );
}
