import { useCallback, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import type { AgentStatus, AppSettings, LayoutNode, TaskRecord } from "../../electron/preload";
import { Archive, ChevronDown, ChevronRight, Columns2, MoreHorizontal, Pencil, Plus, RefreshCw, Rows2, Terminal as TerminalIcon, Trash2, X } from "lucide-react";
import { Markdown } from "./Markdown";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Copy, GripVertical, PanelLeft, Pin, Search, Square, TerminalSquare, FileText, Globe, Wrench, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import "./layout.css";
import "./agent-icons.css";

// Windows paths use backslashes, other platforms slashes; the label is only the last part.
function projectLabel(projectPath: string) {
  return projectPath.split("\\").at(-1)?.split("/").at(-1) ?? projectPath;
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 7.5h6l1.8 2h9.2v9a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M3.5 7.5v-2A1.5 1.5 0 0 1 5 4h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v2" />
    </svg>
  );
}

// The first line of a prompt, shortened, works better than "New task" in the sidebar.
function titleFromPrompt(text: string) {
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  const cleaned = firstLine.replace(/^[/#>\-*]+\s*/, "");
  if (!cleaned) return null;
  return cleaned.length > 60 ? cleaned.slice(0, 57).trimEnd() + "…" : cleaned;
}

function AgentGlyph({ agentId }: { agentId: AgentStatus["id"] }) {
  const icon = {
    codex: "codex.svg",
    claude: "claude-code.svg",
    dsh: "deepseek.svg",
    pi: "pi.svg",
  }[agentId];
  return <span className={"agent-mark " + agentId + "-mark"} aria-hidden="true"><img src={"./icons/" + icon} alt="" /></span>;
}

function paneIds(node: LayoutNode): string[] {
  return node.type === "pane" ? [node.id] : [...paneIds(node.first), ...paneIds(node.second)];
}

function replacePane(node: LayoutNode, paneId: string, replacement: LayoutNode): LayoutNode {
  if (node.type === "pane") return node.id === paneId ? replacement : node;
  return { ...node, first: replacePane(node.first, paneId, replacement), second: replacePane(node.second, paneId, replacement) };
}

function removePane(node: LayoutNode, paneId: string): LayoutNode | null {
  if (node.type === "pane") return node.id === paneId ? null : node;
  if (node.first.type === "pane" && node.first.id === paneId) return node.second;
  if (node.second.type === "pane" && node.second.id === paneId) return node.first;
  const first = removePane(node.first, paneId);
  const second = removePane(node.second, paneId);
  if (!first) return second;
  if (!second) return first;
  return { ...node, first, second };
}

function updateRatio(node: LayoutNode, splitId: string, ratio: number): LayoutNode {
  if (node.type === "pane") return node;
  if (node.id === splitId) return { ...node, ratio };
  return { ...node, first: updateRatio(node.first, splitId, ratio), second: updateRatio(node.second, splitId, ratio) };
}

function TerminalView({ projectPath, terminalId }: { projectPath: string; terminalId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, "Cascadia Mono", monospace',
      fontSize: 14,
      scrollback: 5000,
      theme: {
        background: "#0c0c0c",
        foreground: "#cccccc",
        cursor: "#f2f2f2",
        selectionBackground: "#264f78",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(hostRef.current);
    terminalRef.current = terminal;

    // Windows Terminal / VS Code 的习惯：有选区时 Ctrl+C 复制，没有选区时才把 ^C 发给 shell。
    // Ctrl+Shift+C / Ctrl+Shift+V 始终是复制 / 粘贴。
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown" || !event.ctrlKey) return true;
      const copy = () => {
        const selection = terminal.getSelection();
        if (!selection) return false;
        void navigator.clipboard.writeText(selection);
        return true;
      };
      const paste = () => {
        void navigator.clipboard.readText().then((text) => {
          if (text) window.tango.writeTerminal(terminalId, text);
        });
        return true;
      };
      if (event.code === "KeyC") {
        if (event.shiftKey || terminal.hasSelection()) {
          copy();
          return false;
        }
        return true;
      }
      if (event.code === "KeyV" && event.shiftKey) {
        paste();
        return false;
      }
      return true;
    });

    const removeDataListener = window.tango.onTerminalData((id, data) => {
      if (id === terminalId) terminal.write(data);
    });
    const removeExitListener = window.tango.onTerminalExit((id, exitCode) => {
      if (id === terminalId) terminal.write("\r\n[Process exited with code " + exitCode + "]\r\n");
    });
    const input = terminal.onData((data) => window.tango.writeTerminal(terminalId, data));
    const resize = () => {
      if (!hostRef.current?.clientWidth || !hostRef.current.clientHeight) return;
      fit.fit();
      window.tango.resizeTerminal(terminalId, terminal.cols, terminal.rows);
    };
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    });
    observer.observe(hostRef.current);
    resize();
    terminal.focus();

    void window.tango.startTerminal(projectPath, terminalId).catch((reason: unknown) => {
      setError(errorText(reason, "Could not start terminal"));
    });

    return () => {
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      input.dispose();
      removeDataListener();
      removeExitListener();
      window.tango.closeTerminal(terminalId);
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [projectPath, terminalId]);

  return (
    <div className="terminal-surface">
      <div className="terminal-toolbar">
        <span className="shell-indicator"><i />PowerShell</span>
        <span className="terminal-location" title={projectPath}>{projectPath}</span>
        <button
          className="terminal-focus"
          onClick={() => terminalRef.current?.focus()}
          aria-label="Focus terminal"
          title="Focus terminal"
        ><TerminalIcon size={14} /></button>
      </div>
      {error ? (
        <div className="terminal-error" role="alert">
          <strong>Terminal could not start</strong>
          <span>{error}</span>
        </div>
      ) : (
        <div className="terminal-host" ref={hostRef} />
      )}
    </div>
  );
}

function PaneTree({
  node,
  projectPath,
  activePaneId,
  labels,
  onActivate,
  onSplit,
  onClose,
  onResize,
  onRename,
  fallbackLabel,
}: {
  node: LayoutNode;
  projectPath: string;
  activePaneId: string | null;
  labels: Record<string, string>;
  fallbackLabel(id: string): string;
  onActivate(id: string): void;
  onSplit(id: string | null, direction: "horizontal" | "vertical"): void;
  onClose(id: string): void;
  onResize(id: string, ratio: number): void;
  onRename(id: string, name: string): void;
}) {
  // Double-clicking a shell's name turns it into an input; Enter or blur keeps the name.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (node.type === "pane") {
    return (
      <section className={"layout-pane " + (activePaneId === node.id ? "focused" : "")} onMouseDown={() => onActivate(node.id)}>
        <header className="layout-pane-header">
          {editing === node.id ? (
            <input
              className="pane-title-input"
              autoFocus
              value={draft}
              aria-label="Shell name"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => { onRename(node.id, draft); setEditing(null); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") { onRename(node.id, draft); setEditing(null); }
                if (event.key === "Escape") setEditing(null);
              }}
            />
          ) : (
            <span
              className="pane-title"
              title="Double-click to rename this shell"
              onDoubleClick={() => { setDraft(labels[node.id] ?? fallbackLabel(node.id)); setEditing(node.id); }}
            >
              <i />{labels[node.id] ?? fallbackLabel(node.id)}
            </span>
          )}
          <div className="pane-actions">
            <button onClick={() => onSplit(node.id, "horizontal")} title="Split this shell left or right" aria-label="Split this shell left or right"><Columns2 size={14} /></button>
            <button onClick={() => onSplit(node.id, "vertical")} title="Split this shell above or below" aria-label="Split this shell above or below"><Rows2 size={14} /></button>
            <button onClick={() => onClose(node.id)} title="Close this shell" aria-label="Close this shell"><X size={14} /></button>
          </div>
        </header>
        <TerminalView projectPath={projectPath} terminalId={node.id} />
      </section>
    );
  }

  const firstSize = Math.round(node.ratio * 100);
  const gridTemplate = firstSize + "fr 6px " + (100 - firstSize) + "fr";
  return (
    <div className={"split-tree " + node.direction} style={node.direction === "horizontal"
      ? { gridTemplateColumns: gridTemplate }
      : { gridTemplateRows: gridTemplate }}>
      <PaneTree node={node.first} projectPath={projectPath} activePaneId={activePaneId} labels={labels} fallbackLabel={fallbackLabel} onActivate={onActivate} onSplit={onSplit} onClose={onClose} onResize={onResize} onRename={onRename} />
      <div
        className="splitter"
        role="separator"
        aria-orientation={node.direction === "horizontal" ? "vertical" : "horizontal"}
        onPointerDown={(event) => {
          const parent = event.currentTarget.parentElement;
          if (!parent) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const move = (pointerEvent: PointerEvent) => {
            const bounds = parent.getBoundingClientRect();
            const ratio = node.direction === "horizontal"
              ? (pointerEvent.clientX - bounds.left) / bounds.width
              : (pointerEvent.clientY - bounds.top) / bounds.height;
            onResize(node.id, Math.max(0.15, Math.min(0.85, ratio)));
          };
          const end = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", end);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", end, { once: true });
        }}
      />
      <PaneTree node={node.second} projectPath={projectPath} activePaneId={activePaneId} labels={labels} fallbackLabel={fallbackLabel} onActivate={onActivate} onSplit={onSplit} onClose={onClose} onResize={onResize} onRename={onRename} />
    </div>
  );
}

type MenuItem = { label: string; shortcut?: string; run(): void; danger?: boolean } | { divider: true };

function TitlebarMenu({ label, items, open, onOpen, onClose }: {
  label: string;
  items: MenuItem[];
  open: boolean;
  onOpen(): void;
  onClose(): void;
}) {
  return (
    <div className="titlebar-menu">
      <button
        className={"titlebar-menu-button " + (open ? "open" : "")}
        onClick={() => (open ? onClose() : onOpen())}
        onMouseEnter={() => { if (open) onOpen(); }}
      >
        {label}
      </button>
      {open && (
        <div className="titlebar-dropdown" role="menu" onMouseLeave={onClose}>
          {items.map((item, index) =>
            "divider" in item
              ? <div className="menu-divider" key={"divider" + index} />
              : (
                <button
                  key={item.label}
                  role="menuitem"
                  className={"titlebar-dropdown-item " + (item.danger ? "danger" : "")}
                  onClick={() => { onClose(); item.run(); }}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                </button>
              ))}
        </div>
      )}
    </div>
  );
}

function SortableTaskRow({
  task,
  selected,
  unread,
  renamingId,
  renamingTitle,
  setRenamingTitle,
  onOpen,
  onStartRename,
  onDuplicate,
  onPin,
  onArchive,
  onCommitRename,
  onCancelRename,
  onMenu,
  onContextMenu,
}: {
  task: TaskRecord;
  selected: boolean;
  unread: boolean;
  renamingId: string | null;
  renamingTitle: string;
  setRenamingTitle(value: string): void;
  onOpen(id: string): void;
  onStartRename(task: TaskRecord): void;
  onDuplicate(id: string): void;
  onPin(id: string): void;
  onArchive(id: string): void;
  onCommitRename(id: string): void;
  onCancelRename(): void;
  onMenu(id: string, x: number, y: number): void;
  onContextMenu(id: string, x: number, y: number): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={"task-row " + (selected ? "selected" : "")}>
      <span className="task-drag" {...attributes} {...listeners} aria-label="Reorder task" title="Reorder task">
        <GripVertical size={12} />
      </span>
      {renamingId === task.id ? (
        <input
          className="task-rename"
          autoFocus
          value={renamingTitle}
          onChange={(event) => setRenamingTitle(event.target.value)}
          onBlur={() => onCommitRename(task.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCommitRename(task.id);
            if (event.key === "Escape") onCancelRename();
          }}
        />
      ) : (
        <button
          className="task-link"
          onClick={() => onOpen(task.id)}
          onDoubleClick={() => onStartRename(task)}
          onContextMenu={(event) => {
            event.preventDefault();
            onContextMenu(task.id, event.clientX, event.clientY);
          }}
        >
          <span
            className="task-title"
            title={`${task.title} · ${task.messages.length} ${task.messages.length === 1 ? "message" : "messages"}`}
          >{task.pinned && <Pin size={11} className="task-pin" />}{task.title}</span>
          {unread && <span className="task-unread" title="Finished while you were elsewhere" aria-label="Unread reply" />}
        </button>
      )}
      {renamingId !== task.id && (
        <>
          <button
            className="task-quick"
            aria-label={task.pinned ? "Unpin task" : "Pin task"}
            title={task.pinned ? "Unpin task" : "Pin to top"}
            onClick={(event) => { event.stopPropagation(); onPin(task.id); }}
          >
            <Pin size={12} />
          </button>
          <button
            className="task-quick"
            aria-label="Archive task"
            title="Archive task"
            onClick={(event) => { event.stopPropagation(); onArchive(task.id); }}
          >
            <Archive size={12} />
          </button>
        </>
      )}
      {renamingId !== task.id && (
        <button
          className="task-quick"
          aria-label="Duplicate task"
          title="Duplicate task"
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate(task.id);
          }}
        >
          <Copy size={12} />
        </button>
      )}
      {renamingId !== task.id && (
        <button
          className="task-more"
          aria-label="Task actions"
          title="Task actions"
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            onMenu(task.id, rect.right - 150, rect.bottom + 4);
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      )}
    </div>
  );
}

