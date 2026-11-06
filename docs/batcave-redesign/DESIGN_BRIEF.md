# Batcave v3: Master Design Brief (Minimal Obsidian & Sims 3D Overhaul)

Dokumen ini merupakan Design Brief lengkap yang menjadi acuan eksekusi otonom Batcave v3 sesuai spesifikasi `TASK.md`.

---

## 1. Sistem Desain: "Minimal Obsidian"

### 1.1 Filosofi
Minimalis, tenang, spasi lega, hierarki dibangun lewat tipografi dan hairline 1px (bukan kotak tebal atau shadow berat), aksen tunggal kuningan hangat (`#e8b65b`), data sebagai fokus utama.

### 1.2 Token CSS Sumber Tunggal
```css
:root {
  /* Permukaan & Background */
  --bg: #0d0e11;
  --surface-1: #14161a;
  --surface-2: #1b1e23;
  --line: #262a31;

  /* Tipografi Teks */
  --text: #f1efea;
  --text-2: #a3a6ad;
  --text-3: #6e727a;

  /* Aksen Tunggal */
  --accent: #e8b65b;
  --accent-ink: #1a1405;

  /* Status Agent (Dot Halus) */
  --st-working: #7bd3a0;
  --st-collab: #8fb8ff;
  --st-reviewing: #c9a7ff;
  --st-deploying: #ffb86b;
  --st-triage: #ff7a7a;
  --st-idle: #7c808a;

  /* Bentuk & Spasi */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 20px;
  --r-pill: 999px;
  --space: 8px;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
}
```

### 1.3 Tipografi (Gilroy & Fallback)
- **Display (Judul Halaman)**: Gilroy 800 (Bold/Extrabold), 40px/44px, tracking -0.02em
- **H2 (Seksi)**: Gilroy 700, 22px/28px
- **H3 (Item/Sub)**: Gilroy 600, 16px/22px
- **Body**: Gilroy / Plus Jakarta Sans 400, 14px/22px (minimum 12px)
- **Label / Tag**: 500, 12px/16px, UPPERCASE, tracking 0.08em, `--text-3`
- **Metrik Angka**: 700, 28px - 48px, `tabular-nums`
- **Monospace (Logs, CLI)**: JetBrains Mono 400, 12px/18px

---

## 2. Shell & Navigasi

### 2.1 Topbar (48px, transparan, backdrop-blur)
```
+------------------------------------------------------------------+
| [◆ batcave]            [ ⌘K  Cari halaman atau agent… ]   ● 12   |
+------------------------------------------------------------------+
```
- **Kiri**: Wordmark `◆ batcave`
- **Tengah**: Command Palette button (`⌘K` / `Ctrl+K`)
- **Kanan**: Badge hitungan agent aktif (`● 12`)

### 2.2 Floating Bottom Dock (Halaman Non-Home)
```
+------------------------------------------------------------------+
|        ( Batcave  Agents  Missions  Tugas  Jadwal  ⋯ )           |
+------------------------------------------------------------------+
```
Floating dock mengambang di bawah halaman, menampilkan 5 rute primer + menu `⋯` untuk rute lainnya.

---

## 3. Wireframe ASCII 11 Rute + LockScreen

### 3.1 `#/batcave` (Home 3D HUD ala The Sims)
```
+------------------------------------------------------------------+
| [◆ batcave ▾]                              ● 12 aktif · 3 idle   |
|                                                                  |
|                       ( KANVAS 3D PENUH )                        |
|                                                                  |
| +--------------------+                     +-------------------+ |
| | [avatar] Jason     |  [▲] LANTAI 2       |  ⟲   ⟳   －  ＋   | |
| | Working · 14m      |  [ Lobby ]          |  [⌂ reset] [◎ F]  | |
| | task: "Audit…"     |  [▼]                |  Preset: ▾        | |
| | model · gateway    |  Dinding: ◐ ▣ ▭     |                   | |
| +--------------------+                     +-------------------+ |
|    (Panel Agent)       (Dock Level/Dinding)     (Dock Kamera)    |
+------------------------------------------------------------------+
```

