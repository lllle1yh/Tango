// 搬自 T3 的 ComposerImageThumbnail：先给原图的本地 blob，等缩略图解码好再换上，
// 换的过程中旧图一直可见，不会闪回占位。
import { memo, useEffect, useState, type ReactNode } from "react";

import { createComposerImageThumbnail, isHeicImageFile, readComposerImageThumbnail } from "../../lib/imageCompression";
import { cn } from "../../lib/utils";

export const ComposerImageThumbnail = memo(function ComposerImageThumbnail({
  file,
  alt,
  className,
  fallback,
}: {
  file: File;
  alt: string;
  className: string;
  fallback: ReactNode;
}) {
  const [preview, setPreview] = useState(() => ({ file, src: readComposerImageThumbnail(file) ?? null }));
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = preview.file === file ? preview.src : (readComposerImageThumbnail(file) ?? null);

  useEffect(() => {
    let disposed = false;
    let localUrl: string | undefined;
    const cached = readComposerImageThumbnail(file);
    // 原图先顶上；HEIC 浏览器放不了，就等缩略图（或回退）。
    if (!isHeicImageFile(file) && !cached) {
      localUrl = URL.createObjectURL(file);
      setPreview({ file, src: localUrl });
    }
    if (cached === undefined) {
      void createComposerImageThumbnail(file).then(async (thumbnail) => {
        if (disposed) return;
        if (!thumbnail) {
          if (!localUrl) setPreview({ file, src: null });
          return;
        }
        const image = new Image();
        image.src = thumbnail;
        try {
          await image.decode();
          if (!disposed) setPreview({ file, src: thumbnail });
        } catch {
          // 缩略图解不开就保留本地原图预览。
        }
      });
    }
    return () => {
      disposed = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [file]);

  return src && failedSrc !== src ? (
    <span className="relative block size-full">
      {loadedSrc !== src && fallback}
      <img
        ref={(image) => {
          if (image?.complete && image.naturalWidth > 0) setLoadedSrc(src);
        }}
        src={src}
        alt={alt}
        onLoad={() => setLoadedSrc(src)}
        onError={() => setFailedSrc(src)}
        className={cn(className, loadedSrc !== src && "invisible absolute inset-0")}
      />
    </span>
  ) : (
    fallback
  );
});
