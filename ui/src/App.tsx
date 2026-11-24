import { useCallback, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import type { AgentStatus } from "../../electron/preload";

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 7.5h6l1.8 2h9.2v9a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M3.5 7.5v-2A1.5 1.5 0 0 1 5 4h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v2" />
    </svg>
  );
}

function AgentGlyph({ agentId }: { agentId: AgentStatus["id"] }) {
  const marks = { codex: "◉", claude: "✳", dsh: "D", pi: "π" };
  return <span className={"agent-mark " + agentId + "-mark"}>{marks[agentId]}</span>;
}

function TerminalView({ projectPath }: { projectPath: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminalId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!hostRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, "Cascadia Mono", monospace',
      fontSize: 14,
      scrollback: 5000,
      theme: {
        background: "#17171c",
        foreground: "#e6e0d6",
        cursor: "#e7b395",
        selectionBackground: "#67617b",
        black: "#222229",
        red: "#d97867",
        green: "#89a982",
        yellow: "#d5b47b",
        blue: "#8d92c7",
        magenta: "#b398c4",
        cyan: "#82aeb1",
        white: "#dedad1",
        brightBlack: "#77727e",
        brightRed: "#ef9584",
        brightGreen: "#a5c399",
        brightYellow: "#e6c791",
        brightBlue: "#aab0e5",
        brightMagenta: "#c7a6d9",
        brightCyan: "#9acbcb",
        brightWhite: "#fffaf0",
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
      fit.fit();
      window.tango.resizeTerminal(terminalId, terminal.cols, terminal.rows);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(hostRef.current);
    resize();
    terminal.focus();

    let cancelled = false;
    void window.tango.startTerminal(projectPath, terminalId).then(() => {
      if (cancelled) window.tango.closeTerminal(terminalId);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Could not start terminal");
    });

    return () => {
      cancelled = true;
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

function App() {
  const [project, setProject] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentStatus["id"] | null>(null);
  const [tabs, setTabs] = useState<string[]>(["terminal-1"]);
  const [activeTerminal, setActiveTerminal] = useState("terminal-1");

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
  }, [refreshAgents]);

  async function openProject() {
    const selected = await window.tango.openWorkspace();
    if (selected) setProject(selected);
  }

  function newTerminal() {
    const id = "terminal-" + crypto.randomUUID();
    setTabs((current) => [...current, id]);
    setActiveTerminal(id);
    setActiveAgent(null);
  }

  function closeTerminal(id: string) {
    if (tabs.length <= 1) return;
    const remaining = tabs.filter((tab) => tab !== id);
    setTabs((current) => current.filter((tab) => tab !== id));
    if (activeTerminal === id) setActiveTerminal(remaining.at(-1) ?? "terminal-1");
  }

  const projectName = project?.split(/[\\/]/).filter(Boolean).at(-1);
  const activeTab = activeTerminal;

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
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  className={"panel-tab " + (activeTab === tab && !activeAgent ? "active" : "")}
                  onClick={() => { setActiveTerminal(tab); setActiveAgent(null); }}
                >
                  <span className="tab-terminal-icon">›_</span>
                  <span>Terminal {index + 1}</span>
                  {tabs.length > 1 && (
                    <span className="tab-close" role="button" aria-label={"Close Terminal " + (index + 1)} onClick={(event) => {
                      event.stopPropagation();
                      closeTerminal(tab);
                    }}>×</span>
                  )}
                </button>
              ))}
              <button className="new-terminal" onClick={newTerminal} aria-label="New terminal" title="New terminal">＋</button>
              {activeAgent && (
                <div className="active-agent-tab">
                  <AgentGlyph agentId={activeAgent} />
                  <span>{agents.find((agent) => agent.id === activeAgent)?.name}</span>
                  <span className="connection-label">CLI installed · session not connected</span>
                </div>
              )}
            </div>

            {!activeAgent && (
              <div className="terminal-panel">
                {tabs.map((tab) => (
                  <div className="terminal-instance" key={tab} hidden={activeTab !== tab}>
                    <TerminalView projectPath={project} />
                  </div>
                ))}
              </div>
            )}

            {activeAgent && (
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