### 3.2 `#/agents` (Hairline Rows)
```
Agents                                         [Semua ▾] [Cari…]
12 agent · 9 aktif
----------------------------------------------------------------
● jason     Working     model-x      gateway-a      14m   ›
● bruce     Reviewing   model-y      gateway-a       3m   ›
○ alfred    Idle        model-z      gateway-b       —    ›
----------------------------------------------------------------
```

### 3.3 `#/usage` (Big Metrics & Line Chart)
```
Usage & Tokens
Penggunaan komputasi dan token Hermes Agent

[ 2.45M ]                [ $ 42.10 ]              [ claude-3-5-sonnet ]
Total Token              Estimasi Biaya           Model Teratas
----------------------------------------------------------------
[~~~~~~~~~~~~~~~~ KANVAS / SVG LINE CHART 100% WIDE ~~~~~~~~~~~]
----------------------------------------------------------------
Model Breakdown:
claude-3-5-sonnet    1.82M  [=======================    ]  74%
gpt-4o                 510k  [======                     ]  21%
gemini-1.5-pro        120k  [==                         ]   5%
```

### 3.4 `#/task-board` (Kanban Hairline)
```
Task Board                                     [Filter ▾] [Cari…]
18 tugas · 4 kolom
----------------------------------------------------------------
IN PROGRESS (4)      | REVIEW (3)           | DONE (11)
--------------------+----------------------+--------------------
Implement HUD Sims  | Verify AA Contrast   | Create Tokens
● High · Tim        | ● Medium · Barbara   | ○ Alfred
--------------------+----------------------+--------------------
```

### 3.5 `#/calendar` (Agenda Kronologis)
```
Calendar & Schedules
Jadwal eksekusi cron dan otomasi background

HARI INI (Kamis, 6 Nov)
  09:00   System Health Check          [setiap 1 jam]     dalam 12 mnt ›
  14:00   Token Audit Sync             [setiap 6 jam]     dalam 5 jam  ›
BESOK (Jumat, 7 Nov)
  00:00   Daily Database Backup        [harian]           dalam 15 jam ›
```

### 3.6 `#/activity` (Vertical Stream Timeline)
```
Activity Feed
Live event streaming dari session & gateway

|  10:24:12  [session]  Agent Jason started task 'Audit v2'
|  10:22:05  [gateway]  Channel telegram payload delivered (200 OK)
|  10:19:30  [cron]     Routine cache garbage collector completed
```

### 3.7 `#/memory` (2-Kolom: Daftar Berkas & Pratinjau)
```
Memory & Persona
Inspeksi file instruksi kepribadian dan persistent memory

BERKAS (3)               | PRATINJAU: SOUL.md
-------------------------+--------------------------------------
● SOUL.md        4.2 KB  | # Soul Configuration
○ MEMORY.md      8.9 KB  | Kamu adalah batcave orchestrator...
○ USER.md        1.1 KB  | 
                         | Kapasitas Karakter: 4,210 / 12,000
                         | [====================                  ] 35%
```

### 3.8 `#/folders` (Breadcrumb & File Row)
```
Workspace Folders
Penjelajah folder tersandbox dengan proteksi path traversal

batcave / src / scenes / manor /
----------------------------------------------------------------
📁 components/                             Folder         14 files
📄 ExteriorGrounds.tsx                     TypeScript     8.2 KB
📄 ManorCamera.tsx                         TypeScript     4.1 KB
```

### 3.9 `#/logs` (Full Height Mono Panel)
```
System Logs                                [Semua Level ▾] [☑ Ikuti Ekor]
Streaming log tail dari agent, gateway, dan proses background
----------------------------------------------------------------
[10:24:11] [INFO] [gateway] Listening on ws://localhost:8080/events
[10:24:12] [DEBUG][jason] Loading world config coordinates...
[10:24:13] [INFO] [tim] Floor layout computed for 12 agents.
```

### 3.10 `#/settings` (Kolom Ramping Maks 640px)
```
Settings
Pengaturan keamanan dan sesi lokal
----------------------------------------------------------------
ACCESS CODE
Sesi saat ini diamankan dengan Access Code.
[ Ubah Access Code ]           [ Nonaktifkan ]
----------------------------------------------------------------
PROFILE LOCK PIN
PIN perlindungan identitas agent lokal.
[ Ganti PIN ]
```

