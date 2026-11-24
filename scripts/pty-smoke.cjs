const { spawn } = require("node:child_process");
const path = require("node:path");

if (process.env.ELECTRON_RUN_AS_NODE === "1") {
  runPtySmoke().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  const electronPath = require("electron");
  const child = spawn(electronPath, [__filename], {
    cwd: process.cwd(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

async function runPtySmoke() {
  const { spawn: spawnPty } = require("@homebridge/node-pty-prebuilt-multiarch");
  const systemRoot = process.env.SystemRoot || "C:\\Windows";
  const shell = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const terminal = spawnPty(
    shell,
    ["-NoLogo", "-NoProfile", "-Command", "$line = Read-Host 'Tango PTY smoke'; Write-Output $line"],
    {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: { ...process.env, TERM: "xterm-256color" },
      useConpty: true,
      conptyInheritCursor: true,
    },
  );

  let output = "";
  let sentInput = false;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      terminal.kill();
      reject(new Error("PTY smoke test timed out. Output: " + output));
    }, 10000);
    const inputTimeout = setTimeout(() => {
      sentInput = true;
      terminal.resize(100, 30);
      terminal.write("TANGO_INPUT_OK\r");
    }, 1500);

    terminal.onData((data) => {
      output += data;
      if (!sentInput && output.includes("Tango PTY smoke")) {
        sentInput = true;
        clearTimeout(inputTimeout);
        terminal.resize(100, 30);
        terminal.write("TANGO_INPUT_OK\r");
      }
      if (output.includes("TANGO_INPUT_OK")) {
        clearTimeout(timeout);
        terminal.kill();
        resolve();
      }
    });
    terminal.onExit(({ exitCode }) => {
      if (!output.includes("TANGO_INPUT_OK")) {
        clearTimeout(timeout);
        reject(new Error("PTY exited before echoing input with code " + exitCode + ". Output: " + output));
      }
    });
  });

  console.log("Electron ConPTY smoke test passed");
}
