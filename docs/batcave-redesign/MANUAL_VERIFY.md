# Batcave v2 - Manual Verification Runbook (MANUAL_VERIFY.md)

This runbook outlines manual verification procedures for visual, interactive, and functional inspection.

## 1. Local Server Launch
```bash
npm run dev
# or concurrently: npm run dev:server and npm run dev:client
```
Access URL: `http://localhost:5173`

## 2. 3D Camera Presets Verification
Navigate to `http://localhost:5173/?mockAgents=12#/batcave`
Test all 6 camera presets in the camera toolbar:
1. **Exterior** (New): High angle view of Wayne Manor exterior grounds, front lawn, gated perimeter, and driveway.
2. **Grand Manor**: Upper mezzanine level cutaway showing executive suites, library, and terrace pool.
3. **Manor Lobby**: Ground level showing the grand reception, central fireplace, chesterfield seating, and twin bifurcated staircases.
4. **Command Deck**: Subterranean level showing operations war room, monitors, and Batcomputer console.
5. **Hangar Bay**: Vehicle staging area showcasing the tactical fleet.
6. **Full Overview**: Complete vertical cutaway showing both surface estate and subterranean cavern with waterfall.

## 3. The Sims Navigation Verification
- **Level Switching**: Use `[` and `]` or PageUp/PageDown to cycle levels.
- **Wall Cutaway Modes**: Toggle between Walls Up, Cutaway, and Walls Down.
- **Rotation Snapping**: Press `Q` and `E` to snap rotate 90 degrees smoothly.
- **Follow Cam**: Click on an agent tag or press `F` to focus and follow the agent. Press `Esc` to release.

## 4. Missions Page Verification
Navigate to `http://localhost:5173/#/missions`
- Verify 3 tabs: **Swimlane**, **List**, **Flow**.
- Confirm task cards display task title, priority badge, and assigned agent.
- Confirm unassigned tasks are cleanly partitioned in the `Unassigned` lane with zero fabricated attribution.
- Confirm "Locate in 3D" button navigates to the Batcave 3D scene and centers camera on the assigned agent.

## 5. 2D Pixel Fallback Verification
Open `http://localhost:5173/#/batcave` in a browser or environment with WebGL disabled (or via dev parameter).
- Verify 2D room layouts render with updated Gilroy typography and consistent Batcave dark tactical palette.