### 3.11 `#/missions` (Swimlane Per Agent)
```
Missions Swimlane                              [Tier 2 Mode] [SIMULASI]
Relasi task nyata ke masing-masing agent

JASON   | [Task: Verify Lot Gate (Reviewing)]
BRUCE   | [Task: Coordinate Brief (Working)] [Task: Merge Wave (Pending)]
TIM     | [Task: Lobby Placement (Working)]
ALFRED  | (Idle / No active task)
----------------------------------------------------------------
UNASSIGNED TASKS (Belum terhubung agent tertentu):
[Triage: Memory Overflow]  [Background: Prune Logs]
```

### 3.12 LockScreen / PIN Modal
```
+------------------------------------------------------------------+
|                                                                  |
|                            ◆ batcave                             |
|                                                                  |
|                      Masukkan Access Code                        |
|                     [ •••••••••••••••••• ]                       |
|                                                                  |
|                           [ Buka ]                               |
+------------------------------------------------------------------+
```

---

## 4. Denah Lot 3D & Pintu Utama Manor

### 4.1 Titik Ambang & Vektor Hadap Pintu (Section 6.1)
- **Titik Ambang `D`**: `[0, SURFACE_Y, -8.0]` (tengah fasad utara grand foyer)
- **Vektor Hadap Luar `F`**: `[0, 0, -1]` (mengarah ke luar, ke utara/arah Z negatif)
- **Grand Gate**: `[0, SURFACE_Y, -46.0]`
- **Jalan Utama**:
  1. Teras 2 anak tangga di depan ambang: `Z: [-8.0, -9.5]`
  2. Jalan setapak batu (lebar 2.0m): `Z: [-9.5, -20.0]`
  3. Bundaran taman formal dengan 2 lentera taman: `Z: [-20.0, -30.0]`
  4. Driveway batu lebar 4.0m: `Z: [-30.0, -46.0]`
  5. Semua titik jalan memenuhi: `dot(sub(p, D), F) >= -0.25`

### 4.2 Cakupan Rumput (Section 6.3)
- Bidang tanah membentang `X: [-96, 96]`, `Z: [-144, 96]` (>= 3x dimensi lot).
- Tekstur rumput prosedural multi-tone (3-tone noise) menutupi 100% tanah luar.
- Rasio rumput di area luar lot >= 98%.

---

## 5. Daftar File Pengerjaan

| Modul | File yang Dibuat / Diubah |
| :--- | :--- |
| **Token & Primitive UI** | `src/styles.css`, `src/components/ui/Primitives.tsx`, `tests/tokens-contrast.test.ts` |
| **Shell & Navigasi** | `src/App.tsx`, `src/components/shell/AppHeader.tsx`, `src/components/shell/BottomDock.tsx`, `src/components/shell/CommandPalette.tsx` |
| **World Config & Lot** | `src/scenes/manor/worldConfig.ts`, `src/scenes/manor/ExteriorGrounds.tsx`, `tests/path-orientation.test.ts`, `tests/grass-coverage.test.ts` |
| **Sims HUD & Kamera** | `src/pages/ManorOffice3D.tsx`, `src/components/hud/SimsHud.tsx`, `src/components/hud/AgentRadialMenu.tsx`, `tests/camera-rig.test.ts` |
| **Halaman-Halaman UI** | `src/pages/Agents.tsx`, `src/pages/Usage.tsx`, `src/pages/TaskBoard.tsx`, `src/pages/Calendar.tsx`, `src/pages/Activity.tsx`, `src/pages/Memory.tsx`, `src/pages/Folders.tsx`, `src/pages/Logs.tsx`, `src/pages/Settings.tsx`, `src/LockScreen.tsx`, `src/pages/Missions.tsx`, `src/pages/Office.tsx` |
| **Verifikasi Gate** | `scripts/verify/verify-harus-berbeda.ts`, `tests/harus-berbeda.test.ts`, `docs/batcave-redesign/REPORT.md` |
