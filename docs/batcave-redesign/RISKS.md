# Batcave v2 - Risk Register & Mitigation Strategy (RISKS.md)

| Risk ID | Description | Severity | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-001** | Missing Gilroy font files in `public/fonts/gilroy/` | Low | High | Pre-configured `@font-face` with `font-display: swap` cascading seamlessly to Plus Jakarta Sans. Zero build or runtime failures. |
| **RSK-002** | Software WebGL latency in headless environments | Medium | High | Rely on relative draw calls, triangle counts, and geometry batch metrics rather than raw FPS. Enforce instancing. |
| **RSK-003** | Incomplete Kanban task assignment data in Hermes runtime | Medium | Medium | Tier 2 implementation: cleanly display unassigned tasks in dedicated swimlane; no synthetic attribution. |
| **RSK-004** | Hot desking overflow with high agent counts (N > 40) | Medium | Low | Maintain dynamic anchor allocation in `computeLayout.ts`; golden test verifies identical anchor mapping for N=0..45. |
| **RSK-005** | Three.js chunk size increase from exterior environment meshes | Medium | Medium | Use procedural low-poly geometries and instancing for trees/shrubs/fences rather than external textures or heavy geometry. |
