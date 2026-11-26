import { Command } from "cmdk";
import { Kbd } from "./components/ui/kbd";

export type PaletteItem = {
  id: string;
  label: string;
  group: "Actions" | "Go to" | "Agents";
  hint?: string;
  run(): void;
};

export function CommandPalette({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: PaletteItem[];
  onClose(): void;
}) {
  if (!open) return null;
  const groups: PaletteItem["group"][] = ["Actions", "Go to", "Agents"];
  // Sections are capped: one project with many tasks must not bury Settings below the fold.
  const visible = (group: PaletteItem["group"]) => {
    const groupItems = items.filter((item) => item.group === group);
    if (group === "Actions") return groupItems;
    return groupItems.slice(0, 8);
  };
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <Command
        className="palette"
        label="Command palette"
        loop
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
      >
        <Command.Input autoFocus className="palette-input" placeholder="Type a command or search…" />
        <Command.List className="palette-list">
          <Command.Empty className="palette-empty">No results.</Command.Empty>
          {groups.map((group) => {
            const groupItems = visible(group);
            if (!groupItems.length) return null;
            return (
              <Command.Group key={group} heading={group} className="palette-group">
                {groupItems.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.label + " " + (item.hint ?? "")}
                    className="palette-item"
                    onSelect={() => { onClose(); item.run(); }}
                  >
                    <span>{item.label}</span>
                    {/* 快捷键用 T3 的 Kbd 画成键帽：它比一行灰字更容易在扫视时对上。 */}
                    {item.hint && <Kbd className="palette-hint">{item.hint}</Kbd>}
                  </Command.Item>
                ))}
              </Command.Group>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
