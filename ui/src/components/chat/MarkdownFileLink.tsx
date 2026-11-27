// 搬自 T3 的 MarkdownFileLink 的轻量版：消息里的 `src/foo.ts` 这类内联代码如果是项目里的文件，
// 就变成可点的链接，用系统默认程序打开。T3 会在自己的预览面板里打开并高亮对应行；
// Tango 没有文件预览面板，因此交给操作系统。
import { useEffect, useState } from "react";

import { useMarkdownProjectPath } from "./markdownProjectContext";

// 只认“像文件路径”的代码：至少一个扩展名，允许带 :line 或 :line-line。
const FILE_PATH_PATTERN = /^(?:[\w@][\w@.-]*\/)*[\w@][\w@.-]*\.[A-Za-z0-9]+(?::\d+(?:-\d+)?)?$/;

// 同一个项目里的一串路径会重复出现，存在性只问一次。
const knownFiles = new Map<string, boolean>();

export function filePathCandidate(text: string): { path: string; line: string | null } | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (!FILE_PATH_PATTERN.test(trimmed.replace(/\\/g, "/"))) return null;
  const match = /^(.*?)(?::(\d+(?:-\d+)?))?$/.exec(trimmed.replace(/\\/g, "/"));
  if (!match) return null;
  const path = match[1] ?? "";
  if (!path || path.includes("..") || path.startsWith("/")) return null;
  return { path, line: match[2] ?? null };
}

export function MarkdownFileLink({
  text,
  fallback,
}: {
  text: string;
  fallback: React.ReactNode;
}) {
  const projectPath = useMarkdownProjectPath();
  const candidate = projectPath ? filePathCandidate(text) : null;
  const cacheKey = candidate && projectPath ? projectPath + "\u0000" + candidate.path : "";
  const [exists, setExists] = useState<boolean | null>(() => knownFiles.get(cacheKey) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidate || !projectPath) return;
    if (knownFiles.has(cacheKey)) {
      setExists(knownFiles.get(cacheKey)!);
      return;
    }
    let alive = true;
    void window.tango
      .projectFileExists(projectPath, candidate.path)
      .then((result) => {
        if (!alive) return;
        knownFiles.set(cacheKey, result.exists);
        setExists(result.exists);
      })
      .catch(() => {
        if (alive) setExists(false);
      });
    return () => {
      alive = false;
    };
  }, [cacheKey, candidate, projectPath]);

  if (!candidate || !projectPath || exists !== true) return <>{fallback}</>;

  return (
    <button
      type="button"
      className="markdown-file-link"
      data-markdown-file-link={candidate.path}
      title={error ? `Could not open: ${error}` : `Open ${candidate.path}`}
      onClick={() => {
        setError(null);
        void window.tango
          .openProjectFile(projectPath, candidate.path)
          .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not open the file"));
      }}
    >
      {text}
    </button>
  );
}
