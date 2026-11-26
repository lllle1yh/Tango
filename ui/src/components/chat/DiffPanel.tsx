// 照 T3 的 DiffPanel 改写的 Tango 版：右侧「改动」面板。
// T3 那版 1800 行，绑定 Pierre 高亮和 Effect 查询；这里用主进程给的结构化 patch
// （git:diff）直接排行，保留它最有用的部分：范围切换、逐文件折叠、行号与复制路径。
import { ChevronDown, ChevronRight, Copy, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "../../lib/utils";
import { DiffStatLabel } from "./DiffStatLabel";

type DiffFile = {
  path: string;
  oldPath: string | null;
  status: "added" | "deleted" | "modified" | "renamed";
  binary: boolean;
  additions: number;
  deletions: number;
  hunks: Array<{
    header: string;
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: Array<{ kind: "add" | "del" | "ctx" | "meta"; text: string; oldNo: number | null; newNo: number | null }>;
  }>;
};

const STATUS_LABEL: Record<DiffFile["status"], string> = {
  added: "Added",
  deleted: "Deleted",
  modified: "Modified",
  renamed: "Renamed",
};

export function DiffPanel({ projectPath }: { projectPath: string }) {
  const [scope, setScope] = useState<"working" | "staged">("working");
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPaths, setOpenPaths] = useState<Record<string, boolean>>({});
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void window.tango
      .gitDiff(projectPath, scope)
      .then((next) => {
        if (cancelled) return;
        setFiles(next);
        // 文件少时直接展开，省一次点击；多的时候先看总表。
        if (next.length <= 3) {
          setOpenPaths(Object.fromEntries(next.map((file) => [file.path, true])));
        } else {
          setOpenPaths({});
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not read changes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath, scope, tick]);

  const copyPath = useCallback((path: string) => {
    void navigator.clipboard.writeText(path).then(() => {
      setCopiedPath(path);
      window.setTimeout(() => setCopiedPath((current) => (current === path ? null : current)), 1200);
    });
  }, []);

  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);

  return (
    <div
      data-diff-panel="true"
      aria-label="Changes"
      className="flex min-h-0 flex-1 flex-col bg-background"
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <div className="flex items-center rounded-md border border-border p-0.5" role="tablist" aria-label="Diff scope">
          {(["working", "staged"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              className={cn(
                "h-6 rounded px-2 text-xs font-medium capitalize",
                scope === value ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setScope(value)}
            >
              {value}
            </button>
          ))}
        </div>
        {files.length > 0 && <DiffStatLabel additions={additions} deletions={deletions} layout="inline" className="text-xs" />}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Refresh changes"
            title="Refresh changes"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setTick((value) => value + 1)}
          >
            <RefreshCw size={13} />
          </button>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {loading ? (
          <p className="px-4 py-6 text-xs text-muted-foreground">Reading changes…</p>
        ) : error ? (
          <p role="alert" className="px-4 py-6 text-xs text-destructive">
            {error}
          </p>
        ) : files.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground">
            {scope === "working" ? "No uncommitted changes." : "Nothing staged."}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {files.map((file) => {
              const open = openPaths[file.path] ?? false;
              return (
                <li key={file.path + (file.oldPath ?? "")} data-diff-file={file.path}>
                  <div className="flex min-h-9 items-center gap-2 px-3 py-1">
                    <button
                      type="button"
                      aria-expanded={open}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      onClick={() => setOpenPaths((current) => ({ ...current, [file.path]: !open }))}
                    >
                      {open ? (
                        <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 truncate font-mono text-xs" title={file.path}>
                        {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                      </span>
                    </button>
                    <span className="shrink-0 rounded border border-border px-1 text-[10px] text-muted-foreground" title={STATUS_LABEL[file.status]}>
                      {STATUS_LABEL[file.status].slice(0, 1)}
                    </span>
                    {file.binary ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">binary</span>
                    ) : (
                      <DiffStatLabel additions={file.additions} deletions={file.deletions} layout="inline" className="text-[11px]" />
                    )}
                    <button
                      type="button"
                      aria-label={`Copy path ${file.path}`}
                      title={copiedPath === file.path ? "Copied" : "Copy path"}
                      className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => copyPath(file.path)}
                    >
                      <Copy size={12} className={copiedPath === file.path ? "text-success" : undefined} />
                    </button>
                  </div>
                  {open && (
                    <div className="pb-2">
                      {file.binary ? (
                        <p className="px-4 text-[11px] text-muted-foreground">Binary file — no text diff.</p>
                      ) : file.hunks.length === 0 ? (
                        <p className="px-4 text-[11px] text-muted-foreground">No textual hunks.</p>
                      ) : (
                        file.hunks.map((hunk, hunkIndex) => (
                          <div key={`${file.path}-${hunkIndex}`} className="chat-diff-hunk">
                            <div className="chat-diff-hunk-header px-3 py-1 font-mono text-[11px] text-muted-foreground">
                              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                              {hunk.header ? ` ${hunk.header}` : ""}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="chat-diff-table">
                                <tbody>
                                  {hunk.lines.map((line, lineIndex) => (
                                    <tr
                                      key={`${hunkIndex}-${lineIndex}`}
                                      className={
                                        line.kind === "add"
                                          ? "chat-diff-add"
                                          : line.kind === "del"
                                            ? "chat-diff-del"
                                            : line.kind === "meta"
                                              ? "text-muted-foreground"
                                              : ""
                                      }
                                    >
                                      <td className="chat-diff-no">{line.oldNo ?? ""}</td>
                                      <td className="chat-diff-no">{line.newNo ?? ""}</td>
                                      <td className="chat-diff-sign">{line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}</td>
                                      <td className="chat-diff-text">{line.text === "" ? " " : line.text}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
