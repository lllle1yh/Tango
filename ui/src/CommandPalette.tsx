import { Command } from "cmdk";

export type PaletteItem = {
  id: string;
  label: string;
  group: "Actions" | "Tasks" | "Agents";
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
  const groups: PaletteItem["group"][] = ["Actions", "Tasks", "Agents"];
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <Command
        className="palette"
        label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
      >
        <Command.Input autoFocus className="palette-input" placeholder="Type a command or search…" />
        <Command.List className="palette-list">
          <Command.Empty className="palette-empty">No results.</Command.Empty>
          {groups.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
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
                    {item.hint && <span className="palette-hint">{item.hint}</span>}
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
