// 照 T3 的 ComposerAttachmentStrip 改写的精简版：输入框上方一行附件。
// T3 的附件是上传到服务端、按资产 ID 引用；Tango 把文件留在磁盘上，芯片显示本地文件名，
// 发送时把路径写进消息，Agent 用自己的工具去读。渲染层读不到 file://，所以这里先只显示文件类型图标。
import { FileIcon, PaperclipIcon, X } from "lucide-react";
import { useMemo } from "react";

export type ComposerAttachment = {
  path: string;
  name: string;
  bytes: number;
};

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComposerAttachmentStrip({
  attachments,
  onRemove,
}: {
  attachments: ReadonlyArray<ComposerAttachment>;
  onRemove: (path: string) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div
      data-composer-attachment-strip="true"
      className="flex flex-wrap items-center gap-1.5 px-3 pb-1 pt-2"
    >
      {attachments.map((attachment) => (
        <AttachmentChip key={attachment.path} attachment={attachment} onRemove={onRemove} />
      ))}
    </div>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment;
  onRemove: (path: string) => void;
}) {
  const isImage = IMAGE_EXTENSIONS.test(attachment.name);
  // 本地绝对路径不能直接给 <img>（渲染层读不到 file://），所以按类型给图标，避免破图。
  const Icon = useMemo(() => (isImage ? PaperclipIcon : FileIcon), [isImage]);

  return (
    <span
      data-composer-attachment={attachment.path}
      className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 py-1 ps-2 pe-1 text-xs"
      title={attachment.path}
    >
      <Icon size={13} className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 max-w-48 truncate font-medium text-foreground">{attachment.name}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
        {formatBytes(attachment.bytes)}
      </span>
      <button
        type="button"
        aria-label={`Remove ${attachment.name}`}
        title="Remove attachment"
        className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={() => onRemove(attachment.path)}
      >
        <X size={12} />
      </button>
    </span>
  );
}
