import { useCallback, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { siAnthropic, siDeepseek, siPi } from "simple-icons";
import type { AgentStatus, LayoutNode, TaskRecord } from "../../electron/preload";
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
  const icon = agentId === "claude" ? siAnthropic : agentId === "dsh" ? siDeepseek : agentId === "pi" ? siPi : null;
  return (
    <span className={"agent-mark " + agentId + "-mark"} aria-hidden="true">
      {icon ? (
        <svg viewBox="0 0 24 24"><path d={icon.path} /></svg>
      ) : (
        <svg viewBox="0 0 24 24">
          <path d="M12 3.2 15.1 5l3.6-.1.2 3.7 2 3.1-2 3.1-.2 3.7-3.6-.1-3.1 1.8L8.9 18l-3.6.1-.2-3.7-2-3.1 2-3.1.2-3.7 3.6.1z" />
          <circle cx="12" cy="11.9" r="3.2" />
          <path d="m12 8.7 2.1 3.2L12 15l-2.1-3.1z" />
        </svg>
      )}
    </span>
  );
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
        >⌁</button>
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
  onActivate,
  onSplit,
  onClose,
  onResize,
}: {
  node: LayoutNode;
  projectPath: string;
  activePaneId: string;
  onActivate(id: string): void;
  onSplit(id: string, direction: "horizontal" | "vertical"): void;
  onClose(id: string): void;
  onResize(id: string, ratio: number): void;
}) {
  if (node.type === "pane") {
    return (
      <section className={"layout-pane " + (activePaneId === node.id ? "focused" : "")} onMouseDown={() => onActivate(node.id)}>
        <header className="layout-pane-header">
          <span className="pane-title"><i />Terminal</span>
          <div className="pane-actions">
            <button onClick={() => onSplit(node.id, "horizontal")} title="Split left or right" aria-label="Split left or right">◧</button>
            <button onClick={() => onSplit(node.id, "vertical")} title="Split above or below" aria-label="Split above or below">◩</button>
            <button onClick={() => onClose(node.id)} title="Close pane" aria-label="Close pane">×</button>
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
      <PaneTree node={node.first} projectPath={projectPath} activePaneId={activePaneId} onActivate={onActivate} onSplit={onSplit} onClose={onClose} onResize={onResize} />
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
      <PaneTree node={node.second} projectPath={projectPath} activePaneId={activePaneId} onActivate={onActivate} onSplit={onSplit} onClose={onClose} onResize={onResize} />
    </div>
  );
}

function App() {
  const [project, setProject] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentStatus["id"] | null>(null);
  const [layoutRoot, setLayoutRoot] = useState<LayoutNode>({ type: "pane", id: "terminal-1" });
  const [activeTerminal, setActiveTerminal] = useState("terminal-1");
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [running, setRunning] = useState(false);
  const [claudeMode, setClaudeMode] = useState(false);
  const [dshMode, setDshMode] = useState(false);
  const [piMode, setPiMode] = useState(false);

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
    if (layoutLoaded) void window.tango.saveLayout({ root: layoutRoot, activePaneId: activeTerminal });
  }, [layoutRoot, activeTerminal, layoutLoaded]);

  useEffect(() => window.tango.onCodexEvent((taskId, event) => {
    if (taskId !== activeTask) return;
    if (event.type === "delta" && typeof event.text === "string") setAssistantText((text) => text + event.text);
    if (event.type === "turn/completed") {
      setRunning(false);
      setAssistantText((text) => {
        if (text.trim()) {
          setTasks((current) => current.map((task) => task.id === taskId
            ? { ...task, messages: [...task.messages, { role: "assistant", agent: "codex", text, createdAt: new Date().toISOString() }] }
            : task));
        }
        return "";
      });
    }
    if (event.type === "process/exit") setRunning(false);
  }), [activeTask]);

  useEffect(() => window.tango.onClaudeEvent((taskId, event) => {
    if (taskId !== activeTask) return;
    if (event.type === "delta" && typeof event.text === "string") setAssistantText((text) => text + event.text);
    if (event.type === "turn/completed") setRunning(false);
  }), [activeTask]);
  useEffect(() => window.tango.onDshEvent((taskId, event) => {
    if (taskId !== activeTask) return;
    if (event.type === "delta" && typeof event.text === "string") setAssistantText((text) => text + event.text);
    if (event.type === "session/update") {
      const update = event.update as { sessionUpdate?: string } | undefined;
      if (update?.sessionUpdate === "agent_message_chunk") setRunning(true);
    }
  }), [activeTask]);
  useEffect(() => window.tango.onPiEvent((taskId, event) => {
    if (taskId !== activeTask) return;
    if (event.type === "delta" && typeof event.text === "string") setAssistantText((text) => text + event.text);
    if (event.type === "agent_settled") setRunning(false);
  }), [activeTask]);

  async function openProject() {
    const selected = await window.tango.openWorkspace();
    if (selected) setProject(selected);
  }

  async function createTask() {
    if (!project) return;
    const task = await window.tango.createTask("New task", project);
    setTasks((current) => [task, ...current]);
    setActiveTask(task.id);
    setActiveAgent("codex");
    setClaudeMode(false);
    setDshMode(false);
    setPiMode(false);
  }

  async function submitPrompt() {
    const text = prompt.trim();
    const task = tasks.find((item) => item.id === activeTask);
    if (!text || !task) return;
    setPrompt("");
    setAssistantText("");
    setRunning(true);
    try {
      if (piMode) {
        const result = await window.tango.runPi(task.id, task.projectPath, text);
        setRunning(false);
        setTasks((current) => current.map((item) => item.id === task.id
          ? { ...item, messages: [...item.messages, { role: "user", agent: "pi", text, createdAt: new Date().toISOString() }, { role: "assistant", agent: "pi", text: result.answer, createdAt: new Date().toISOString() }] }
          : item));
      } else if (dshMode) {
        const result = await window.tango.runDsh(task.id, task.projectPath, text);
        setRunning(false);
        setTasks((current) => current.map((item) => item.id === task.id
          ? { ...item, dshSessionId: result.sessionId, messages: [...item.messages, { role: "user", agent: "dsh", text, createdAt: new Date().toISOString() }, { role: "assistant", agent: "dsh", text: result.answer, createdAt: new Date().toISOString() }] }
          : item));
      } else if (claudeMode) {
        const result = await window.tango.runClaude(task.id, task.projectPath, text);
        setTasks((current) => current.map((item) => item.id === task.id
          ? { ...item, claudeSessionId: result.sessionId, messages: [...item.messages, { role: "user", agent: "claude", text, createdAt: new Date().toISOString() }, { role: "assistant", agent: "claude", text: result.answer, createdAt: new Date().toISOString() }] }
          : item));
      } else if (task.threadId) await window.tango.codexSend(task.id, text);
      else {
        const threadId = await window.tango.codexStart(task.id, task.projectPath, text);
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, threadId } : item));
      }
      if (!claudeMode && !dshMode && !piMode) {
        setTasks((current) => current.map((item) => item.id === task.id
          ? { ...item, messages: [...item.messages, { role: "user", agent: "codex", text, createdAt: new Date().toISOString() }] }
          : item));
      }
    } catch (error) {
      setRunning(false);
      setAssistantText(error instanceof Error ? error.message : "Could not start Codex");
    }
  }

  function splitPane(paneId: string, direction: "horizontal" | "vertical") {
    const id = "terminal-" + crypto.randomUUID();
    setLayoutRoot((root) => replacePane(root, paneId, {
      type: "split", id: "split-" + crypto.randomUUID(), direction, ratio: 0.5,
      first: { type: "pane", id: paneId }, second: { type: "pane", id },
    }));
    setActiveTerminal(id);
    setActiveAgent(null);
  }

  function closePane(id: string) {
    const remaining = paneIds(layoutRoot).filter((paneId) => paneId !== id);
    if (!remaining.length) return;
    const root = removePane(layoutRoot, id);
    if (root) setLayoutRoot(root);
    if (activeTerminal === id) setActiveTerminal(remaining[0]);
  }

  const projectName = project?.split(/[\\/]/).filter(Boolean).at(-1);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span className="brand-name">Tango</span>
        </div>

        <div className="sidebar-label">PROJECT</div>
        <button className="project-button" onClick={() => void openProject()}>
          <FolderIcon />
          <span>{project ? "Change project" : "Open project"}</span>
          <span className="plus">＋</span>
        </button>

        {project ? (
          <div className="project-current">
            <span className="project-dot" />
            <span className="project-path" title={project}>{project}</span>
          </div>
        ) : (
          <p className="sidebar-hint">No project selected.</p>
        )}

        {project && <button className="project-button create-task" onClick={() => void createTask()}>＋ New task</button>}
        <div className="task-list">
          {tasks.filter((task) => task.projectPath === project).map((task) => (
            <button key={task.id} className={"task-link " + (task.id === activeTask ? "selected" : "")} onClick={() => {
              setActiveTask(task.id);
              setActiveAgent("codex");
              setClaudeMode(false);
              setDshMode(false);
              setPiMode(false);
            }}>
              <span>◌</span><span>{task.title}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-agents">
          <div className="sidebar-label">INSTALLED AGENTS</div>
          {agents.map((agent) => (
            <button
              key={agent.id}
              className={"sidebar-agent " + (activeAgent === agent.id ? "selected" : "") + (!agent.available ? " unavailable" : "")}
              disabled={!agent.available}
              onClick={() => { setActiveAgent(agent.id); setClaudeMode(agent.id === "claude"); setDshMode(agent.id === "dsh"); setPiMode(agent.id === "pi"); }}
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
            >↻</button>
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
              <button className="new-terminal" onClick={() => splitPane(activeTerminal, "horizontal")} aria-label="Split left or right" title="Split left or right">◧ Split</button>
              <button className="new-terminal" onClick={() => splitPane(activeTerminal, "vertical")} aria-label="Split above or below" title="Split above or below">◩ Split</button>
              {activeAgent && (
              <div className="active-agent-tab">
                  <AgentGlyph agentId={activeAgent} />
                  <span>{agents.find((agent) => agent.id === activeAgent)?.name}</span>
                {activeAgent === "codex" && <span className="connection-label">Codex App Server</span>}
                </div>
              )}
            </div>

            {!activeAgent && (
              <div className="terminal-panel">
                <PaneTree
                  node={layoutRoot}
                  projectPath={project}
                  activePaneId={activeTerminal}
                  onActivate={setActiveTerminal}
                  onSplit={splitPane}
                  onClose={closePane}
                  onResize={(splitId, ratio) => setLayoutRoot((root) => updateRatio(root, splitId, ratio))}
                />
              </div>
            )}

            {activeAgent && activeTask && ["codex", "claude", "dsh", "pi"].includes(activeAgent) && (
              <div className="conversation">
                <div className="conversation-heading">{tasks.find((task) => task.id === activeTask)?.title}</div>
                <div className="conversation-messages">
                  {tasks.find((task) => task.id === activeTask)?.messages.map((message, index) => (
                    <article className={"message " + message.role} key={index}>
                  <span>{message.agent}</span><p>{message.text}</p>
                    </article>
                  ))}
                  {(assistantText || running) && <article className="message assistant"><span>{activeAgent}</span><p>{assistantText || "Working…"}</p></article>}
                </div>
                <form className="composer" onSubmit={(event) => { event.preventDefault(); void submitPrompt(); }}>
                  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitPrompt(); }
                  }} placeholder={"Ask " + activeAgent + " to work in this project…"} />
                  {running && <button type="button" className="subtle-button" onClick={() => void window.tango.codexInterrupt(activeTask)}>Stop</button>}
                  <button type="submit" className="send-button" disabled={!prompt.trim() || running}>Send</button>
                </form>
              </div>
            )}
            {activeAgent && (!activeTask || !["codex", "claude", "dsh", "pi"].includes(activeAgent)) && (
              <div className="agent-placeholder">
                <div className="agent-placeholder-icon">
                  <AgentGlyph agentId={activeAgent} />
                </div>
                <h1>Session connection is next.</h1>
                <p>This agent is installed. Its native session is not connected yet.</p>
                <button className="subtle-button" onClick={() => setActiveAgent(null)}>Return to terminal</button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
