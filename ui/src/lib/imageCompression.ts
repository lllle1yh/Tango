// 搬自 T3 的 lib/imageCompression 里 ComposerImageThumbnail 用到的那一小块：
// 把图片缩成 256 见方的方图（居中裁切），给附件芯片当缩略图。
// T3 那一整套还包括 HEIC 解码、在 Worker 里压缩、按质量阶梯重编码；Tango 的附件走本地路径，
// 不需要上传压缩，所以这里只保留缩略图，并改成返回 blob URL 而不是 data URL。

const THUMBNAIL_EDGE = 256;
/** 大于这个体积的源图先不解码，免得把渲染进程撑爆。 */
const MAX_THUMBNAIL_SOURCE_BYTES = 50 * 1024 * 1024;
const HEIC_IMAGE_MIME_TYPE = /^image\/hei(?:c|f)$/i;
const HEIC_IMAGE_EXTENSION = /\.(?:heic|heif)$/i;

let canvas: HTMLCanvasElement | null = null;
const thumbnails = new Map<File, Promise<string | null>>();
const settled = new Map<File, string | null>();

export function isHeicImageFile(file: Pick<File, "name" | "type">): boolean {
  if (HEIC_IMAGE_MIME_TYPE.test(file.type)) return true;
  return !file.type && HEIC_IMAGE_EXTENSION.test(file.name);
}

export function readComposerImageThumbnail(file: File): string | null | undefined {
  return settled.get(file);
}

export function createComposerImageThumbnail(file: File): Promise<string | null> {
  let pending = thumbnails.get(file);
  if (!pending) {
    pending = renderThumbnail(file).then((url) => {
      settled.set(file, url);
      return url;
    });
    thumbnails.set(file, pending);
  }
  return pending;
}

async function renderThumbnail(file: File): Promise<string | null> {
  // 浏览器解不了 HEIC，T3 为此专门接了解码器；Tango 暂时没有，直接给 null 让调用方用原图。
  if (isHeicImageFile(file)) return null;
  if (file.size > MAX_THUMBNAIL_SOURCE_BYTES) return null;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const side = Math.min(bitmap.width, bitmap.height);
      if (side <= 0) return null;
      const dimension = Math.min(THUMBNAIL_EDGE, side);
      canvas ??= document.createElement("canvas");
      canvas.width = dimension;
      canvas.height = dimension;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        dimension,
        dimension,
      );
      const surface = canvas;
      const blob = await new Promise<Blob | null>((resolve) => surface.toBlob(resolve, "image/png"));
      return blob ? URL.createObjectURL(blob) : null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
