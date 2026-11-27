// T3 的 ExpandedImageDialog 的最小可用版：点开消息里的图片，全屏看，Esc 或点背景关闭。
// T3 那版还带缩放、拖拽、多图切换和资产刷新；Tango 目前的图片只来自 Markdown 里的 URL，
// 先把「点开看清楚」这一件事做对。
import { useEffect } from "react";

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-3 bg-black/80 p-6"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-h-[86vh] max-w-[92vw] rounded-lg bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        className="rounded-full border border-white/30 px-3 py-1 text-xs text-white hover:bg-white/10"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}
