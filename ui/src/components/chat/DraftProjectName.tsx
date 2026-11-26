// 搬自 T3 的 DraftProjectName：空任务标题里的项目名，最多两行，
// 超长路径在任意位置断行而不是把整句撑出容器。
export function DraftProjectName({
  value,
  singleLine = false,
}: {
  value: string;
  singleLine?: boolean;
}) {
  return (
    <span
      aria-label={value}
      className={`min-w-0 ${singleLine ? "block truncate text-left" : "line-clamp-2 whitespace-normal [overflow-wrap:anywhere]"}`}
    >
      {value}
    </span>
  );
}
