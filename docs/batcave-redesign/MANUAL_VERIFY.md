# Batcave Tactical Manor - Manual Verification Runbook (MANUAL_VERIFY.md)

This runbook outlines manual verification procedures for visual, interactive, and functional inspection of the 3-level Simulation Manor, Lot HUD, Persistent SideNav, and Agent Interactions.

## 1. Local Server Launch
```bash
npm run dev
# or concurrently: npm run dev:server and npm run dev:client
```
Access URL: `http://localhost:5173`

## 2. Persistent Side Navigation (ADR-005)
1. Verify `SideNav` is present and persistent across all 11 routes (`/office`, `/agents`, `/missions`, `/tasks`, `/calendar`, `/usage`, `/activity`, `/memory`, `/folders`, `/logs`, `/settings`).
2. Collapse/expand button toggles between 224px (expanded labels) and 64px (compact icon rail).
3. On viewport widths < 900px, verify SideNav transforms into an accessible off-canvas drawer controlled by `.mo-nav-toggle` in the header.

## 3. 3-Level Elevator & Wall Modes
Navigate to `http://localhost:5173/?mockAgents=12#/office`
1. **Level Switching**:
   - Test elevator buttons in center HUD cluster: **Lantai 2** (`upper`), **Grand Manor** (`ground`), **Command Deck** (`deck`).
   - Test elevator shortcut keys: `[` / `PageUp` (Naik) and `]` / `PageDown` (Turun).
   - Badge counts on buttons reflect actual agents stationed on each floor.
2. **Procedural Roof & Exterior Visibility**:
   - On **Lantai 2** with Wall Mode **Up** (`1`): Verify procedural slate shingle roof renders with stone chimney over hearth and copper ridge caps.
   - Switch to **Cutaway** (`2`): Verify roof is hidden and south/east facing walls drop to 1.0m to expose the upper suites.
   - Switch to **Down** (`3`): Verify all walls drop to 0.3m low curb exposing floorplan.
3. **Grand Manor & Command Deck**:
   - Grand Manor displays foyer reception, hearth lounge, billiards, spa, dining, and pool terrace.
   - Command Deck displays operations war room, monitors, suit vault, armory, and vehicle fleet in hangar bay.

## 4. Agent Interaction & Follow Camera
1. **Hover**: Moving pointer over an agent in 3D highlights the agent with a cursor pointer and displays name + status tooltip.
2. **Single Click**:
   - Click agent mesh or 2D label: 3D rotating diamond marker (plumbob) appears overhead matching agent state color (`--st-*`).
   - 5-slot radial menu opens at click location (Inspect, Follow, Locate, Missions, Logs).
   - Left HUD cluster updates with agent summary and quick action buttons (without popping modal detail directly).
3. **Double Click / Follow**:
   - Double click agent mesh or click "Follow": camera smoothly tracks agent movement across frames (`useFrame`).
   - Press `Esc` or click ground (`onPointerMissed`) to release follow mode and clear selection.
4. **Roster Strip**:
   - Click any agent avatar in the top roster strip: immediately selects agent, auto-switches floor level if on another level, and centers camera.
5. **Cross-Page Filter**:
   - Clicking "Missions" or "Logs" from radial menu or HUD navigates to `#/missions?agent=<id>` or `#/logs?agent=<id>`, filtering data client-side.

## 5. Camera & Safe-Area Verification
1. **Snap Yaw**: Press `Q` and `E` to rotate view in 90-degree steps.
2. **Zoom**: Press `+` and `-` to step zoom.
3. **Reset**: Press `R` to return to default view.
4. **Safe Area**: Verify bottom HUD never overlaps building geometry or agent selection due to dynamic `--hud-bottom` margin calculations.

## 6. Responsive Layouts & Performance
1. Test responsive viewports: 390px, 768px, 1280px, 1920px without horizontal scroll.
2. Verify draw calls stay strictly $\le 150$ on Medium (accessible via `window.__batcaveRenderStats.calls`).
3. Verify exactly 6 lights in scene (`window.__batcaveRenderStats.lights === 6`).
