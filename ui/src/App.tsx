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
import { Check, Copy, GripVertical, PanelLeft, Pin, Search, TerminalSquare, FileText, Globe, Wrench, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import "./layout.css";
import "./agent-icons.css";

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 7.5h6l1.8 2h9.2v9a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M3.5 7.5v-2A1.5 1.5 0 0 1 5 4h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v2" />
    </svg>
  );
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
      setError(reason instanceof Error ? reason.message : "Could not start terminal");
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
}: {
  node: LayoutNode;
  projectPath: string;
  activePaneId: string | null;
  labels: Record<string, string>;
  onActivate(id: string): void;
  onSplit(id: string | null, direction: "horizontal" | "vertical"): void;
  onClose(id: string): void;
  onResize(id: string, ratio: number): void;
}) {
  if (node.type === "pane") {
    return (
      <section className={"layout-pane " + (activePaneId === node.id ? "focused" : "")} onMouseDown={() => onActivate(node.id)}>
        <header className="layout-pane-header">
          <span className="pane-title"><i />{labels[node.id] ?? "Shell"}</span>
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
      <PaneTree node={node.first} projectPath={projectPath} activePaneId={activePaneId} labels={labels} onActivate={onActivate} onSplit={onSplit} onClose={onClose} onResize={onResize} />
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
      <PaneTree node={node.second} projectPath={projectPath} activePaneId={activePaneId} labels={labels} onActivate={onActivate} onSplit={onSplit} onClose={onClose} onResize={onResize} />
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
  renamingId,
  renamingTitle,
  setRenamingTitle,
  onOpen,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onMenu,
  onContextMenu,
}: {
  task: TaskRecord;
  selected: boolean;
  renamingId: string | null;
  renamingTitle: string;
  setRenamingTitle(value: string): void;
  onOpen(id: string): void;
  onStartRename(task: TaskRecord): void;
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
          <span className="task-title">{task.pinned && <Pin size={11} className="task-pin" />}{task.title}</span>
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

function App() {
  const [project, setProject] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentStatus["id"] | null>(null);
  const [layoutRoot, setLayoutRoot] = useState<LayoutNode | null>({ type: "pane", id: "terminal-1" });
  const [activeTerminal, setActiveTerminal] = useState<string | null>("terminal-1");
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [runningAgent, setRunningAgent] = useState<AgentStatus["id"] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toolActivity, setToolActivity] = useState<Record<string, Array<{ id: string; name: string; status: string; detail?: string }>>>({});
  const [magpie, setMagpie] = useState<{ available: boolean; version: string | null } | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const liveTaskRef = useRef<{
    id: string;
    agent: AgentStatus["id"];
    baseMessages: TaskRecord["messages"];
    userMessage: TaskRecord["messages"][number];
    readyLength: number;
    streams: boolean;
  } | null>(null);
  const draftTaskRef = useRef<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [taskMenu, setTaskMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [piCommands, setPiCommands] = useState<Array<{ name: string; description?: string }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
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
    const onKeyDown = (event: KeyboardEvent) => {
      // Plain typing in a field keeps its own shortcuts; keys below intentionally skip that.
      if (inField(event.target) && event.key !== "Escape") return;
      if (event.key === "F2" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        renameActiveTask();
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
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
    void window.tango.detectMagpie().then(setMagpie).catch(() => setMagpie({ available: false, version: null }));
    void refreshAgents();
    void window.tango.listTasks().then(setTasks);
    void window.tango.getLayout().then((layout) => {
      if (layout?.root) {
        setLayoutRoot(layout.root);
        setActiveTerminal(layout.activePaneId);
      }
      setLayoutLoaded(true);
    });
  }, [refreshAgents]);

  useEffect(() => {
    if (!layoutLoaded || !layoutRoot || !activeTerminal) return;
    void window.tango.saveLayout({ root: layoutRoot, activePaneId: activeTerminal });
  }, [layoutRoot, activeTerminal, layoutLoaded]);

  // 切换任务时清掉上一个任务的流式状态，避免把它的输出显示在另一个任务里。
  useEffect(() => {
    setAssistantText("");
    setRunning(false);
    setRunningAgent(null);
    setStopping(false);
    setPermission(null);
  }, [activeTask]);

  useEffect(() => window.tango.onCodexEvent((taskId, event) => {
    if (taskId !== activeTask) return;
    if (event.type === "delta" && typeof event.text === "string") setAssistantText((text) => text + event.text);
    if (event.type === "turn/completed") {
      endTurn(taskId);
      setAssistantText((text) => {
        if (text.trim()) {
          setTasks((current) => current.map((task) => task.id === taskId
            ? { ...task, messages: [...task.messages, { role: "assistant", agent: "codex", text, createdAt: new Date().toISOString() }] }
            : task));
        }
        return "";
      });
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
      setRunning(false);
      setRunningAgent(null);
      if (event.type === "process/error") setAssistantText(String(event.message ?? "The agent process could not start"));
    }
  }), [activeTask]);

  useEffect(() => window.tango.onClaudeEvent((taskId, event) => {
    if (taskId !== activeTask) return;
    if (event.type === "delta" && typeof event.text === "string") setAssistantText((text) => text + event.text);
    if (event.type === "tool") recordTool(taskId, event as { id?: string; name?: string; status?: string });
    if (event.type === "turn/completed") endTurn(taskId);
    if (event.type === "process/error") {
      setRunning(false);
      setRunningAgent(null);
      setAssistantText(String(event.message ?? "Claude Code could not start"));
    }
  }), [activeTask]);
  useEffect(() => window.tango.onDshEvent((taskId, event) => {
    if (taskId !== activeTask) return;
    // The process exits right after each turn, so only an unexpected exit while the
    // turn is still running counts as a failure.
    if (event.type === "process/exit") {
      liveTaskRef.current = null;
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
  }), [activeTask]);
  useEffect(() => window.tango.onPiEvent((taskId, event) => {
    if (taskId !== activeTask) return;
    if (event.type === "delta" && typeof event.text === "string") setAssistantText((text) => text + event.text);
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
    if (event.type === "agent_end" || event.type === "process/exit" || event.type === "process/error") {
      endTurn(taskId);
    }
  }), [activeTask]);

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
      setAssistantText(error instanceof Error ? error.message : "Could not answer the permission request");
    }
  }

  async function openProject() {
    setWorkspaceError(null);
    try {
      const selected = await window.tango.openWorkspace();
      if (selected) setProject(selected);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Could not open the folder picker");
    }
  }

  const projectTasks = tasks
    .filter((task) => task.projectPath === project && !task.archived)
    .filter((task) => !taskQuery.trim() || task.title.toLowerCase().includes(taskQuery.trim().toLowerCase()))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  const archivedTasks = tasks.filter((task) => task.projectPath === project && task.archived);
  // Running tasks float to the top so a busy agent stays visible while you read another task.
  const runningTasks = projectTasks.filter((task) => task.running && !taskQuery.trim());

  function formatClock(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Tool activity stays under the answer it belongs to, so a finished turn can still be
  // read; it is cleared when the next turn starts instead.
  function endTurn(_taskId: string) {
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
      return { ...current, [taskId]: next };
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
    setActiveTask(taskId);
    setActiveAgent(settings?.defaultAgent ?? "codex");
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
    const updated = await window.tango.archiveTask(taskId, archived);
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, archived: updated.archived } : task)));
    if (archived && activeTask === taskId) {
      setActiveTask(null);
      setActiveAgent(null);
    }
  }

  async function deleteTaskAction(taskId: string) {
    setTaskMenu(null);
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    if (!window.confirm(`Delete "${target.title}"? This cannot be undone.`)) return;
    await window.tango.deleteTask(taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));
    if (activeTask === taskId) {
      setActiveTask(null);
      setActiveAgent(null);
    }
  }

  async function createTask() {
    if (!project) return;
    const task = await window.tango.createTask("New task", project);
    setTasks((current) => [task, ...current]);
    setActiveTask(task.id);
    setActiveAgent(settings?.defaultAgent ?? "codex");
  }
  async function startTurn(agent: AgentStatus["id"], task: TaskRecord, text: string) {
    setPrompt("");
    setAssistantText("");
    setToolActivity((current) => (current[task.id]?.length ? { ...current, [task.id]: [] } : current));
    setRunning(true);
    setStopping(false);
    setRunningAgent(agent);
    const waitsForTurnEnd = agent !== "codex";
    const baseMessages = task.messages;
    const userMessage = { role: "user" as const, agent, text, createdAt: new Date().toISOString() };
    // DSH streams its answer as `delta` events. Those are written straight into the task
    // so the live text and the finished transcript are the same message, not shown twice.
    liveTaskRef.current = { id: task.id, agent, baseMessages, userMessage, readyLength: baseMessages.length + 1, streams: agent === "dsh" };
    // Show the prompt as soon as it is sent; the agent's answer lands when the turn reports back.
    setTasks((current) => current.map((item) => item.id === task.id
      ? { ...item, messages: [...item.messages, userMessage] }
      : item));
    // The prompt is already in the transcript. DSH writes its answer as it streams, so the
    // reported answer is only appended when the transcript does not already end with it.
    const appendTurn = (answer: string, patch: Partial<TaskRecord>) => {
      setTasks((current) => current.map((item) => {
        if (item.id !== task.id) return item;
        const messages = [...item.messages];
        const last = messages[messages.length - 1];
        const alreadyShown = Boolean(answer) && last?.role === "assistant" && last.text.trim() === answer.trim();
        if (answer && !alreadyShown) {
          messages.push({ role: "assistant", agent, text: answer, createdAt: new Date().toISOString() });
        }
        return { ...item, ...patch, messages };
      }));
      liveTaskRef.current = null;
      setAssistantText("");
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
      setAssistantText(error instanceof Error ? error.message : "Could not start the agent");
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
  async function handoffTo(target: AgentStatus["id"]) {
    setHandoffOpen(false);
    const task = tasks.find((item) => item.id === activeTask);
    if (!task) return;
    if (running) {
      setAssistantText("Stop the current turn before handing the task off.");
      return;
    }
    const source = activeAgent ?? "another agent";
    const recent = task.messages.slice(-8)
      .map((message) => `[${message.agent}] ${message.text}`)
      .join("\n\n");
    const context = [
      `Handoff from ${source}.`,
      `Task: ${task.title}`,
      recent ? `Recent turns:\n\n${recent}` : "No earlier turns.",
      "Continue this task from here. Keep the same goal and report what you changed and what is still pending.",
    ].join("\n\n");
    setActiveAgent(target);
    await startTurn(target, task, context);
  }

  async function stopTurn() {
    if (!activeTask || stopping) return;
    setStopping(true);
    try {
      const agent = runningAgent ?? activeAgent;
      if (agent === "pi") await window.tango.piInterrupt(activeTask);
      else if (agent === "dsh") await window.tango.dshInterrupt(activeTask);
      else if (agent === "claude") await window.tango.claudeInterrupt(activeTask);
      else await window.tango.codexInterrupt(activeTask);
    } catch (error) {
      setAssistantText(error instanceof Error ? error.message : "Could not stop the agent");
      setStopping(false);
    }
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
  const agentIds: Array<AgentStatus["id"]> = ["codex", "claude", "dsh", "pi"];
  const lastAgent = [...activeTaskRecord?.messages ?? []].reverse()
    .find((message) => message.role === "assistant")?.agent;
  const historicalAgent = agentIds.find((id) => id === lastAgent);
  const headerAgent: AgentStatus["id"] | undefined = activeAgent ?? historicalAgent
    ?? (activeTaskRecord?.threadId ? "codex" : undefined);

  type ChatRow =
    | { kind: "message"; id: string; message: TaskRecord["messages"][number] }
    | { kind: "stream"; id: string }
    | { kind: "tools"; id: string };

  const chatRows: ChatRow[] = [
    ...activeMessages.map((message, index): ChatRow => ({ kind: "message", id: "m-" + index, message })),
    ...(assistantText || (running && !liveTaskRef.current?.streams) ? [{ kind: "stream", id: "stream" } as ChatRow] : []),
    ...((toolActivity[activeTask ?? ""]?.length ?? 0) > 0 ? [{ kind: "tools", id: "tools" } as ChatRow] : []),
  ];

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
    { id: "a-shell", group: "Actions", label: "Show terminal", run: () => setActiveAgent(null) },
    {
      id: "a-theme", group: "Actions", label: "Toggle light / dark theme",
      run: () => updateSettings({ theme: settings?.theme === "dark" ? "light" : "dark" }),
    },
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

  const projectName = project?.split(/[\\/]/).filter(Boolean).at(-1);
  const paneIdList = layoutRoot ? paneIds(layoutRoot) : [];
  const terminalLabels = Object.fromEntries(paneIdList.map((id, index) => [id, "Shell " + (index + 1)]));
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
          <div className="project-current">
            <span className="project-dot" />
            <span className="project-path" title={project}>{project}</span>
          </div>
        ) : (
          <p className="sidebar-hint">No project selected.</p>
        )}
        {workspaceError && <p className="sidebar-hint sidebar-error" role="alert">{workspaceError}</p>}

        {project && (
          <button className="project-button create-task" onClick={() => void createTask()}>
            <Plus size={14} />New task
          </button>
        )}
        {project && tasks.some((task) => task.projectPath === project) && (
          <label className="task-search">
            <Search size={13} />
            <input
              value={taskQuery}
              onChange={(event) => setTaskQuery(event.target.value)}
              placeholder="Search tasks"
              aria-label="Search tasks"
            />
          </label>
        )}
        {projectTasks.length === 0 && <p className="sidebar-hint">{taskQuery ? "No matching tasks." : "No tasks yet."}</p>}
        {runningTasks.length > 0 && (
          <div className="running-block">
            <span className="running-block-label">Working now</span>
            {runningTasks.map((task) => (
              <button
                key={task.id}
                className={"running-row " + (task.id === activeTask ? "selected" : "")}
                onClick={() => openTask(task.id)}
              >
                <Loader2 size={12} className="spin" />
                <span className="running-row-title">{task.title}</span>
                <span className="running-row-agent">
                  {agents.find((agent) => agent.id === task.running?.agent)?.name ?? task.running?.agent}
                </span>
              </button>
            ))}
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projectTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            <div className="task-list">
              {projectTasks.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  selected={task.id === activeTask}
                  renamingId={renamingId}
                  renamingTitle={renamingTitle}
                  setRenamingTitle={setRenamingTitle}
                  onOpen={openTask}
                  onStartRename={startRename}
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
            {archivedOpen && archivedTasks.map((task) => (
              <div key={task.id} className={"task-row archived " + (task.id === activeTask ? "selected" : "")}>
                <button className="task-link" onClick={() => openTask(task.id)}>
                  <span>{task.title}</span>
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
                    labels={terminalLabels}
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
                    className="subtle-button handoff-button"
                    onClick={() => setHandoffOpen((open) => !open)}
                    disabled={running}
                    title={running ? "Stop the current turn first" : "Continue this task with another agent"}
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
                      The last turn ({tasks.find((task) => task.id === activeTask)?.running?.agent}) did not finish. It may have been interrupted by a restart.
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
                <div
                  className="conversation-messages"
                  ref={messagesRef}
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
                    setAtBottom(distance < 140);
                  }}
                >
                  {chatRows.length === 0 && (
                    <div className="conversation-empty">
                      <AgentGlyph agentId={headerAgent ?? settings?.defaultAgent ?? "codex"} />
                      <p className="conversation-empty-title">
                        {headerAgent
                          ? `Start with ${agents.find((agent) => agent.id === headerAgent)?.name ?? headerAgent}`
                          : "Choose an agent to begin"}
                      </p>
                      <p className="conversation-empty-hint">Describe the work below. Type / for commands; Hand off switches agent mid-task.</p>
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
                            {row.kind === "stream" && (
                              <article className="message assistant">
                                <span className="message-role">
                                  {agents.find((agent) => agent.id === activeAgent)?.name ?? activeAgent}
                                </span>
                                {assistantText ? <Markdown text={assistantText} /> : <p>Working…</p>}
                              </article>
                            )}
                            {row.kind === "tools" && (
                              <div className="tool-activity" aria-label="Tool activity">
                                {toolActivity[activeTask ?? ""].map((tool) => {
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
                      {permission.options.map((option) => (
                        <button
                          key={option.optionId}
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
                    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitPrompt(); }
                  }} placeholder={"Ask " + activeAgent + " to work in this project…  (/ for commands)"} />
                  {running && (
                    <button type="button" className="subtle-button" onClick={() => void stopTurn()} disabled={stopping}>
                      {stopping ? "Stopping…" : "Stop"}
                    </button>
                  )}
                  <button type="submit" className="send-button" disabled={!prompt.trim() || running}>Send</button>
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
          <div className="task-menu" role="menu" style={{ left: Math.max(8, taskMenu.x), top: Math.max(8, taskMenu.y) }}>
            <button role="menuitem" onClick={() => { const task = tasks.find((item) => item.id === taskMenu.id); setTaskMenu(null); if (task) startRename(task); }}>
              <Pencil size={14} />Rename
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
                ["Archive task", "Ctrl Shift E"],
                ["Settings", "Ctrl ,"],
                ["Command palette", "Ctrl K"],
                ["Send message", "Enter"],
                ["New line in message", "Shift Enter"],
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
                <span className="settings-status">PowerShell · {paneIdList.length} open</span>
              </div>
              <div className="settings-row">
                <span>Data folder</span>
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
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
