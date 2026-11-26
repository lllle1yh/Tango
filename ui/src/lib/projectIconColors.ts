// 搬自 T3 的 apps/web/src/projectIconColors.ts：项目图标可用的颜色与对应文字色类。
export const PROJECT_ICON_COLORS = [
  { value: "gray", label: "Gray", className: "text-gray-600 dark:text-gray-400" },
  { value: "red", label: "Red", className: "text-red-600 dark:text-red-400" },
  { value: "orange", label: "Orange", className: "text-orange-600 dark:text-orange-400" },
  { value: "amber", label: "Amber", className: "text-amber-600 dark:text-amber-400" },
  { value: "yellow", label: "Yellow", className: "text-yellow-600 dark:text-yellow-400" },
  { value: "lime", label: "Lime", className: "text-lime-600 dark:text-lime-400" },
  { value: "green", label: "Green", className: "text-green-600 dark:text-green-400" },
  { value: "emerald", label: "Emerald", className: "text-emerald-600 dark:text-emerald-400" },
  { value: "teal", label: "Teal", className: "text-teal-600 dark:text-teal-400" },
  { value: "cyan", label: "Cyan", className: "text-cyan-600 dark:text-cyan-400" },
  { value: "sky", label: "Sky", className: "text-sky-600 dark:text-sky-400" },
  { value: "blue", label: "Blue", className: "text-blue-600 dark:text-blue-400" },
  { value: "indigo", label: "Indigo", className: "text-indigo-600 dark:text-indigo-400" },
  { value: "violet", label: "Violet", className: "text-violet-600 dark:text-violet-400" },
  { value: "purple", label: "Purple", className: "text-purple-600 dark:text-purple-400" },
  { value: "fuchsia", label: "Fuchsia", className: "text-fuchsia-600 dark:text-fuchsia-400" },
  { value: "pink", label: "Pink", className: "text-pink-600 dark:text-pink-400" },
  { value: "rose", label: "Rose", className: "text-rose-600 dark:text-rose-400" },
] as const;

const BY_VALUE: Record<string, string> = Object.fromEntries(
  PROJECT_ICON_COLORS.map(({ value, className }) => [value, className]),
);

export function projectIconColorClassName(color: string): string {
  return BY_VALUE[color] ?? "text-blue-600 dark:text-blue-400";
}
