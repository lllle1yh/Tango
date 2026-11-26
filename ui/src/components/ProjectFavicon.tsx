import { FolderCode } from "lucide-react";
import type { ComponentType } from "react";

import { deriveProjectIdentity } from "../lib/projectIdentity";
import { ProjectMonogram } from "./ProjectMonogram";

// 搬自 T3 的 ProjectFavicon：项目在侧栏和面包屑里的图标。
// Tango 的项目没有自定义图标字段，所以一律按名字生成字母标记。
export function ProjectFavicon({
  projectName,
  className,
  fallbackIcon: Fallback = FolderCode,
}: {
  projectName: string;
  className?: string;
  fallbackIcon?: ComponentType<{ className?: string }>;
}) {
  if (!projectName.trim()) return <Fallback className={className} />;
  const identity = deriveProjectIdentity(projectName);
  return <ProjectMonogram text={identity.monogram} color={identity.color} className={className} />;
}
