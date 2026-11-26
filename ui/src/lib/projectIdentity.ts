import { PROJECT_ICON_COLORS } from "./projectIconColors";
import { projectMonogram } from "./projectMonogram";

// 搬自 T3 的 projectIdentity：同一个项目名每次都得到同一个字母标记和同一种颜色。
function projectColor(projectName: string): string {
  const seed = projectName.normalize("NFKC").trim().toLocaleLowerCase("en-US") || "project";
  let index = 0;
  for (const glyph of seed) {
    index = (index * 31 + (glyph.codePointAt(0) ?? 0)) % PROJECT_ICON_COLORS.length;
  }
  return PROJECT_ICON_COLORS[index]?.value ?? "blue";
}

export function deriveProjectIdentity(projectName: string): { monogram: string; color: string } {
  return { monogram: projectMonogram(projectName), color: projectColor(projectName) };
}
