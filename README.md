# Batcave: Multi-Agent Operations and 3D Command Center

Batcave is a procedural 3D command center and read-only dashboard for your local [Hermes Agent](https://hermes-agent.nousresearch.com) and OpenCode multi-agent crew. It tracks agent activity, Kanban boards, cron schedules, session histories, persona memory, sandboxed file structures, and logs in real time.

All telemetry is gathered strictly through read-only `hermes` CLI queries. The dashboard performs zero writes or state mutations to your agent workspaces or databases.

![The 3D Batcave command center](docs/screenshots/office.png)

![Mission control statistics](docs/screenshots/mission-control.png)

---

## Requirements

* **Node.js**: version 20.0.0 or newer.
* **Hermes Agent CLI**: `hermes` must be installed and accessible on your `PATH`.
* **OpenCode CLI** (optional): `opencode` on `PATH` if monitoring OpenCode runtimes.

---

## Installation and Setup

### Option 1: Windows (Native PowerShell or CMD)

1. Clone the repository and enter the directory:
   ```powershell
   git clone https://github.com/Raphonkzy/batcave-agent.git
   cd batcave-agent
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Build the frontend and backend:
   ```powershell
   npm run build
   ```

4. Start the server:
   ```powershell
   npm start
   ```

5. Open your browser at `http://127.0.0.1:3001`.

To run `batcave` globally as a terminal command on Windows:
```powershell
npm link
batcave
```

---

### Option 2: Linux and macOS

#### Automated Installation

Run the one-line installer:
```bash
curl -fsSL https://raw.githubusercontent.com/Raphonkzy/batcave-agent/main/install.sh | bash
```

Then start the dashboard:
```bash
batcave
```

#### Run as a Background Service at Boot (Linux systemd)

To install Batcave as a persistent user service managed by systemd:
```bash
curl -fsSL https://raw.githubusercontent.com/Raphonkzy/batcave-agent/main/install.sh | bash -s -- --service
loginctl enable-linger $USER
```

#### Update or Uninstall

* **Update**: Rerun the install script command.
* **Uninstall**: Run `curl -fsSL https://raw.githubusercontent.com/Raphonkzy/batcave-agent/main/install.sh | bash -s -- --uninstall`

---

### Remote Server Access

Batcave binds strictly to localhost (`127.0.0.1`) for network security. To access a Batcave instance running on a remote host or VPS, forward the port over SSH:

```bash
ssh -L 3001:127.0.0.1:3001 user@remote-server-ip
```

Then navigate to `http://127.0.0.1:3001` in your local browser.

---

## Stopping the Server

### Interactive Terminal

If Batcave is running in an active terminal window:
1. Press `Ctrl + C`.
2. When prompted with `Terminate batch job (Y/N)?` on Windows, press `Y` and Enter.

### Background Process Cleanup

If the terminal was closed while Batcave was running, terminate the process holding port 3001:

* **Windows PowerShell**:
  ```powershell
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force
  ```
  Or stop all Node processes:
  ```powershell
  Stop-Process -Name node -Force
  ```

* **Linux / macOS**:
  ```bash
  kill $(lsof -t -i:3001)
  ```

---

## CLI Reference

The `batcave` binary accepts the following arguments:

```text
Usage: batcave [options]
       batcave access-code <status|new|off>
       batcave profile-lock <status|off>

Options:
  -p, --port <port>  Port to listen on (default: 3001, or BATCAVE_PORT)
  -v, --version      Print version number
  -h, --help         Show help message

Access Code:
  batcave access-code status  Show current access code enforcement status
  batcave access-code new     Generate and print a new random access token
  batcave access-code off     Disable access code authentication

Profile Lock:
  batcave profile-lock status  List agent profiles locked by PIN
  batcave profile-lock off     Remove the PIN and unlock all profiles
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `BATCAVE_PORT` | Port for the HTTP server (aliases: `RUANG_PORT`, `MISSION_CONTROL_PORT`) | `3001` |
| `BATCAVE_HERMES_ROOT` | Custom path to the Hermes data directory (profile and state root) | Standard platform location |
| `HERMES_HOME` | Alternate Hermes configuration path | Standard platform location |

---

## 3D Tactical Manor (Procedural Architecture)

Batcave renders an interactive 3D tactical command deck using Three.js and React Three Fiber. All geometry and materials are generated procedurally, requiring no heavy external 3D asset downloads.

### Tactical Camera Viewpoints

Switch between 5 primary vantage points:
* **Command Deck**: The central operations war table, multi-screen consoles, and active agent terminals.
* **Hangar Bay**: The vehicle depot housing interceptors, tactical transports, and subterranean wet docks.
* **Manor Lobby**: The surface entrance featuring twin staircases and meeting areas.
* **Grand Manor**: The upper foyer, strategy library, and private briefing suites.
* **Full Overview**: Complete cross-section view showing both levels, the cliffside, and the waterfall.

### Adaptive Performance (LOD)

The renderer monitors real-time frame rates:
* **High**: Full shadows, reflective water surfaces, and multi-light rendering.
* **Medium**: Reduced shadow cascades and simplified material shaders.
* **Low**: Disabled shadow maps and ambient-only lighting for low-power hardware.

If rendering drops below 30 FPS for 5 consecutive seconds, Batcave steps down the quality level automatically.

### Development Mock Agents

Test the 3D layout without requiring an active Hermes agent roster:
* `http://localhost:5173/?mockAgents=12`: Spawns a 12-agent squad with randomized activity states.
* `http://localhost:5173/?mockAgents=cycle`: Runs an animated stress test scaling from 1 to 40 agents.
* `http://localhost:5173/?noAutoQuality`: Locks the chosen graphics quality for benchmarking.

---

## Dashboard Pages

| Page | Route | Description |
|---|---|---|
| **Batcave** | `/` | 3D operations floor with HUD metrics covering active agents, gateways, tasks, and cron jobs. |
| **Agents** | `/agents` | Profile list from `hermes profile list`, active model configurations, and runtime states. |
| **Tasks** | `/tasks` | Hermes Kanban visualizer with full task inspection modal (`hermes kanban show <id> --json`). |
| **Calendar** | `/calendar` | Monthly grid displaying cron jobs, schedules, intervals, and execution statuses. |
| **Activity** | `/activity` | Chronological session timeline, active messaging channels, and execution durations. |
| **Memory** | `/memory` | Inspect `SOUL.md`, `MEMORY.md`, and context files with character count monitors. |
| **Folders** | `/folders` | Sandboxed file browser for agent profile roots with path traversal guards. |
| **Logs** | `/logs` | Live output from `hermes logs agent`, `hermes logs gateway`, and `hermes logs errors`. |
| **Stats** | `/stats` | Cumulative token counts, model distributions, and tool usage rankings. |
| **Settings** | `/settings` | Security options for web access codes and agent profile privacy PINs. |

---

## Reliability and Performance Design

Batcave is tuned to handle the execution overhead of the Hermes CLI:

* **Command Timeout (`25,000 ms`)**: Accommodates Python bootstrap times and SQLite database lock acquisition on high-density agent configurations.
* **Concurrency Limiter (`2`)**: Limits concurrent subprocess execution to prevent process saturation while polling multi-agent profiles.
* **Response Cache (`15,000 ms`)**: Caches snapshot data to prevent repetitive disk I/O. Add `?fresh=1` to any API request to bypass the cache.

---

## Security and Privacy

* **Read-Only Invariant**: Batcave only invokes hardcoded read queries. It cannot create, delete, or modify files or agent states.
* **Secret Redaction**: API keys (such as `sk-...`), environment variables, and authentication tokens are masked before responses are returned to the client.
* **Path Traversal Protection**: Folder navigation is strictly confined to designated agent profile directories.
* **Access Code**: Locks all dashboard endpoints behind an access token or custom passphrase.
* **Profile Lock**: Withholds specific agent profiles and sensitive logs behind a 6-digit numeric PIN.

---

## Development

```bash
git clone https://github.com/Raphonkzy/batcave-agent.git
cd batcave-agent
npm install

# Start development servers (Vite client on :5173, API on :3001)
npm run dev

# Code verification
npm run lint
npm test
npm run build
```

---

## License

[MIT](LICENSE) © 2026 Raphonkzy