// Electron wraps IPC failures as "Error invoking remote method 'x:y': Error: <reason>".
// The reason is what the agent's own process said; the wrapper is noise.
// "3 tools" reads better than a wall of rows; the label keeps what is still running visible.
function toolSummary(tools: Array<{ status: string }>) {
  if (tools.length === 0) return "Tools";
  const running = tools.filter((tool) => tool.status === "running").length;
  const failed = tools.filter((tool) => tool.status === "error").length;
  const parts = [`${tools.length} ${tools.length === 1 ? "tool" : "tools"}`];
  if (running) parts.push(`${running} running`);
  if (failed) parts.push(`${failed} failed`);
  return parts.join(" · ");
}

// One line for the tools of a turn, folded or open; live and finished turns look the same.
function ToolActivity({ tools, expanded, onToggle }: {
  tools: Array<{ id: string; name: string; status: string }>;
  expanded: boolean;
  onToggle(): void;
}) {
  return (
    <div className="tool-activity" aria-label="Tool activity" data-expanded={expanded}>
      <button
        type="button"
        className="tool-summary"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        {tools.some((tool) => tool.status === "running") ? <Loader2 size={12} className="spin" /> : <Wrench size={12} />}
        <span className="tool-summary-label">{toolSummary(tools)}</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && tools.map((tool) => {
        const name = tool.name.toLowerCase();
        const ToolIcon = /(bash|shell|command|exec|terminal)/.test(name) ? TerminalSquare
          : /(file|patch|write|edit|read)/.test(name) ? FileText
          : /(search|grep|web|fetch)/.test(name) ? Globe
          : Wrench;
        return (
          <div key={tool.id} className={"tool-row " + tool.status}>
            <ToolIcon size={12} className="tool-icon" />
            <span className="tool-name">{tool.name}</span>
            <span className="tool-status">
              {tool.status === "running" ? <Loader2 size={11} className="spin" />
                : tool.status === "error" ? <AlertCircle size={11} />
                : <CheckCircle2 size={11} />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function errorText(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  let text = error.message;
  for (let i = 0; i < 3 && text.startsWith("Error invoking remote method"); i++) {
    text = text.replace(/^Error invoking remote method '[^']*':\s*(Error:\s*)?/, "");
  }
  return text.trim() || fallback;
}

function App() {
  const [project, setProject] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentStatus["id"] | null>(null);
  const [layoutRoot, setLayoutRoot] = useState<LayoutNode | null>({ type: "pane", id: "terminal-1" });
  const [activeTerminal, setActiveTerminal] = useState<string | null>("terminal-1");
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  // Names people give their shells, keyed by pane id; saved with the layout.
  const [paneLabels, setPaneLabels] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [assistantText, setAssistantText] = useState("");
  // The streamed text as of this instant, so finishing a turn reads it without relying on a
  // state updater that may run more than once.
  const assistantTextRef = useRef("");
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [runningAgent, setRunningAgent] = useState<AgentStatus["id"] | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toolActivity, setToolActivity] = useState<Record<string, Array<{ id: string; name: string; status: string; detail?: string }>>>({});
  const [magpie, setMagpie] = useState<{ available: boolean; version: string | null } | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [appInfo, setAppInfo] = useState<{ version: string; platform: string; electron: string; node: string; dataFolder: string } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const liveTaskRef = useRef<{
    id: string;
    agent: AgentStatus["id"];
    baseMessages: TaskRecord["messages"];
    userMessage: TaskRecord["messages"][number];
    readyLength: number;
    streams: boolean;
  } | null>(null);
  const draftTaskRef = useRef<string | null>(null);
  // Mirror of toolActivity so a turn that is finishing can read the tools it ran without
  // waiting for a re-render.
  const toolActivityRef = useRef<Record<string, Array<{ id: string; name: string; status: string; detail?: string }>>>({});
  // Arrow keys walk the task's earlier prompts; this remembers where the walk is and what was being typed.
  const promptHistoryRef = useRef<{ index: number; draft: string } | null>(null);
  // Which task owns the turn that is running, so "Stop" interrupts that task and not whichever is open.
  const runningTaskRef = useRef<string | null>(null);
  // True while the user's Stop is waiting for the agent, so a turn that ends says it was stopped.
  const stoppedByUserRef = useRef(false);
  // Turns this window started, by task. Their running flag is cleared when they finish,
  // even if the user is looking at another task by then.
  const runningTurnsRef = useRef<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [taskMenu, setTaskMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  // The working list can be folded away when several agents run at once.
  const [runningOpen, setRunningOpen] = useState(true);
  const [taskQuery, setTaskQuery] = useState("");
  const taskSearchRef = useRef<HTMLInputElement>(null);
  const [piCommands, setPiCommands] = useState<Array<{ name: string; description?: string }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  // Finished turns keep their tool list folded into the reply; this remembers which ones were opened.
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  // Filtering the conversation instead of scrolling it; empty query shows everything again.
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState("");
  const chatSearchRef = useRef<HTMLInputElement>(null);
  // A turn that finishes in a task you are not looking at leaves a dot there.
  const [unreadTasks, setUnreadTasks] = useState<Record<string, boolean>>({});
  // Streamed text per task, so a turn keeps writing while another task is open.
  const streamByTaskRef = useRef<Record<string, string>>({});
  const activeTaskRef = useRef<string | null>(null);
  const [copiedConversation, setCopiedConversation] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);

  useEffect(() => {
    void window.tango.getSettings().then(setSettings);
  }, []);

  function renameActiveTask() {
    const task = tasks.find((item) => item.id === activeTask);
    if (!task) return;
    startRename(task);
  }

  // 菜单栏是主入口；这里保留同样的快捷键，窗口焦点在渲染层时也能用。
  useEffect(() => {
    const inField = (target: EventTarget | null) =>
      target instanceof HTMLElement && !!target.closest("input, textarea, [contenteditable='true']");
    const inComposer = (target: EventTarget | null) =>
      target instanceof HTMLElement && !!target.closest(".composer");
    const onKeyDown = (event: KeyboardEvent) => {
      // Plain typing in a field keeps its own shortcuts; keys below intentionally skip that.
      // Escape closes popups from anywhere, and Ctrl+K works from the task search too.
      // Find-in-conversation is worth reaching from the composer too; the composer's own
      // keys (arrows, Enter, /) stay untouched.
      const findInConversation = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f";
      if (inField(event.target) && event.key !== "Escape" && !findInConversation
        && !((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) return;
      // Esc interrupts the turn this task is running, unless a dialog or menu is open to close first.
      if (event.key === "Escape" && running && !stopping && runningTaskRef.current === activeTask
        && !settingsOpen && !shortcutsOpen && !handoffOpen && !paletteOpen && !taskMenu && !openMenu) {
        event.preventDefault();
        void stopTurn();
        return;
      }
      if (event.key === "F2" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        renameActiveTask();
        return;
      }
      // "/" jumps to the command list from anywhere outside a field, so the menu is one key away.
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && activeTask
        && !settingsOpen && !shortcutsOpen && !handoffOpen && !paletteOpen && !taskMenu && !openMenu) {
        event.preventDefault();
        setPrompt("/");
        setSlashIndex(0);
        composerRef.current?.focus();
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      // Ctrl+F searches tasks unless the caret is in the composer.
      // Ctrl+Shift+F filters this conversation; Ctrl+F stays on the task list.
      if (event.key.toLowerCase() === "f" && event.shiftKey && activeTask) {
        event.preventDefault();
        setChatSearchOpen(true);
        window.requestAnimationFrame(() => chatSearchRef.current?.focus());
        return;
      }
      if (event.key.toLowerCase() === "f" && !inComposer(event.target)) {
        event.preventDefault();
        taskSearchRef.current?.focus();
        taskSearchRef.current?.select();
        return;
      }
      if (event.key === ",") { event.preventDefault(); setSettingsOpen(true); }
      if (event.key.toLowerCase() === "n" && event.shiftKey) { event.preventDefault(); renameActiveTask(); return; }
      if (event.key.toLowerCase() === "n") { event.preventDefault(); void createTask(); }
      if (event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
      if (event.key.toLowerCase() === "b") { event.preventDefault(); updateSettings({ sidebarCollapsed: !settings?.sidebarCollapsed }); }
      if (event.key.toLowerCase() === "e" && event.shiftKey && activeTask) {
        event.preventDefault();
        void archiveTaskAction(activeTask, true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Esc closes whichever dialog or menu is open.
  useEffect(() => {
    if (!settingsOpen && !shortcutsOpen && !handoffOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSettingsOpen(false);
      setShortcutsOpen(false);
      setHandoffOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, shortcutsOpen, handoffOpen]);

  // Clicking elsewhere closes the handoff menu.
  useEffect(() => {
    if (!handoffOpen) return;
    const onDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(".conversation-heading")) return;
      setHandoffOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [handoffOpen]);

  // 点击空白处或按 Esc 关掉标题栏菜单。
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    // 菜单内部的点击不能被这次 mousedown 先关掉，否则 item 的 onClick 永远收不到。
    const onPointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(".titlebar")) return;
      close();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  useEffect(() => {
    const task = tasks.find((item) => item.id === activeTask);
    if (activeAgent !== "pi" || !task) {
      setPiCommands([]);
      return;
    }
    let alive = true;
    void window.tango.getPiCommands(task.projectPath)
      .then((commands) => { if (alive) setPiCommands(commands); })
      .catch(() => { if (alive) setPiCommands([]); });
    return () => { alive = false; };
  }, [activeAgent, activeTask, tasks]);

  // Drafts belong to a task: switching away keeps what was typed.
  useEffect(() => {
    if (!activeTask) {
      draftTaskRef.current = null;
      setPrompt("");
      return;
    }
    draftTaskRef.current = activeTask;
    promptHistoryRef.current = null;
    setPrompt(localStorage.getItem("tango.draft." + activeTask) ?? "");
  }, [activeTask]);

  useEffect(() => {
    if (!activeTask || draftTaskRef.current !== activeTask) return;
    if (prompt) localStorage.setItem("tango.draft." + activeTask, prompt);
    else localStorage.removeItem("tango.draft." + activeTask);
  }, [prompt, activeTask]);

  // Grow the composer with the draft instead of showing a scrollbar early.
  useEffect(() => {
    const element = composerRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = Math.min(element.scrollHeight, 220) + "px";
  }, [prompt]);

  // Opening a task shows its newest turn; after that the view only follows the output
  // when the reader is already near the bottom.
  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    if (scrollTaskRef.current !== activeTask) {
      scrollTaskRef.current = activeTask;
      element.scrollTop = element.scrollHeight;
      return;
    }
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distance < 140 || running) element.scrollTop = element.scrollHeight;
  }, [tasks, assistantText, toolActivity, running, activeTask]);

  // Each turn starts with its tool list folded, and switching tasks folds it back.
  useEffect(() => {
    setToolsExpanded(false);
  }, [activeTask, toolActivity[activeTask ?? ""]?.[0]?.id]);

  useEffect(() => window.tango.onAppCommand((command) => {
    if (command === "open-settings") setSettingsOpen(true);
    if (command === "new-task") void createTask();
    if (command === "open-project") void openProject();
    if (command === "show-shortcuts") setShortcutsOpen(true);
  }), [settings, project]);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.width = settings.chatWidth;
    root.style.setProperty("--primary", settings.accent);
    root.style.setProperty("--coral", settings.accent);
  }, [settings]);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
    void window.tango.saveSettings(patch).then(setSettings);
  };
  const [permission, setPermission] = useState<{
    taskId: string;
    agent: "codex" | "dsh" | "pi";
    requestId: number | string;
    title: string;
    detail?: string;
    options: Array<{ optionId: string; name: string; kind?: string }>;
    input?: { placeholder: string; prefill: string };
  } | null>(null);
  const [permissionText, setPermissionText] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const scrollTaskRef = useRef<string | null>(null);

  const refreshAgents = useCallback(async () => {
    setDetecting(true);
    try {
      setAgents(await window.tango.detectAgents());
    } finally {
      setDetecting(false);
    }
  }, []);

  useEffect(() => {
    void window.tango.getWorkspace().then(setProject);
    void window.tango.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
    void window.tango.detectMagpie().then(setMagpie).catch(() => setMagpie({ available: false, version: null }));
    void refreshAgents();
    void window.tango.listTasks().then(setTasks);
    void window.tango.getLayout().then((layout) => {
      if (layout?.root) {
        setLayoutRoot(layout.root);
        setActiveTerminal(layout.activePaneId);
        setPaneLabels(layout.labels ?? {});
      }
      setLayoutLoaded(true);
    });
  }, [refreshAgents]);

  useEffect(() => {
    if (!layoutLoaded || !layoutRoot || !activeTerminal) return;
    void window.tango.saveLayout({ root: layoutRoot, activePaneId: activeTerminal, labels: paneLabels });
  }, [layoutRoot, activeTerminal, paneLabels, layoutLoaded]);

  // 切换任务时清掉上一个任务的流式状态，避免把它的输出显示在另一个任务里。
  useEffect(() => {
    activeTaskRef.current = activeTask;
    assistantTextRef.current = streamByTaskRef.current[activeTask ?? ""] ?? "";
    setAssistantText(assistantTextRef.current);
    setRunning(false);
    setRunningAgent(null);
    setStopping(false);
    // A query belongs to the conversation it was typed in, not the next one.
    setChatSearchOpen(false);
    setChatQuery("");
    // A pending permission stays with its task: switching away hides it, coming back shows it.
  }, [activeTask]);

  useEffect(() => window.tango.onCodexEvent((taskId, event) => {
    // Events keep coming for a task you switched away from; only the screen parts are limited
    // to the open task, the transcript update is not.
    const isOpen = taskId === activeTaskRef.current;
    if (event.type === "delta" && typeof event.text === "string") appendStreamText(taskId, event.text);
    if (event.type === "turn/completed") {
      const text = streamByTaskRef.current[taskId] ?? "";
      const tools = finishTools(taskId);
      resetStreamText(taskId);
      const answer = text.trim() ? text : noAnswerText("codex", tools);
      stoppedByUserRef.current = false;
      if (answer) {
        setTasks((current) => current.map((task) => task.id === taskId
          ? {
              ...task,
              messages: [...task.messages, {
                role: "assistant", agent: "codex", text: answer, createdAt: new Date().toISOString(),
                ...(tools ? { tools } : {}),
              }],
            }
          : task));
      }
      // Whether the reply had text or not, a turn that ended elsewhere is worth the dot.
      if (!isOpen) setUnreadTasks((current) => ({ ...current, [taskId]: true }));
      endTurn(taskId);
    }
    if (event.type === "tool") recordTool(taskId, event as { id?: string; name?: string; status?: string });
    if (event.type === "permission/request") {
      const options = Array.isArray(event.options)
        ? (event.options as Array<{ optionId: string; label?: string; name?: string; kind?: string }>)
          .map((option) => ({ optionId: option.optionId, name: option.label ?? option.name ?? option.optionId, kind: option.kind }))
        : [];
      setPermission({
        taskId,
        agent: "codex",
        requestId: Number(event.requestId),
        title: String(event.title ?? "Codex is asking for permission."),
        detail: typeof event.detail === "string" ? event.detail : undefined,
        options,
      });
    }
    if (event.type === "process/exit" || event.type === "process/error") {
      // A crashed process ends its turn; a later reply for it would only add a line twice.
      endTurn(taskId);
      if (event.type === "process/error" && isOpen) {
        setAssistantText(String(event.message ?? "The agent process could not start"));
      }
    }
  }), []);

  useEffect(() => window.tango.onClaudeEvent((taskId, event) => {
    const isOpen = taskId === activeTaskRef.current;
    if (event.type === "delta" && typeof event.text === "string") appendStreamText(taskId, event.text);
    if (event.type === "tool") recordTool(taskId, event as { id?: string; name?: string; status?: string });
    if (event.type === "turn/completed") endTurn(taskId);
    if (event.type === "process/error" && isOpen) {
      setRunning(false);
      setRunningAgent(null);
      setAssistantText(String(event.message ?? "Claude Code could not start"));
    }
  }), []);
  useEffect(() => window.tango.onDshEvent((taskId, event) => {
    // The process exits right after each turn, so only an unexpected exit while the
    // turn is still running counts as a failure.
    if (event.type === "process/exit") {
      if (liveTaskRef.current?.id === taskId) liveTaskRef.current = null;
      endTurn(taskId);
    }
    if (event.type === "delta" && typeof event.text === "string") appendLiveText(taskId, "dsh", event.text);
    if (event.type === "session/update") {
      const update = event.update as { sessionUpdate?: string; toolCallId?: string; title?: string; status?: string } | undefined;
      if (update?.sessionUpdate === "tool_call" || update?.sessionUpdate === "tool_call_update") {
        recordTool(taskId, {
          id: update.toolCallId,
          name: update.title ?? "tool",
          status: update.status === "completed" ? "done" : update.status === "failed" ? "error" : "running",
        });
      }
    }
    if (event.type === "permission/request") {
      const params = event.params as {
        toolCall?: { title?: string };
        options?: Array<{ optionId: string; name: string; kind?: string }>;
      } | undefined;
      setPermission({
        taskId,
        agent: "dsh",
        requestId: Number(event.requestId),
        title: params?.toolCall?.title ?? "The agent is asking for permission.",
        options: Array.isArray(params?.options) ? params.options : [],
      });
    }
  }), []);
  useEffect(() => window.tango.onPiEvent((taskId, event) => {
    const isOpen = taskId === activeTaskRef.current;
    if (event.type === "delta" && typeof event.text === "string") appendStreamText(taskId, event.text);
    if (event.type === "tool") recordTool(taskId, event as { id?: string; name?: string; status?: string });
    if (event.type === "permission/request") {
      const options = Array.isArray(event.options)
        ? (event.options as Array<{ optionId: string; label?: string; kind?: string }>)
          .map((option) => ({ optionId: option.optionId, name: option.label ?? option.optionId, kind: option.kind }))
        : [];
      setPermission({
        taskId,
        agent: "pi",
        requestId: String(event.requestId),
        title: String(event.title ?? "Pi is asking for input."),
        detail: typeof event.detail === "string" ? event.detail : undefined,
        options,
        input: event.input && typeof event.input === "object"
          ? {
              placeholder: String((event.input as { placeholder?: string }).placeholder ?? ""),
              prefill: String((event.input as { prefill?: string }).prefill ?? ""),
            }
          : undefined,
      });
      setPermissionText(typeof (event.input as { prefill?: string } | undefined)?.prefill === "string"
        ? String((event.input as { prefill?: string }).prefill)
        : "");
    }
    if ((event.type === "agent_end" || event.type === "process/exit" || event.type === "process/error") && isOpen) {
      endTurn(taskId);
    }
  }), []);

  async function answerPermission(optionId: string | null, text?: string) {
    if (!permission) return;
    const current = permission;
    setPermission(null);
    setPermissionText("");
    try {
      if (current.agent === "codex") {
        await window.tango.codexRespondPermission(current.taskId, Number(current.requestId), optionId);
      } else if (current.agent === "pi") {
        await window.tango.piRespondUi(current.taskId, String(current.requestId), optionId, text);
      } else {
        await window.tango.dshRespondPermission(current.taskId, Number(current.requestId), optionId);
      }
    } catch (error) {
      setAssistantText(errorText(error, "Could not answer the permission request"));
    }
  }

  // Folders this app has tasks in, newest first, so switching back needs no dialog.
  const recentProjects = (() => {
    const latest = new Map<string, string>();
    for (const task of tasks) {
      const at = task.messages.at(-1)?.createdAt ?? "";
      if (!latest.has(task.projectPath) || at > (latest.get(task.projectPath) ?? "")) latest.set(task.projectPath, at);
    }
    return [...latest.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([projectPath]) => projectPath)
      .filter((projectPath) => projectPath !== project);
  })();

  async function switchProject(projectPath: string) {
    setWorkspaceError(null);
    try {
      const selected = await window.tango.setWorkspace(projectPath);
      setProject(selected);
      setActiveTask(null);
      setActiveAgent(null);
    } catch (error) {
      setWorkspaceError(errorText(error, "Could not switch project"));
    }
  }

  async function openProject() {
    setWorkspaceError(null);
    try {
      const selected = await window.tango.openWorkspace();
      if (selected) setProject(selected);
    } catch (error) {
      setWorkspaceError(errorText(error, "Could not open the folder picker"));
    }
  }

  const projectTasks = tasks
    .filter((task) => task.projectPath === project && !task.archived)
    .filter((task) => !taskQuery.trim() || task.title.toLowerCase().includes(taskQuery.trim().toLowerCase()))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  const archivedTasks = tasks.filter((task) => task.projectPath === project && task.archived);
  // Running tasks float to the top so a busy agent stays visible while you read another task.
  // They come from every task in the project, not the search results: a busy agent must not
  // disappear just because the task list is filtered.
  // A running flag written by a previous session is stale: this window tracks the turns it
  // started. The task itself still shows the "did not finish" note when opened.
  const runningTasks = tasks.filter((task) => task.projectPath === project && !task.archived
    && task.running && runningTurnsRef.current[task.id]);
  // The composer's Stop follows this task's own state, not whichever turn was started last:
  // a background turn in another task must not disable sending here.
  const isActiveTaskRunning = running && runningTaskRef.current === activeTask;

  // The elapsed-time labels only need a tick while something is actually running.
  useEffect(() => {
    if (runningTasks.length === 0) return;
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runningTasks.length]);

  function formatClock(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // A running turn shows how long it has been going, so a slow turn is visible at a glance.
  function formatElapsed(startedAt: string | undefined, now: number) {
    const started = startedAt ? new Date(startedAt).getTime() : NaN;
    if (Number.isNaN(started)) return "";
    const seconds = Math.max(0, Math.floor((now - started) / 1000));
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
    return seconds > 0 ? `${seconds}s` : "just started";
  }

  // Streamed text lives in state for the screen and in a ref for handlers that finish a turn;
  // a state updater can run twice, so the message must never be appended from inside one.
  function appendStreamText(taskId: string, text: string) {
    const next = (streamByTaskRef.current[taskId] ?? "") + text;
    streamByTaskRef.current = { ...streamByTaskRef.current, [taskId]: next };
    if (taskId !== activeTaskRef.current) return;
    assistantTextRef.current = next;
    setAssistantText(next);
  }

  function resetStreamText(taskId?: string) {
    if (taskId) {
      const next = { ...streamByTaskRef.current };
      delete next[taskId];
      streamByTaskRef.current = next;
      if (taskId !== activeTaskRef.current) return;
    } else {
      streamByTaskRef.current = {};
    }
    assistantTextRef.current = "";
    setAssistantText("");
  }

  // A turn can end without any streamed text when the agent fails or stops. The transcript
  // should still say so, and the turn's own tool list is the reason it has.
  function noAnswerText(agent: AgentStatus["id"], tools: Array<{ name: string; status: string }> | undefined): string | null {
    const name = agents.find((item) => item.id === agent)?.name ?? agent;
    if (tools?.length) {
      return `No reply was written. ${name} ran ${toolSummary(tools)} before stopping; check the tool list below.`;
    }
    return stoppedByUserRef.current ? `${name} was stopped before it answered.` : `${name} ended without a reply.`;
  }

  // A finished turn folds its tools into the reply, so they stay visible after the task is
  // reopened instead of vanishing with the live list.
  function finishTools(taskId: string): Array<{ id: string; name: string; status: string; detail?: string }> | undefined {
    const tools = toolActivityRef.current[taskId] ?? [];
    if (tools.length === 0) return undefined;
    toolActivityRef.current = { ...toolActivityRef.current, [taskId]: [] };
    setToolActivity((current) => (current[taskId]?.length ? { ...current, [taskId]: [] } : current));
    // A tool still marked running when the turn ends was cut off; show it as finished.
    return tools.map((tool) => ({ ...tool, status: tool.status === "running" ? "done" : tool.status }));
  }

  // Only the turn that this window started can end it; a completion for a turn that was
  // already finished elsewhere must not clear a different task's running state.
  function endTurn(taskId: string) {
    if (!runningTurnsRef.current[taskId]) return;
    // A request that was never answered belongs to this turn; do not leave it on screen.
    setPermission((current) => (current?.taskId === taskId ? null : current));
    delete runningTurnsRef.current[taskId];
    setTasks((current) => current.map((task) => (task.id === taskId && task.running ? { ...task, running: undefined } : task)));
    if (runningTaskRef.current !== taskId) return;
    runningTaskRef.current = null;
    setRunning(false);
    setRunningAgent(null);
    setStopping(false);
  }

  // Streamed answer text is appended to the turn's assistant message as it arrives.
  function appendLiveText(taskId: string, agent: AgentStatus["id"], text: string) {
    setTasks((current) => current.map((task) => {
      if (task.id !== taskId) return task;
      const live = liveTaskRef.current;
      if (!live || live.id !== taskId || !live.streams) return task;
      if (task.messages.length <= live.readyLength) {
        return {
          ...task,
          messages: [...live.baseMessages, live.userMessage, { role: "assistant" as const, agent, text, createdAt: new Date().toISOString() }],
        };
      }
      const last = task.messages[task.messages.length - 1];
      if (last.role !== "assistant") return task;
      return { ...task, messages: [...task.messages.slice(0, -1), { ...last, text: last.text + text }] };
    }));
  }

  // Tools belong to the turn that is running when they arrive. Finished turns keep their
  // own tools in the transcript; this map only holds what the live turn has done so far.
  function recordTool(taskId: string, tool: { id?: string; name?: string; status?: string; detail?: string }) {
    const id = String(tool.id ?? tool.name ?? "tool");
    const name = tool.name ? String(tool.name) : undefined;
    const detail = typeof tool.detail === "string" && tool.detail ? tool.detail.slice(0, 400) : undefined;
    const status = tool.status === "running" ? "running" : tool.status === "error" ? "error" : "done";
    setToolActivity((current) => {
      const list = current[taskId] ?? [];
      const index = list.findIndex((item) => item.id === id);
      const next = index >= 0
        ? list.map((item, i) => (i === index ? { ...item, name: name ?? item.name, status, detail: detail ?? item.detail } : item))
        : [...list, { id, name: name ?? "tool", status, detail }].slice(-40);
      const merged = { ...current, [taskId]: next };
      toolActivityRef.current = merged;
      return merged;
    });
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: { active: { id: string | number }; over: { id: string | number } | null }) {
    if (!event.over || event.active.id === event.over.id) return;
    const ids = projectTasks.map((task) => task.id);
    const from = ids.indexOf(String(event.active.id));
    const to = ids.indexOf(String(event.over.id));
    if (from < 0 || to < 0) return;
    const nextIds = arrayMove(ids, from, to);
    setTasks((current) => {
      const ordered = nextIds.map((id) => current.find((task) => task.id === id)).filter((task): task is TaskRecord => Boolean(task));
      const others = current.filter((task) => !nextIds.includes(task.id));
      return [...ordered, ...others];
    });
    void window.tango.reorderTasks(nextIds);
  }

  function openTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    // Reopening a task selects the agent that answered it last, so its native session keeps going.
    const lastAgent = [...(task?.messages ?? [])].reverse()
      .find((message) => message.role === "assistant")?.agent;
    const remembered = (["codex", "claude", "dsh", "pi"] as const).find((id) => id === lastAgent);
    setActiveTask(taskId);
    setUnreadTasks((current) => (current[taskId] ? { ...current, [taskId]: false } : current));
    setActiveAgent(remembered ?? settings?.defaultAgent ?? "codex");
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  // Up walks back through this task's prompts; Down walks forward and finally restores the draft.
  function recallPrompt(direction: 1 | -1) {
    const task = tasks.find((item) => item.id === activeTask);
    if (!task) return;
    const history = task.messages
      .filter((message) => message.role === "user")
      .map((message) => message.text)
      .reverse();
    if (!history.length) return;
    const cursor = promptHistoryRef.current;
    const nextIndex = cursor ? cursor.index + direction : (direction === 1 ? 0 : -1);
    if (nextIndex < 0) {
      promptHistoryRef.current = null;
      setPrompt(cursor?.draft ?? prompt);
    } else {
      if (nextIndex >= history.length) return;
      promptHistoryRef.current = { index: nextIndex, draft: cursor?.draft ?? prompt };
      setPrompt(history[nextIndex]);
    }
    // The caret belongs at the end of recalled text, not where it was before.
    window.requestAnimationFrame(() => {
      const element = composerRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    });
  }

  function startRename(task: TaskRecord) {
    setRenamingId(task.id);
    setRenamingTitle(task.title);
  }

  async function commitRename(taskId: string) {
    const title = renamingTitle.trim();
    setRenamingId(null);
    if (!title) return;
    const updated = await window.tango.renameTask(taskId, title);
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, title: updated.title } : task)));
  }

  async function pinTaskAction(taskId: string, pinned: boolean) {
    setTaskMenu(null);
    const updated = await window.tango.pinTask(taskId, pinned);
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, pinned: updated.pinned } : task)));
  }

  async function archiveTaskAction(taskId: string, archived: boolean) {
    setTaskMenu(null);
    // Hiding a busy task would leave its agent running with nowhere to answer.
    const task = tasks.find((item) => item.id === taskId);
    if (archived && (task?.running || runningTurnsRef.current[taskId])) {
      setAssistantText("Stop the current turn before archiving this task.");
      return;
    }
    const updated = await window.tango.archiveTask(taskId, archived);
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, archived: updated.archived } : task)));
    if (archived && activeTask === taskId) {
      setActiveTask(null);
      setActiveAgent(null);
    }
  }

  async function toggleArchiveActive() {
    const task = tasks.find((item) => item.id === activeTask);
    if (!task) return;
    if (task.running) {
      setAssistantText("Stop the current turn before archiving this task.");
      return;
    }
    await archiveTaskAction(task.id, !task.archived);
  }

  async function deleteActiveTask() {
    if (activeTask) await deleteTaskAction(activeTask);
  }

  async function togglePinActive() {
    const task = tasks.find((item) => item.id === activeTask);
    if (task) await pinTaskAction(task.id, !task.pinned);
  }

  async function deleteTaskAction(taskId: string) {
    setTaskMenu(null);
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    if (target.running || runningTurnsRef.current[taskId]) {
      setAssistantText("Stop the current turn before deleting this task.");
      return;
    }
    if (!window.confirm(`Delete "${target.title}"? This cannot be undone.`)) return;
    try {
      await window.tango.deleteTask(taskId);
    } catch (error) {
      setAssistantText(errorText(error, "Could not delete this task"));
      return;
    }
    setTasks((current) => current.filter((task) => task.id !== taskId));
    if (activeTask === taskId) {
      setActiveTask(null);
      setActiveAgent(null);
    }
  }

  // A duplicate is a new task with the same transcript; native sessions are not copied,
  // because an agent session belongs to the task that created it.
  async function duplicateTask(taskId: string) {
    const source = tasks.find((task) => task.id === taskId);
    if (!source) return;
    try {
      const copy = await window.tango.duplicateTask(taskId);
      setTasks((current) => [copy, ...current]);
      setActiveTask(copy.id);
      setUnreadTasks((current) => (current[copy.id] ? { ...current, [copy.id]: false } : current));
      setActiveAgent((["codex", "claude", "dsh", "pi"] as const).find((id) =>
        id === [...source.messages].reverse().find((message) => message.role === "assistant")?.agent)
        ?? settings?.defaultAgent ?? "codex");
    } catch (error) {
      setAssistantText(errorText(error, "Could not duplicate this task"));
    }
  }

  async function createTask() {
    if (!project) return;
    const task = await window.tango.createTask("New task", project);
    setTasks((current) => [task, ...current]);
    setActiveTask(task.id);
    setActiveAgent(settings?.defaultAgent ?? "codex");
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }
  async function startTurn(agent: AgentStatus["id"], task: TaskRecord, text: string) {
    setPrompt("");
    promptHistoryRef.current = null;
    resetStreamText(task.id);
    assistantTextRef.current = "";
    setAssistantText("");
    setToolActivity((current) => (current[task.id]?.length ? { ...current, [task.id]: [] } : current));
    toolActivityRef.current = { ...toolActivityRef.current, [task.id]: [] };
    setRunning(true);
    setStopping(false);
    setRunningAgent(agent);
    runningTaskRef.current = task.id;
    runningTurnsRef.current[task.id] = true;
    // Show it in the sidebar at once; the main process writes the same flag to tasks.json.
    setTasks((current) => current.map((item) => item.id === task.id
      ? { ...item, running: { agent, startedAt: new Date().toISOString() } }
      : item));
    const waitsForTurnEnd = agent !== "codex";
    const baseMessages = task.messages;
    // The prompt is also the turn's name until the task is renamed by hand.
    const userMessage = { role: "user" as const, agent, text, createdAt: new Date().toISOString() };
    const taskTitle = task.title === "New task" ? titleFromPrompt(text) : null;
    // DSH streams its answer as `delta` events. Those are written straight into the task
    // so the live text and the finished transcript are the same message, not shown twice.
    liveTaskRef.current = { id: task.id, agent, baseMessages, userMessage, readyLength: baseMessages.length + 1, streams: agent === "dsh" };
    // Show the prompt as soon as it is sent; the agent's answer lands when the turn reports back.
    setTasks((current) => current.map((item) => item.id === task.id
      ? { ...item, ...(taskTitle ? { title: taskTitle } : {}), messages: [...item.messages, userMessage] }
      : item));
    if (taskTitle) void window.tango.renameTask(task.id, taskTitle);
    // The prompt is already in the transcript. DSH writes its answer as it streams, so the
    // reported answer is only appended when the transcript does not already end with it.
    const appendTurn = (answer: string, patch: Partial<TaskRecord>) => {
      const tools = finishTools(task.id);
      const spoken = answer.trim() ? answer : noAnswerText(agent, tools);
      setTasks((current) => current.map((item) => {
        if (item.id !== task.id) return item;
        const messages = [...item.messages];
        const last = messages[messages.length - 1];
        const alreadyShown = Boolean(answer) && last?.role === "assistant" && last.text.trim() === answer.trim();
        if (spoken && !alreadyShown) {
          messages.push({ role: "assistant", agent, text: spoken, createdAt: new Date().toISOString(), ...(tools ? { tools } : {}) });
        } else if (alreadyShown && tools) {
          messages[messages.length - 1] = { ...last, tools };
        }
        return { ...item, ...patch, messages };
      }));
      liveTaskRef.current = null;
      resetStreamText(task.id);
      if (task.id !== activeTaskRef.current) setUnreadTasks((current) => ({ ...current, [task.id]: true }));
    };
    try {
      if (agent === "pi") {
        const result = await window.tango.runPi(task.id, task.projectPath, text);
        appendTurn(result.answer, { piSessionFile: result.sessionFile });
      } else if (agent === "dsh") {
        const result = await window.tango.runDsh(task.id, task.projectPath, text);
        appendTurn(result.answer, { dshSessionId: result.sessionId });
      } else if (agent === "claude") {
        const result = await window.tango.runClaude(task.id, task.projectPath, text);
        appendTurn(result.answer, { claudeSessionId: result.sessionId });
      } else if (task.threadId) {
        await window.tango.codexSend(task.id, text);
        appendTurn("", {});
      } else {
        const threadId = await window.tango.codexStart(task.id, task.projectPath, text);
        appendTurn("", { threadId });
      }
    } catch (error) {
      // The prompt is already in the transcript; a failed turn leaves why there in a line.
      const tools = finishTools(task.id);
      const reason = errorText(error, "Could not start the agent");
      resetStreamText(task.id);
      setTasks((current) => current.map((item) => item.id === task.id
        ? {
            ...item,
            messages: [...item.messages, {
              role: "assistant", agent, text: `The turn could not run: ${reason}`, createdAt: new Date().toISOString(),
              ...(tools ? { tools } : {}),
            }],
          }
        : item));
      if (task.id !== activeTaskRef.current) setUnreadTasks((current) => ({ ...current, [task.id]: true }));
      endTurn(task.id);
    } finally {
      if (waitsForTurnEnd) endTurn(task.id);
    }
  }

  async function submitPrompt() {
    const text = prompt.trim();
    const task = tasks.find((item) => item.id === activeTask);
    if (!text || !task || !activeAgent) return;
    await startTurn(activeAgent, task, text);
  }

  // A handoff is a labelled selection of the recent turns, not an agent-written
  // summary: the target sees who said what and continues from there.
  function handoffContext(task: TaskRecord, target: AgentStatus["id"]) {
    const source = agents.find((agent) => agent.id === activeAgent)?.name ?? activeAgent ?? "another agent";
    const recent = task.messages.slice(-8)
      .map((message) => {
        const who = message.role === "user"
          ? "User"
          : agents.find((agent) => agent.id === message.agent)?.name ?? message.agent;
        // Tools belong to the turn, so the target can see what was already tried.
        const tools = message.role === "assistant" && message.tools?.length
          ? "\n(tools: " + message.tools.map((tool) => tool.name + (tool.status === "error" ? " failed" : "")).join(", ") + ")"
          : "";
        // One very long answer would crowd out the rest of the handoff.
        const text = message.text.length > 1500 ? message.text.slice(0, 1500) + "\n… (truncated)" : message.text;
        return `[${who}] ${text}${tools}`;
      })
      .join("\n\n");
    return [
      `Handoff from ${source}.`,
      `Task: ${task.title}`,
      recent ? `Recent turns:\n\n${recent}` : "No earlier turns.",
      `Continue this task from here as ${agents.find((agent) => agent.id === target)?.name ?? target}. Keep the same goal and report what you changed and what is still pending.`,
    ].join("\n\n");
  }

  async function handoffTo(target: AgentStatus["id"]) {
    setHandoffOpen(false);
    const task = tasks.find((item) => item.id === activeTask);
    if (!task) return;
    if (running) {
      setAssistantText("Stop the current turn before handing the task off.");
      return;
    }
    setActiveAgent(target);
    await startTurn(target, task, handoffContext(task, target));
  }

  async function stopTurn(taskId = activeTask) {
    if (!taskId || stopping) return;
    setStopping(true);
    stoppedByUserRef.current = true;
    try {
      const agent = runningAgent ?? activeAgent;
      if (agent === "pi") await window.tango.piInterrupt(taskId);
      else if (agent === "dsh") await window.tango.dshInterrupt(taskId);
      else if (agent === "claude") await window.tango.claudeInterrupt(taskId);
      else await window.tango.codexInterrupt(taskId);
    } catch (error) {
      stoppedByUserRef.current = false;
      setAssistantText(errorText(error, "Could not stop the agent"));
      setStopping(false);
    }
  }

  // The transcript leaves Tango as readable markdown, with the same speaker labels the
  // screen shows, so it can be pasted into an issue or another agent.
  async function copyConversation() {
    const task = tasks.find((item) => item.id === activeTask);
    if (!task || task.messages.length === 0) return;
    const lines: string[] = [`# ${task.title}`, ""];
    for (const message of task.messages) {
      const who = message.role === "user"
        ? "You"
        : agents.find((agent) => agent.id === message.agent)?.name ?? message.agent;
      lines.push(`**${who}** · ${formatClock(message.createdAt)}`, "", message.text, "");
      // Tools are part of how the answer was produced, so the copied transcript keeps them.
      if (message.role === "assistant" && message.tools?.length) {
        lines.push(`_Tools: ${message.tools.map((tool) => tool.name + (tool.status === "error" ? " (failed)" : "")).join(", ")}_`, "");
      }
    }
    await navigator.clipboard.writeText(lines.join("\n").trimEnd() + "\n");
    setCopiedConversation(true);
    window.setTimeout(() => setCopiedConversation(false), 1500);
  }

  function splitPane(paneId: string | null, direction: "horizontal" | "vertical") {
    const id = "terminal-" + crypto.randomUUID();
    setLayoutRoot((root) => root
      ? replacePane(root, paneId ?? paneIds(root)[0], {
          type: "split", id: "split-" + crypto.randomUUID(), direction, ratio: 0.5,
          first: { type: "pane", id: paneId ?? paneIds(root)[0] }, second: { type: "pane", id },
        })
      : { type: "pane", id });
    setActiveTerminal(id);
    setActiveAgent(null);
  }

  function renamePane(id: string, name: string) {
    const trimmed = name.trim().slice(0, 40);
    setPaneLabels((current) => {
      const next = { ...current };
      if (trimmed) next[id] = trimmed;
      else delete next[id];
      return next;
    });
  }

  function closePane(id: string) {
    if (!layoutRoot) return;
    const remaining = paneIds(layoutRoot).filter((paneId) => paneId !== id);
    // 关掉最后一个 shell 是允许的：画布变空，用「新建 shell」再开一个。
    setLayoutRoot(removePane(layoutRoot, id));
    if (activeTerminal === id) setActiveTerminal(remaining[0] ?? null);
  }

  const activeMessages = tasks.find((task) => task.id === activeTask)?.messages ?? [];

  // The chip reflects what this task actually used last; a fresh task falls back to the
  // selected agent so the header still says who will answer.
  const activeTaskRecord = tasks.find((task) => task.id === activeTask);

  // The window title names the task, so the taskbar and window switcher stay useful.
  const activeTitle = activeTaskRecord?.title;
  useEffect(() => {
    document.title = activeTitle ? `${activeTitle} — Tango` : "Tango";
  }, [activeTitle]);
  const agentIds: Array<AgentStatus["id"]> = ["codex", "claude", "dsh", "pi"];
  const lastAgent = [...activeTaskRecord?.messages ?? []].reverse()
    .find((message) => message.role === "assistant")?.agent;
  const historicalAgent = agentIds.find((id) => id === lastAgent);
  const headerAgent: AgentStatus["id"] | undefined = activeAgent ?? historicalAgent
    ?? (activeTaskRecord?.threadId ? "codex" : undefined);

  type ToolItem = { id: string; name: string; status: string; detail?: string };
  type ChatRow =
    | { kind: "message"; id: string; message: TaskRecord["messages"][number] }
    | { kind: "stream"; id: string }
    | { kind: "tools"; id: string; tools: ToolItem[]; live: boolean }
    | { kind: "divider"; id: string; title: string; detail: string };
  type TurnGap = "handoff" | "quiet" | "resumed";

  // A long pause or an agent switch should be visible in the transcript, not only in timestamps.
  function turnGap(previous: TaskRecord["messages"][number], next: TaskRecord["messages"][number]): TurnGap | null {
    const before = previous.role === "user" ? previous.agent : previous.agent;
    const after = next.role === "user" ? next.agent : next.agent;
    if (previous.role === "assistant" && next.role === "user" && before !== after) return "handoff";
    const from = new Date(previous.createdAt).getTime();
    const to = new Date(next.createdAt).getTime();
    if (Number.isNaN(from) || Number.isNaN(to)) return null;
    const minutes = Math.round((to - from) / 60000);
    if (minutes >= 60 * 6) return "resumed";
    if (minutes >= 30) return "quiet";
    return null;
  }

  const agentName = (id: string) => agents.find((agent) => agent.id === id)?.name ?? id;

  // Every reply sits with the tools it ran; the live turn keeps a provisional row until it ends.
  const chatNeedle = chatQuery.trim().toLowerCase();
  const filteredMessages = chatSearchOpen && chatNeedle
    ? activeMessages.filter((message) => message.text.toLowerCase().includes(chatNeedle))
    : activeMessages;
  const chatRows: ChatRow[] = [];
  filteredMessages.forEach((message, index) => {
    // Gaps only make sense between neighbours in the unfiltered list.
    if (!chatNeedle && index > 0) {
      const gap = turnGap(filteredMessages[index - 1], message);
      if (gap) {
        const previous = filteredMessages[index - 1];
        const createdAt = new Date(previous.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        const title = gap === "handoff" ? `Handed off to ${agentName(message.agent)}` : gap === "resumed" ? "Conversation resumed" : "Pause";
        const detail = gap === "handoff"
          ? `${agentName(previous.agent)} finished the last turn; ${agentName(message.agent)} takes over from here.`
          : gap === "resumed"
            ? `The last turn ended ${createdAt}; this one starts after a longer break.`
            : `Quiet for a while: the previous turn was at ${createdAt}.`;
        chatRows.push({ kind: "divider", id: "d-" + message.createdAt, title, detail });
      }
    }
    chatRows.push({ kind: "message", id: "m-" + message.createdAt + "-" + index, message });
    if (message.role === "assistant" && (message.tools?.length ?? 0) > 0) {
      chatRows.push({ kind: "tools", id: "t-" + message.createdAt, tools: message.tools as ToolItem[], live: false });
    }
  });
  if (assistantText || (running && !liveTaskRef.current?.streams)) chatRows.push({ kind: "stream", id: "stream" });
  const liveTools = toolActivity[activeTask ?? ""] ?? [];
  if (liveTools.length > 0) chatRows.push({ kind: "tools", id: "tools-live", tools: liveTools, live: true });

  const chatVirtualizer = useVirtualizer({
    count: chatRows.length,
    getScrollElement: () => messagesRef.current,
    estimateSize: () => 120,
    overscan: 8,
  });
  const virtualRows = chatVirtualizer.getVirtualItems();

  const paletteItems: PaletteItem[] = [
    { id: "a-new", group: "Actions", label: "New task", hint: "Ctrl N", run: () => void createTask() },
    { id: "a-settings", group: "Actions", label: "Settings", hint: "Ctrl ,", run: () => setSettingsOpen(true) },
    { id: "a-rename", group: "Actions", label: "Rename task", hint: "Ctrl Shift N", run: () => renameActiveTask() },
    { id: "a-archive", group: "Actions", label: "Archive task", hint: "Ctrl Shift E", run: () => { if (activeTask) void archiveTaskAction(activeTask, true); } },
    { id: "a-project", group: "Actions", label: "Open project folder", run: () => void openProject() },
    ...(activeTask ? [{
      id: "a-find",
      group: "Actions" as const,
      label: "Find in this conversation",
      hint: "Ctrl Shift F",
      run: () => { setChatSearchOpen(true); window.requestAnimationFrame(() => chatSearchRef.current?.focus()); },
    }] : []),
    ...(activeTask ? [{
      id: "a-duplicate",
      group: "Actions" as const,
      label: "Duplicate task",
      run: () => void duplicateTask(activeTask),
    }] : []),
    { id: "a-shell", group: "Actions", label: "Show terminal", run: () => setActiveAgent(null) },
    {
      id: "a-theme", group: "Actions", label: "Toggle light / dark theme",
      run: () => updateSettings({ theme: settings?.theme === "dark" ? "light" : "dark" }),
    },
    ...recentProjects.slice(0, 5).map((projectPath): PaletteItem => ({
      id: "p-" + projectPath,
      group: "Projects",
      label: "Switch to " + projectLabel(projectPath),
      hint: projectPath,
      run: () => void switchProject(projectPath),
    })),
    ...tasks.map((task): PaletteItem => ({
      id: "t-" + task.id,
      group: "Tasks",
      label: task.title,
      hint: task.archived ? "archived" : undefined,
      run: () => openTask(task.id),
    })),
    ...agents.filter((agent) => agent.available).map((agent): PaletteItem => ({
      id: "g-" + agent.id,
      group: "Agents",
      label: agent.name,
      hint: agent.version ?? undefined,
      run: () => { setActiveAgent(agent.id); if (!activeTask) createTask(); },
    })),
  ];

  const appMenus: Array<{ label: string; items: MenuItem[] }> = [
    {
      label: "Tango",
      items: [
        { label: "Settings…", shortcut: "Ctrl+,", run: () => setSettingsOpen(true) },
        { label: "New Task", shortcut: "Ctrl+N", run: () => void createTask() },
        { label: "Rename Task", shortcut: "F2", run: () => renameActiveTask() },
        { label: "Archive Task", shortcut: "Ctrl+Shift+E", run: () => { if (activeTask) void archiveTaskAction(activeTask, true); } },
        { label: "Open Project…", run: () => void openProject() },
        { divider: true },
        { label: "Quit", run: () => void window.tango.runAppAction("quit") },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", run: () => void window.tango.runAppAction("edit:undo") },
        { label: "Redo", shortcut: "Ctrl+Shift+Z", run: () => void window.tango.runAppAction("edit:redo") },
        { divider: true },
        { label: "Cut", shortcut: "Ctrl+X", run: () => void window.tango.runAppAction("edit:cut") },
        { label: "Copy", shortcut: "Ctrl+C", run: () => void window.tango.runAppAction("edit:copy") },
        { label: "Paste", shortcut: "Ctrl+V", run: () => void window.tango.runAppAction("edit:paste") },
        { label: "Select All", shortcut: "Ctrl+A", run: () => void window.tango.runAppAction("edit:selectAll") },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Toggle Sidebar", shortcut: "Ctrl+B", run: () => updateSettings({ sidebarCollapsed: !settings?.sidebarCollapsed }) },
        { label: "Reload", shortcut: "Ctrl+R", run: () => void window.tango.runAppAction("view:reload") },
        { label: "Developer Tools", shortcut: "Ctrl+Shift+I", run: () => void window.tango.runAppAction("view:devtools") },
        { divider: true },
        { label: "Zoom In", run: () => void window.tango.runAppAction("view:zoomIn") },
        { label: "Zoom Out", run: () => void window.tango.runAppAction("view:zoomOut") },
        { label: "Reset Zoom", run: () => void window.tango.runAppAction("view:resetZoom") },
        { divider: true },
        { label: "Full Screen", shortcut: "F11", run: () => void window.tango.runAppAction("view:fullscreen") },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Command Palette", shortcut: "Ctrl+K", run: () => setPaletteOpen(true) },
        { label: "Keyboard Shortcuts", shortcut: "Ctrl+/", run: () => setShortcutsOpen(true) },
        { label: "About Tango", run: () => void window.tango.runAppAction("about") },
      ],
    },
  ];
  const slashCommands: Array<{ name: string; label: string; insert?: string; run?: () => void }> = [
    { name: "new", label: "New task", run: () => void createTask() },
    { name: "settings", label: "Open settings", run: () => setSettingsOpen(true) },
    { name: "shell", label: "Show terminal", run: () => setActiveAgent(null) },
    { name: "project", label: "Open project folder", run: () => void openProject() },
    { name: "rename", label: "Rename this task", run: () => renameActiveTask() },
    { name: "archive", label: "Archive or restore this task", run: () => void toggleArchiveActive() },
    { name: "unarchive", label: "Restore this task from Archived", run: () => void toggleArchiveActive() },
    { name: "pin", label: "Pin or unpin this task", run: () => void togglePinActive() },
    { name: "delete", label: "Delete this task", run: () => void deleteActiveTask() },
    { name: "clear", label: "Clear the input", run: () => { /* handled by caller */ } },
    ...piCommands.map((command) => ({
      name: command.name,
      label: command.description?.split(/\n/)[0].slice(0, 72) ?? "Pi command",
      insert: "/" + command.name,
    })),
  ];
  const slashQuery = prompt.startsWith("/") && !prompt.includes(" ") ? prompt.slice(1).toLowerCase() : null;
  const slashItems = slashQuery === null
    ? []
    : slashCommands.filter((command) => command.name.toLowerCase().startsWith(slashQuery));
  const slashOpen = slashItems.length > 0;

  function runSlash(index: number) {
    const command = slashItems[index];
    if (!command) return;
    setSlashIndex(0);
    if (command.insert) {
      setPrompt(command.insert + " ");
      composerRef.current?.focus();
      return;
    }
    setPrompt("");
    if (command.name !== "clear") command.run?.();
  }

  const projectName = project ? projectLabel(project) : undefined;
  return (
    <div className={"app-shell" + (settings?.sidebarCollapsed ? " sidebar-collapsed" : "")}>
      <header className="titlebar">
        <button
          className="titlebar-icon"
          aria-label={settings?.sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          title="Toggle sidebar (Ctrl+B)"
          onClick={() => updateSettings({ sidebarCollapsed: !settings?.sidebarCollapsed })}
        >
          <PanelLeft size={15} />
        </button>
        <div className="titlebar-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation">
              <g transform="rotate(24 12 12)">
                <path d="M12 2a10 10 0 1 0 0 20 5 5 0 0 1 0-10 5 5 0 0 0 0-10Z" fill="var(--fg)" />
                <path d="M12 2a10 10 0 1 1 0 20 5 5 0 0 0 0-10 5 5 0 0 1 0-10Z" fill="var(--primary)" />
              </g>
            </svg>
          </span>
          <span className="brand-name">Tango</span>
        </div>
        <nav className="titlebar-menus">
          {appMenus.map((menu) => (
            <TitlebarMenu
              key={menu.label}
              label={menu.label}
              items={menu.items}
              open={openMenu === menu.label}
              onOpen={() => setOpenMenu(menu.label)}
              onClose={() => setOpenMenu(null)}
            />
          ))}
        </nav>
        <div className="titlebar-fill" />
      </header>

      <div className="app-body">
      <aside className="sidebar">
        <div className="sidebar-label">PROJECT</div>
        <button className="project-button" onClick={() => void openProject()}>
          <FolderIcon />
          <span>{project ? "Change project" : "Open project"}</span>
          <span className="plus"><Plus size={15} /></span>
        </button>

        {project ? (
          <div className="project-current" title={project}>
            <span className="project-dot" />
            {/* The folder name is what the user reads; the full path stays in the tooltip and row title. */}
            <span className="project-folder">{projectName}</span>
          </div>
        ) : (
          <p className="sidebar-hint">No project selected.</p>
        )}
        {recentProjects.length > 0 && (
          <>
            <div className="sidebar-label">RECENT</div>
            <ul className="recent-projects">
              {recentProjects.slice(0, 5).map((projectPath) => (
                <li key={projectPath}>
                  <button className="recent-project" title={projectPath} onClick={() => void switchProject(projectPath)}>
                    <FolderIcon />
                    <span>{projectLabel(projectPath)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {workspaceError && <p className="sidebar-hint sidebar-error" role="alert">{workspaceError}</p>}

        {project && (
          <div className="sidebar-label tasks-label">
            <span>TASKS</span>
            {tasks.filter((task) => task.projectPath === project && !task.archived).length > 0 && (
              <span>{tasks.filter((task) => task.projectPath === project && !task.archived).length}</span>
            )}
            <button
              className="new-task-button"
              onClick={() => void createTask()}
              title="New task (Ctrl N)"
              aria-label="New task"
            >
              <Plus size={13} />
            </button>
          </div>
        )}
        {project && tasks.some((task) => task.projectPath === project) && (
          <label className="task-search">
            <Search size={13} />
            <input
              ref={taskSearchRef}
              value={taskQuery}
              onChange={(event) => setTaskQuery(event.target.value)}
              onKeyDown={(event) => {
                // Down leaves the filter and lands on the first result, so the list is reachable from the keyboard.
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  taskListRef.current?.querySelector<HTMLButtonElement>(".task-row .task-link")?.focus();
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const first = projectTasks[0];
                  if (first) { openTask(first.id); taskSearchRef.current?.blur(); }
                  return;
                }
                if (event.key === "Escape") {
                  setTaskQuery("");
                  taskSearchRef.current?.blur();
                }
              }}
              placeholder="Search tasks"
              aria-label="Search tasks"
            />
          </label>
        )}
        {projectTasks.length === 0 && <p className="sidebar-hint">{taskQuery ? "No matching tasks." : "No tasks yet."}</p>}
        {runningTasks.length > 0 && (
          <div className="running-block">
            <button
              className="running-block-label running-block-toggle"
              aria-expanded={runningOpen}
              title={runningOpen ? "Hide the working list" : "Show the working list"}
              onClick={() => setRunningOpen((open) => !open)}
            >
              {runningOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span>Working now</span>
              <span className="running-block-count">{runningTasks.length}</span>
            </button>
            {runningOpen && runningTasks.map((task) => (
              <button
                key={task.id}
                className={"running-row " + (task.id === activeTask ? "selected" : "")}
                onClick={() => openTask(task.id)}
              >
                <Loader2 size={12} className="spin" />
                <span className="running-row-title">{task.title}</span>
                {permission?.taskId === task.id && (
                  <span className="running-row-needs" title="The agent is waiting for your approval">Needs approval</span>
                )}
                <span className="running-row-elapsed">{formatElapsed(task.running?.startedAt, nowTick)}</span>
                <span className="running-row-agent">
                  {agents.find((agent) => agent.id === task.running?.agent)?.name ?? task.running?.agent}
                </span>
                <span
                  className="running-row-stop"
                  role="button"
                  tabIndex={0}
                  aria-label={`Stop ${task.title}`}
                  title="Stop this turn"
                  onClick={(event) => {
                    event.stopPropagation();
                    void stopTurn(task.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    void stopTurn(task.id);
                  }}
                >
                  <Square size={9} />
                </span>
              </button>
            ))}
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projectTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            <div className="task-list" ref={taskListRef}>
              {projectTasks.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  selected={task.id === activeTask}
                  unread={Boolean(unreadTasks[task.id])}
                  renamingId={renamingId}
                  renamingTitle={renamingTitle}
                  setRenamingTitle={setRenamingTitle}
                  onOpen={openTask}
                  onStartRename={startRename}
                  onDuplicate={(id) => void duplicateTask(id)}
                  onPin={(id) => { const task = tasks.find((item) => item.id === id); if (task) void pinTaskAction(id, !task.pinned); }}
                  onArchive={(id) => void archiveTaskAction(id, true)}
                  onCommitRename={(id) => void commitRename(id)}
                  onCancelRename={() => setRenamingId(null)}
                  onMenu={(id, x, y) => setTaskMenu({ id, x, y })}
                  onContextMenu={(id, x, y) => setTaskMenu({ id, x, y })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {archivedTasks.length > 0 && (
          <div className="archived-block">
            <button className="archived-toggle" onClick={() => setArchivedOpen((open) => !open)}>
              {archivedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Archived</span>
              <span>{archivedTasks.length}</span>
            </button>
            {archivedOpen && [...archivedTasks]
              .filter((task) => !taskQuery.trim() || task.title.toLowerCase().includes(taskQuery.trim().toLowerCase()))
              .sort((a, b) => (b.messages.at(-1)?.createdAt ?? "").localeCompare(a.messages.at(-1)?.createdAt ?? ""))
              .map((task) => (
              <div key={task.id} className={"task-row archived " + (task.id === activeTask ? "selected" : "")}>
                <button className="task-link" onClick={() => openTask(task.id)}>
                  <span>{task.title}</span>
                </button>
                <button
                  className="task-quick"
                  aria-label="Restore task"
                  title="Restore task"
                  onClick={(event) => { event.stopPropagation(); void archiveTaskAction(task.id, false); }}
                >
                  <Archive size={12} />
                </button>
                <button
                  className="task-more"
                  aria-label="Task actions"
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setTaskMenu({ id: task.id, x: rect.right - 150, y: rect.bottom + 4 });
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-agents">
          <div className="sidebar-label">INSTALLED AGENTS</div>
          {agents.map((agent) => (
            <button
              key={agent.id}
              className={"sidebar-agent " + (activeAgent === agent.id ? "selected" : "") + (!agent.available ? " unavailable" : "")}
              disabled={!agent.available}
              onClick={() => setActiveAgent(agent.id)}
              title={agent.available ? agent.version ?? agent.name : "Not installed"}
            >
              <AgentGlyph agentId={agent.id} />
              <span>{agent.name}</span>
              <i />
            </button>
          ))}
          {detecting && agents.length === 0 && <p className="sidebar-hint">Checking installed commands…</p>}
          {!detecting && agents.length > 0 && !agents.some((agent) => agent.available) && (
            <p className="sidebar-hint">Install an agent CLI to start.</p>
          )}
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span><b>/</b><strong>{projectName ?? "No project selected"}</strong>
          </div>
          <div className="header-right">
            <button
              className="icon-button"
              onClick={() => void refreshAgents()}
              aria-label="Refresh agent detection"
              title="Refresh agent detection"
              disabled={detecting}
            ><RefreshCw size={14} /></button>
          </div>
        </header>

        {!project ? (
          <section className="empty-workspace">
            <h1>Open a project.</h1>
            <p>Choose a folder on your computer.</p>
            <button className="primary-button" onClick={() => void openProject()}>
              <FolderIcon />Open project folder
            </button>
          </section>
        ) : (
          <section className="workbench">
            <div className="panel-tabs">
              <button
                className={"panel-tab " + (!activeAgent ? "active" : "")}
                onClick={() => setActiveAgent(null)}
                title="Show the terminal panes"
              >
                <TerminalIcon size={15} />
                <span>Shell</span>
              </button>
              {activeAgent && (
                <div className="active-agent-tab">
                  <AgentGlyph agentId={activeAgent} />
                  <span>{agents.find((agent) => agent.id === activeAgent)?.name}</span>
                  <span className="connection-label">{activeAgent === "codex" ? "Codex App Server" : activeAgent === "claude" ? "Stream JSON" : activeAgent === "dsh" ? "ACP" : "RPC"}</span>
                </div>
              )}
            </div>

            <div className="terminal-panel" hidden={activeAgent !== null}>
              <div className="terminal-canvas">
                {layoutRoot ? (
                  <PaneTree
                    node={layoutRoot}
                    labels={paneLabels}
                    fallbackLabel={(id) => "Shell " + ((layoutRoot ? paneIds(layoutRoot) : []).indexOf(id) + 1)}
                    onRename={renamePane}
                    projectPath={project}
                    activePaneId={activeTerminal}
                    onActivate={setActiveTerminal}
                    onSplit={splitPane}
                    onClose={closePane}
                    onResize={(splitId, ratio) => setLayoutRoot((root) => (root ? updateRatio(root, splitId, ratio) : root))}
                  />
                ) : (
                  <div className="terminal-empty">
                    <span className="terminal-empty-mark" aria-hidden="true"><TerminalIcon size={19} /></span>
                    <strong>No shells open</strong>
                    <p>Open a shell to run commands in this project.</p>
                    <button className="ghost-button" onClick={() => splitPane(null, "horizontal")}>Open a shell</button>
                  </div>
                )}
              </div>
            </div>

            {headerAgent && activeTask && (
              <div className="conversation">
                <div className="conversation-heading">
                  <span className="conversation-title">{tasks.find((task) => task.id === activeTask)?.title}</span>
                  {headerAgent && (
                    <span
                      className="conversation-agent"
                      title={`${agents.find((agent) => agent.id === headerAgent)?.name ?? headerAgent} is selected for this task`}
                    >
                      <AgentGlyph agentId={headerAgent} />
                      {agents.find((agent) => agent.id === headerAgent)?.name ?? headerAgent}
                    </span>
                  )}
                  <button
                    className="icon-button"
                    aria-label={chatSearchOpen ? "Close conversation search" : "Find in conversation"}
                    title={chatSearchOpen ? "Close search" : "Find in conversation (Ctrl Shift F)"}
                    disabled={tasks.find((task) => task.id === activeTask)?.messages.length === 0}
                    onClick={() => { setChatSearchOpen((open) => !open); setChatQuery(""); }}
                  >
                    <Search size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Copy conversation"
                    title="Copy the transcript as Markdown"
                    disabled={tasks.find((task) => task.id === activeTask)?.messages.length === 0}
                    onClick={() => void copyConversation()}
                  >
                    {copiedConversation ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    className="subtle-button handoff-button"
                    onClick={() => setHandoffOpen((open) => !open)}
                    disabled={isActiveTaskRunning}
                    title={isActiveTaskRunning ? "Stop the current turn first" : "Continue this task with another agent"}
                  >
                    Hand off
                  </button>
                  {handoffOpen && (
                    <div className="handoff-menu" role="menu">
                      {agents.filter((agent) => agent.available && agent.id !== activeAgent).map((agent) => (
                        <button key={agent.id} role="menuitem" onClick={() => void handoffTo(agent.id)}>
                          <AgentGlyph agentId={agent.id} />
                          <span>{agent.name}</span>
                        </button>
                      ))}
                      {agents.filter((agent) => agent.available && agent.id !== activeAgent).length === 0 && (
                        <p className="settings-hint">No other agent is installed.</p>
                      )}
                    </div>
                  )}
                </div>
                {tasks.find((task) => task.id === activeTask)?.running && !running && (
                  <div className="run-stale" role="status">
                    <span>
                      The last turn ({agents.find((agent) => agent.id === activeTaskRecord?.running?.agent)?.name ?? activeTaskRecord?.running?.agent}) did not finish. It may have been interrupted by a restart.
                    </span>
                    <button
                      className="subtle-button"
                      onClick={async () => {
                        const updated = await window.tango.clearTaskRunning(activeTask!);
                        if (updated) setTasks((current) => current.map((task) => (task.id === updated.id ? { ...task, running: undefined } : task)));
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {chatSearchOpen && (
                  <div className="chat-search" role="search">
                    <Search size={13} />
                    <input
                      ref={chatSearchRef}
                      value={chatQuery}
                      autoFocus
                      placeholder="Find in this conversation"
                      aria-label="Find in this conversation"
                      onChange={(event) => setChatQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setChatSearchOpen(false);
                          setChatQuery("");
                          composerRef.current?.focus();
                        }
                      }}
                    />
                    <span className="chat-search-count">
                      {chatNeedle ? `${filteredMessages.length} of ${activeMessages.length}` : `${activeMessages.length} messages`}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Close search"
                      title="Close search"
                      onClick={() => { setChatSearchOpen(false); setChatQuery(""); }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div
                  className="conversation-messages"
                  ref={messagesRef}
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
                    setAtBottom(distance < 140);
                  }}
                >
                  {chatRows.length === 0 && chatSearchOpen && chatNeedle && (
                    <div className="conversation-empty">
                      <p className="conversation-empty-title">No messages match “{chatQuery.trim()}”.</p>
                      <p className="conversation-empty-hint">Try fewer words, or clear the search to see the whole conversation.</p>
                      <button className="subtle-button" onClick={() => setChatQuery("")}>Clear search</button>
                    </div>
                  )}
                  {chatRows.length === 0 && !(chatSearchOpen && chatNeedle) && (
                    <div className="conversation-empty">
                      <AgentGlyph agentId={headerAgent ?? settings?.defaultAgent ?? "codex"} />
                      <p className="conversation-empty-title">
                        {headerAgent
                          ? `Start with ${agents.find((agent) => agent.id === headerAgent)?.name ?? headerAgent}`
                          : "Choose an agent to begin"}
                      </p>
                      <p className="conversation-empty-hint">Describe the work below. Type / for commands; Hand off switches agent mid-task.</p>
                      {[
                        ["Fix a failing test", "Find why the checkout test fails and fix it."],
                        ["Explain code", "Walk me through how this project handles authentication."],
                        ["Review changes", "Review my uncommitted changes for bugs and risky patterns."],
                      ].map(([label, prompt]) => (
                        <button key={label} type="button" className="empty-suggestion" onClick={() => {
                          setPrompt(prompt);
                          composerRef.current?.focus();
                        }}>
                          <span>{label}</span>
                          <span className="empty-suggestion-text">{prompt}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {chatVirtualizer.getTotalSize() > 0 && (
                    <div className="chat-virtual" style={{ height: chatVirtualizer.getTotalSize() }}>
                      {virtualRows.map((virtualRow) => {
                        const row = chatRows[virtualRow.index];
                        return (
                          <div
                            key={row.id}
                            data-index={virtualRow.index}
                            ref={chatVirtualizer.measureElement}
                            className="chat-row"
                            style={{ transform: `translateY(${virtualRow.start}px)` }}
                          >
                            {row.kind === "message" && (
                              <article className={"message " + row.message.role}>
                                <span className="message-role">
                                  {row.message.role === "user"
                                    ? "You"
                                    : agents.find((agent) => agent.id === row.message.agent)?.name ?? row.message.agent}
                                  <time dateTime={row.message.createdAt}>{formatClock(row.message.createdAt)}</time>
                                </span>
                                <Markdown text={row.message.text} />
                                <button
                                  className="message-copy"
                                  aria-label="Copy message"
                                  title="Copy message"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(row.message.text).then(() => {
                                      setCopiedIndex(row.id);
                                      window.setTimeout(() => setCopiedIndex((current) => (current === row.id ? null : current)), 1200);
                                    });
                                  }}
                                >
                                  {copiedIndex === row.id ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                              </article>
                            )}
                            {row.kind === "divider" && (
                              <div className="turn-divider" role="separator" title={row.detail}>
                                <span className="turn-divider-line" />
                                <span className="turn-divider-label">{row.title}</span>
                                <span className="turn-divider-line" />
                              </div>
                            )}
                            {row.kind === "stream" && (
                              <article className="message assistant">
                                <span className="message-role">
                                  {agents.find((agent) => agent.id === activeAgent)?.name ?? activeAgent}
                                </span>
                                {assistantText ? <Markdown text={assistantText} /> : <p>Working…</p>}
                              </article>
                            )}
                            {row.kind === "tools" && (
                              // Collapsed by default: a turn that used many tools stays one quiet line.
                              <ToolActivity
                                tools={row.tools}
                                expanded={row.live ? toolsExpanded : Boolean(expandedTools[row.id])}
                                onToggle={() => row.live
                                  ? setToolsExpanded((open) => !open)
                                  : setExpandedTools((open) => ({ ...open, [row.id]: !open[row.id] }))}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {!atBottom && (
                  <button
                    className="jump-latest"
                    onClick={() => {
                      const element = messagesRef.current;
                      if (element) element.scrollTop = element.scrollHeight;
                      setAtBottom(true);
                    }}
                  >
                    <ChevronDown size={13} />
                    Latest
                  </button>
                )}
                {permission && permission.taskId === activeTask && (
                  <div className="permission-request" role="alertdialog" aria-label="Agent permission request">
                    <p className="permission-title">{permission.title}</p>
                    {permission.detail && <pre className="permission-detail">{permission.detail}</pre>}
                    {permission.input && (
                      <form
                        className="permission-input"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void answerPermission(null, permissionText);
                        }}
                      >
                        <input
                          autoFocus
                          value={permissionText}
                          placeholder={permission.input.placeholder || "Type your answer…"}
                          onChange={(event) => setPermissionText(event.target.value)}
                        />
                        <button type="submit" className="permission-option allow_once">Send</button>
                      </form>
                    )}
                    <div className="permission-actions">
                      {permission.options.map((option, index) => (
                        <button
                          key={option.optionId}
                          autoFocus={!permission.input && index === 0}
                          className={"permission-option " + (option.kind ?? "")}
                          onClick={() => void answerPermission(option.optionId)}
                        >
                          {option.name}
                        </button>
                      ))}
                      <button className="permission-option reject" onClick={() => void answerPermission(null)}>Reject</button>
                    </div>
                  </div>
                )}
                <form className="composer" onSubmit={(event) => { event.preventDefault(); void submitPrompt(); }}>
                  {slashOpen && (
                    <div className="slash-menu" role="listbox" aria-label="Commands">
                      {slashItems.map((command, index) => (
                        <button
                          key={command.name}
                          role="option"
                          aria-selected={index === slashIndex}
                          className={"slash-item " + (index === slashIndex ? "active" : "")}
                          onMouseEnter={() => setSlashIndex(index)}
                          onMouseDown={(event) => { event.preventDefault(); runSlash(index); }}
                        >
                          <span className="slash-name">/{command.name}</span>
                          <span className="slash-label">{command.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="composer-command"
                    aria-label="Commands"
                    title="Commands (/ )"
                    onClick={() => { setPrompt("/"); setSlashIndex(0); composerRef.current?.focus(); }}
                  >
                    <Plus size={16} />
                  </button>
                  <textarea ref={composerRef} value={prompt} onChange={(event) => { setPrompt(event.target.value); setSlashIndex(0); }} onKeyDown={(event) => {
                    if (slashOpen) {
                      if (event.key === "ArrowDown") { event.preventDefault(); setSlashIndex((index) => (index + 1) % slashItems.length); return; }
                      if (event.key === "ArrowUp") { event.preventDefault(); setSlashIndex((index) => (index - 1 + slashItems.length) % slashItems.length); return; }
                      if (event.key === "Escape") { event.preventDefault(); setPrompt(""); return; }
                      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); runSlash(slashIndex); return; }
                    }
                    // An empty composer means the arrow keys have nothing to move, so they recall prompts.
                    const browsing = promptHistoryRef.current !== null;
                    if (!slashOpen && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
                      if (event.key === "ArrowUp" && (browsing || !prompt.trim())) { event.preventDefault(); recallPrompt(1); return; }
                      if (event.key === "ArrowDown" && browsing) { event.preventDefault(); recallPrompt(-1); return; }
                    }
                    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitPrompt(); }
                  }} placeholder={"Ask " + (agents.find((agent) => agent.id === activeAgent)?.name ?? "an agent") + " to work in this project…  (/ for commands)"} />
                  {isActiveTaskRunning && (
                    <button
                      type="button"
                      className="subtle-button"
                      onClick={() => void stopTurn(activeTask)}
                      disabled={stopping}
                    >
                      {stopping ? "Stopping…" : "Stop"}
                    </button>
                  )}
                  <button type="submit" className="send-button" disabled={!prompt.trim() || isActiveTaskRunning}>Send</button>
                </form>
              </div>
            )}
            {activeAgent && !activeTask && (
              <div className="agent-placeholder">
                <div className="agent-placeholder-icon">
                  <AgentGlyph agentId={activeAgent} />
                </div>
                <h1>Select or create a task.</h1>
                <p>Tasks keep their own conversation and native agent sessions.</p>
                <button className="subtle-button" onClick={() => setActiveAgent(null)}>Return to terminal</button>
              </div>
            )}
          </section>
        )}
      </main>
      </div>

      <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />

      {taskMenu && (
        <>
          <div className="menu-scrim" onClick={() => setTaskMenu(null)} onContextMenu={(event) => { event.preventDefault(); setTaskMenu(null); }} />
          <div
            className="task-menu"
            role="menu"
            style={{
              // Keep the menu on screen for rows near the bottom or right edge.
              left: Math.max(8, Math.min(taskMenu.x, window.innerWidth - 208)),
              top: Math.max(8, Math.min(taskMenu.y, window.innerHeight - 320)),
            }}
          >
            <button role="menuitem" onClick={() => { const task = tasks.find((item) => item.id === taskMenu.id); setTaskMenu(null); if (task) startRename(task); }}>
              <Pencil size={14} />Rename
            </button>
            <button role="menuitem" onClick={() => { const id = taskMenu.id; setTaskMenu(null); void duplicateTask(id); }}>
              <Copy size={14} />Duplicate
            </button>
            {(() => {
              const task = tasks.find((item) => item.id === taskMenu.id);
              if (!task) return null;
              return task.pinned
                ? <button role="menuitem" onClick={() => void pinTaskAction(task.id, false)}><Pin size={14} />Unpin</button>
                : <button role="menuitem" onClick={() => void pinTaskAction(task.id, true)}><Pin size={14} />Pin to top</button>;
            })()}
            {(() => {
              const task = tasks.find((item) => item.id === taskMenu.id);
              return task?.archived
                ? <button role="menuitem" onClick={() => void archiveTaskAction(taskMenu.id, false)}><Archive size={14} />Unarchive</button>
                : <button role="menuitem" onClick={() => void archiveTaskAction(taskMenu.id, true)}><Archive size={14} />Archive</button>;
            })()}
            <button role="menuitem" className="danger" onClick={() => void deleteTaskAction(taskMenu.id)}>
              <Trash2 size={14} />Delete
            </button>
          </div>
        </>
      )}

      {shortcutsOpen && (
        <div className="settings-backdrop" onClick={() => setShortcutsOpen(false)}>
          <div className="settings-panel shortcuts-panel" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(event) => event.stopPropagation()}>
            <header className="settings-header">
              <h2>Keyboard shortcuts</h2>
              <button className="icon-button" onClick={() => setShortcutsOpen(false)} aria-label="Close shortcuts"><X size={15} /></button>
            </header>
            <section className="settings-group">
              {[
                ["New task", "Ctrl N"],
                ["Rename task", "F2"],
                ["Search tasks", "Ctrl F"],
                ["Find in conversation", "Ctrl Shift F"],
                ["Archive task", "Ctrl Shift E"],
                ["Settings", "Ctrl ,"],
                ["Command palette", "Ctrl K"],
                ["Send message", "Enter"],
                ["Commands", "/"],
                ["Stop the running turn", "Esc"],
                ["Show or hide the sidebar", "Ctrl B"],
                ["New line in message", "Shift Enter"],
                ["Earlier prompts", "Up Down"],
                ["Copy in terminal", "Ctrl Shift C"],
                ["Paste in terminal", "Ctrl Shift V"],
                ["Copy selection (terminal)", "Ctrl C"],
              ].map(([label, keys]) => (
                <div className="settings-row" key={label}>
                  <span>{label}</span>
                  <kbd className="shortcut-key">{keys}</kbd>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="settings-panel" role="dialog" aria-modal="true" aria-label="Settings" onClick={(event) => event.stopPropagation()}>
            <header className="settings-header">
              <h2>Settings</h2>
              <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={15} /></button>
            </header>

            <section className="settings-group">
              <h3>Appearance</h3>
              <div className="settings-row">
                <span>Theme</span>
                <div className="segmented">
                  <button className={settings?.theme === "light" ? "active" : ""} onClick={() => updateSettings({ theme: "light" })}>Light</button>
                  <button className={settings?.theme === "dark" ? "active" : ""} onClick={() => updateSettings({ theme: "dark" })}>Dark</button>
                </div>
              </div>
              <div className="settings-row">
                <span>Accent color</span>
                <div className="swatches">
                  {["#d95d43", "#4a7bd9", "#5c9a6b", "#8d6cc9", "#c28a2b"].map((color) => (
                    <button
                      key={color}
                      className={"swatch " + (settings?.accent === color ? "active" : "")}
                      style={{ background: color }}
                      aria-label={"Accent " + color}
                      onClick={() => updateSettings({ accent: color })}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="settings-group">
              <h3>Layout</h3>
              <div className="settings-row">
                <span>Sidebar</span>
                <div className="segmented">
                  <button className={!settings?.sidebarCollapsed ? "active" : ""} onClick={() => updateSettings({ sidebarCollapsed: false })}>Shown</button>
                  <button className={settings?.sidebarCollapsed ? "active" : ""} onClick={() => updateSettings({ sidebarCollapsed: true })}>Hidden</button>
                </div>
              </div>
              <div className="settings-row">
                <span>Chat width</span>
                <div className="segmented">
                  <button className={settings?.chatWidth === "comfortable" ? "active" : ""} onClick={() => updateSettings({ chatWidth: "comfortable" })}>Comfortable</button>
                  <button className={settings?.chatWidth === "wide" ? "active" : ""} onClick={() => updateSettings({ chatWidth: "wide" })}>Wide</button>
                </div>
              </div>
              <div className="settings-row">
                <span>Terminal shell</span>
                <select className="settings-select" value={settings?.terminalShell ?? "powershell"} onChange={(event) => updateSettings({ terminalShell: event.target.value as AppSettings["terminalShell"] })}>
                  <option value="powershell">PowerShell</option>
                  <option value="gitbash">Git Bash</option>
                  <option value="cmd">Command Prompt</option>
                </select>
              </div>
              <div className="settings-row">
                <span>Default agent</span>
                <select className="settings-select" value={settings?.defaultAgent ?? "codex"} onChange={(event) => updateSettings({ defaultAgent: event.target.value as AppSettings["defaultAgent"] })}>
                  <option value="codex">Codex</option>
                  <option value="claude">Claude Code</option>
                  <option value="dsh">DSH</option>
                  <option value="pi">Pi</option>
                </select>
              </div>
            </section>

            <section className="settings-group">
              <h3>Codex</h3>
              <div className="settings-row">
                <span>Approval policy</span>
                <select className="settings-select" value={settings?.codexApprovalPolicy ?? "on-request"} onChange={(event) => updateSettings({ codexApprovalPolicy: event.target.value as AppSettings["codexApprovalPolicy"] })}>
                  <option value="on-request">Ask when needed</option>
                  <option value="on-failure">Only on failure</option>
                  <option value="never">Never ask</option>
                </select>
              </div>
              <div className="settings-row">
                <span>Sandbox</span>
                <select className="settings-select" value={settings?.codexSandbox ?? "workspace-write"} onChange={(event) => updateSettings({ codexSandbox: event.target.value as AppSettings["codexSandbox"] })}>
                  <option value="read-only">Read only</option>
                  <option value="workspace-write">Workspace write</option>
                  <option value="danger-full-access">Full access</option>
                </select>
              </div>
              <p className="settings-hint">Applies to new Codex conversations. Existing threads keep the policy they started with.</p>
            </section>

            <section className="settings-group">
              <h3>Claude Code</h3>
              <div className="settings-row">
                <span>Permission mode</span>
                <select className="settings-select" value={settings?.claudePermissionMode ?? "default"} onChange={(event) => updateSettings({ claudePermissionMode: event.target.value as AppSettings["claudePermissionMode"] })}>
                  <option value="default">Provider default</option>
                  <option value="acceptEdits">Accept edits</option>
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                  <option value="dontAsk">Don't ask</option>
                  <option value="plan">Plan</option>
                  <option value="bypassPermissions">Bypass permissions</option>
                </select>
              </div>
              <p className="settings-hint">Passed to new Claude Code sessions as --permission-mode.</p>
            </section>

            <section className="settings-group">
              <h3>Agents</h3>
              {agents.length === 0 && <p className="settings-hint">Checking installed commands…</p>}
              {agents.map((agent) => (
                <div className="settings-row" key={agent.id}>
                  <span className="settings-agent">
                    <AgentGlyph agentId={agent.id} />
                    <span>{agent.name}</span>
                  </span>
                  <span className="settings-status">{agent.available ? agent.version ?? "installed" : "not installed"}</span>
                </div>
              ))}
              <p className="settings-hint">Tango uses each agent's own login and configuration. Sign in with the agent's CLI.</p>
            </section>

            <section className="settings-group">
              <h3>Workspace</h3>
              <div className="settings-row">
                <span>Project</span>
                <span className="settings-status" title={project ?? undefined}>{project ?? "none"}</span>
              </div>
              <div className="settings-row">
                <span>Shell</span>
                <span className="settings-status">
                  {({ powershell: "PowerShell", gitbash: "Git Bash", cmd: "Command Prompt" } as Record<string, string>)[settings?.terminalShell ?? "powershell"] ?? "PowerShell"}
                  {" · "}{(layoutRoot ? paneIds(layoutRoot) : []).length} open
                </span>
              </div>
              <div className="settings-row">
                <span>Data folder</span>
                <span className="settings-status">tasks.json, settings, and layouts kept in one folder</span>
                <button className="subtle-button" onClick={() => void window.tango.revealDataFolder()}>Open</button>
              </div>
            </section>

            <section className="settings-group">
              <h3>Magpie</h3>
              <div className="settings-row">
                <span>Local model gateway</span>
                <span className="settings-status">{magpie ? (magpie.available ? magpie.version ?? "installed" : "not installed") : "checking…"}</span>
              </div>
              <p className="settings-hint">Magpie routes each agent to a model of your choice. Tango detects it but leaves each agent's own configuration alone.</p>
            </section>

            <section className="settings-group">
              <h3>Plugins</h3>
              <p className="settings-hint">Not supported yet. Tango loads its built-in adapters only.</p>
            </section>

            <section className="settings-group">
              <h3>Keyboard</h3>
              <div className="settings-row">
                <span>Version</span>
                <span className="settings-status">
                  {appInfo ? `Tango ${appInfo.version} · Electron ${appInfo.electron}` : "…"}
                </span>
              </div>
              <div className="settings-row">
                <span>Platform</span>
                <span className="settings-status">{appInfo?.platform ?? "…"}</span>
              </div>
              <div className="settings-row">
                <span>Shortcut reference</span>
                <button className="subtle-button" onClick={() => { setSettingsOpen(false); setShortcutsOpen(true); }}>Show shortcuts</button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
