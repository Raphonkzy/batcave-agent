# PERINTAH KERJA: Batcave Manor ala The Sims (layout, 3 level, tampak luar, interaksi agent)

Kamu adalah engineer senior (React, three.js / react-three-fiber, CSS). Kerjakan semua bagian di bawah sampai selesai dan terverifikasi. Jangan berhenti di tengah. Jangan menambah fitur di luar daftar. Jangan menebak: baca file yang disebut sebelum mengubahnya.

Repo: `batcave - workspace` (Vite + React + three/r3f). Branch kerja: buat branch baru dari branch aktif, misalnya `feat/sims-manor`. Commit per fase.

---

## 0. Aturan keras (jangan dilanggar)

1. **`server/` tidak boleh diubah.** Dua kegagalan test lingkungan Windows (symlink EPERM, mode file 0o600) sudah ada sejak awal dan boleh tetap gagal. Semua test lain harus hijau.
2. **Tidak ada aset eksternal.** Semua 3D prosedural (tanpa file gambar/model, tanpa CDN). Font Gilroy tetap dengan fallback yang ada (ADR-001).
3. **Tepat 6 lampu** di scene (`ThemeManor.tsx > Lights`). Jangan tambah lampu. Pencahayaan tambahan lewat material emissive atau environment.
4. **Anggaran draw call** (Medium, 1280x800): tiap view maksimal 150 draw call. Gunakan instancing/merge geometry (`Instanced.tsx`, `batches.ts`). Dinding, atap, dan jendela baru wajib di-merge per material.
5. **`src/originality.test.ts` harus lulus.** Jangan menulis nama karakter/kendaraan yang dilindungi di kode, string UI, komentar, atau docs. Jangan menulis merek "The Sims" di string UI. Di komentar/docs tulis "gaya simulasi rumah" atau "dollhouse view". Nama komponen lama `SimsHud` boleh di-rename ke `LotHud` (pakai `smart_relocate`/`semantic_rename` agar import ikut berubah).
6. **Invariant dan gate lama harus tetap hijau**: `scripts/guard-invariants`, `tests/harus-berbeda.test.ts`, `tests/baseline/*`. Baca dulu `docs/batcave-redesign/BASELINE/old-ui-landmarks.json`. Selector lama (`#app-sidebar`, `.drawer`, `.header-title`, `.menu-button`, dan sejenisnya) **tidak boleh muncul lagi**. Pakai nama baru berawalan `mo-` (contoh: `.mo-side-nav`, `.mo-nav-toggle`). 11 rute, parameter query, dan mekanisme lock/security tidak boleh berubah.
7. **Konflik desain yang disengaja.** `DESIGN_BRIEF.md` berkata "tanpa sidebar". Pemilik sekarang meminta menu samping yang selalu terlihat. Tambahkan **ADR-005** di `docs/batcave-redesign/DECISIONS.md` yang mencatat perubahan ini dan alasannya (menu tidak perlu dibuka lewat search). Perbarui bagian 2 `DESIGN_BRIEF.md` dan wireframe 3.1.
8. Jalankan `npm run lint`, `npm test`, `npm run build` di akhir tiap fase. Jangan menambah test baru kecuali disebut di bagian 9. Test lama yang rusak karena perubahan yang diminta boleh diperbarui, dengan alasan dicatat di commit message.
9. Jangan menjalankan dev server di foreground. Untuk pengecekan visual, jalankan `npm run dev` sebagai proses background lalu ambil screenshot (cek `scripts/verify/` dan folder `tests/` untuk harness screenshot yang sudah dipakai di `BASELINE/screens`; kalau tidak ada, pakai Playwright).

---

## 1. Kondisi saat ini (hasil audit docs dan kode; ini yang harus diperbaiki)

| #   | Temuan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Lokasi                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A   | Menu hanya bisa dibuka lewat tombol search / `⌘K` / tombol `M`. Halaman Batcave (home) tidak punya menu navigasi sama sekali. Halaman lain memakai dock mengambang di bawah.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `App.tsx`, `AppHeader.tsx`, `BottomDock.tsx`, `CommandPalette.tsx`                              |
| B   | "Level" di HUD sebenarnya memutar 6 view kamera (`exterior, manor, lobby, deck, hangar, overview`), bukan lantai. Tombol naik/turun mengubah preset kamera, bukan level bangunan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `ManorOffice3D.tsx` (`LEVEL_CYCLE`), `SimsHud.tsx` (`LEVEL_NAMES`)                              |
| C   | `wallMode` (Up / Cutaway / Down) hanya disimpan sebagai state dan tidak dikirim ke scene. Tombol 1/2/3 tidak berefek. Dinding manor memakai cutaway tetap (dinding selatan dan timur setinggi 1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `ManorOffice3D.tsx`, `SurfaceManor.tsx` (`CUTAWAY_WALL = 1`)                                    |
| D   | **Tidak ada atap sama sekali** dan tidak ada tampak luar tertutup. Manor tidak bisa dilihat sebagai rumah utuh dari luar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `SurfaceManor.tsx`, `ThemeManor.tsx`                                                            |
| E   | Gambar terpotong. Penyebab yang terlihat di kode: (1) preset kamera dihitung dengan FOV 40 tetap dan hanya menjauh bila aspect < 1.35 (`ManorCamera.tsx > goal`), tidak menghitung ukuran bangunan sebenarnya; (2) panel HUD, chip statistik, tombol stage, floor switcher, dan QualityPicker menutupi kanvas tanpa area aman; (3) batas pan (`preset.pan`) menjepit target; (4) CSS lama `.office-3d` (aspect-ratio 2.1/1, border 8px, min-height) bertabrakan dengan `.office-stage` (`calc(100dvh - 49px)`) di dalam `.mo-page-home .mo-page-wrapper` (`calc(100vh - 48px)`, `overflow: hidden`). Tinggi dihitung dua kali dengan satuan berbeda (`dvh` dan `vh`). | `ManorCamera.tsx`, `styles.css` (sekitar baris 1047, 1086-1148, 1396-1405, 2008+), `Office.tsx` |
| F   | Tombol zoom di HUD kosong (`onZoom={() => {}}`). `panMode`, `showUpper`, `sleep` adalah konstanta tanpa kontrol.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `ManorOffice3D.tsx`                                                                             |
| G   | Klik agent di mesh 3D memanggil `onSelect` yang langsung membuka dialog detail. Radial menu hanya muncul bila yang diklik label 2D. Follow dan Locate melakukan hal yang sama. `followTarget` dibuat dengan `useMemo` yang mengambil posisi sekali (snapshot), jadi kamera tidak mengikuti agent yang berjalan. Aksi Missions/Logs hanya pindah rute tanpa filter agent (`Missions.tsx` belum mendukung filter agent).                                                                                                                                                                                                                                                | `ManorOffice3D.tsx`, `Crew.tsx`, `ManorCamera.tsx`, `AgentRadialMenu.tsx`                       |
| H   | Kontrol kamera ganda dan tumpang tindih: `.office-3d-tools`, `.office-3d-floors`, `.manor-camera-widget`, `.manor-quality`, `.office-hud`, `.office-stage-tools`, ditambah HUD baru. Banyak CSS lama tidak terpakai.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `styles.css`, `Office.tsx`, `ManorQuality.tsx`                                                  |
| I   | Teks UI campur Indonesia dan Inggris dalam satu kontrol.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | HUD, dock                                                                                       |

Ketinggian level yang sudah ada (`src/utils/layout/dimensions.ts`): Command Deck `DECK_Y = 0` (langit-langit gua `CAVE_CEILING = 4`, basin `-2`), Grand Manor lantai dasar `SURFACE_Y = 11`, Lantai 2 `UPPER_Y = 14.5`. Pintu masuk dan arah depan lot ada di `src/scenes/manor/worldConfig.ts` (`D = [0, 11, -8]`, `F = [0, 0, -1]`). Jalan masuk, gerbang, rotunda, dan rumput ada di `ExteriorGrounds.tsx`. Pakai semuanya, jangan dibuat ulang.

---

## 2. Target akhir (acuan: game simulasi rumah "dollhouse")

Pengguna melihat sebuah rumah/lot dari sudut isometrik, bisa memutar 90 derajat, naik-turun lantai, membuka atau menurunkan dinding, melihat rumah utuh dengan dinding dan atap dari luar, dan mengklik penghuni (agent) untuk memilih dan berinteraksi. Antarmuka bersih, rapi, konsisten dengan sistem desain Minimal Obsidian, tanpa elemen saling menutupi, tanpa gambar terpotong.

---

## 3. FASE 1: Shell dan menu samping selalu terlihat

1. Buat `src/components/shell/SideNav.tsx` (nama kelas `mo-side-nav`). Isi: logo/wordmark di atas, daftar **semua 11 rute** (Batcave, Agents, Missions, Task Board, Calendar, Usage, Activity, Memory, Folders, Logs, Settings) dengan ikon 1.5px (pakai `Icon` di `components/ui/Primitives.tsx`; tambah ikon yang belum ada di file itu). Item aktif ditandai garis aksen kuningan `--accent` dan `aria-current="page"`. Kelompokkan dengan label kecil: _Operasi_ (Batcave, Agents, Missions, Task Board, Calendar) dan _Sistem_ (Usage, Activity, Memory, Folders, Logs, Settings).
2. Lebar: 224px terbuka, 64px mode rail (ikon saja + tooltip). Tombol collapse di bawah. Simpan pilihan di `localStorage` key `batcave.sideNav` (`open` | `rail`). **Default `open` di layar >= 1100px, `rail` di 760-1099px, dan di bawah 760px berupa drawer** yang dibuka tombol `.mo-nav-toggle` di topbar (jangan pakai nama `.menu-button`). Drawer menutup saat memilih rute, `Esc`, atau klik di luar, dengan focus trap dan `aria-modal`.
3. Menu **selalu tampil di semua halaman, termasuk Batcave (home)**. Hapus `BottomDock` dari `App.tsx` (hapus file dan CSS `.mo-bottom-dock*`, `.mo-dock-*` yang jadi tidak terpakai). Palette `⌘K` tetap ada sebagai jalan pintas tambahan, bukan satu-satunya jalan. Tombol `M` untuk membuka palette dipertahankan.
4. Topbar tetap 48px: kiri brand (dan `.mo-nav-toggle` di mobile), tengah tombol search, kanan hitungan agent aktif + refresh. Kolom navigasi memakai `position: sticky`/`fixed` di bawah topbar dan tingginya `calc(100dvh - 48px)` dengan scroll sendiri.
5. Struktur layout baru di `App.tsx`:
   ```
   .mo-app-container (grid: topbar di atas; di bawahnya [side-nav | main])
   ```
   Gunakan CSS grid dengan `grid-template-columns: var(--side-w) 1fr` dan `100dvh` di semua tempat (jangan campur `vh` dan `dvh`). Halaman Batcave: `main` mengisi sisa layar tanpa scroll halaman (`overflow: hidden`, `min-height: 0`). Halaman lain: `main` yang scroll, `.mo-page-wrapper` lebar maks 1200px, padding bawah 32px (padding 96px untuk dock dihapus).
6. Perbarui `tests/harus-berbeda.test.ts` / skrip verifikasi bila perlu; gate "HARUS BERBEDA" (selisih >= 35%) dan guard-invariants harus tetap hijau.

**Kriteria selesai fase 1:** di setiap rute, menu samping tampak tanpa klik apa pun, item aktif benar, tidak ada scroll horizontal di lebar 390, 768, 1280, 1920.

---

## 4. FASE 2: Kanvas penuh, tidak terpotong, dan area aman HUD

1. **Hapus CSS lama yang bertabrakan** untuk `.office-3d` (aspect-ratio, border, min-height 420) dan semua aturan tombol kamera/lantai lama yang tidak lagi dipakai (`.office-3d-tools`, `.office-3d-floors`, `.manor-camera-widget`, widget `Floors` di `Office.tsx`). Periksa dengan grep bahwa tidak ada referensi tersisa sebelum menghapus.
2. Kanvas mengisi 100% area `main` (`position: absolute; inset: 0`). Semua panel melayang di atasnya memakai grid overlay satu lapis:
   ```
   .mo-stage-overlay (position:absolute; inset:12px; display:grid;
     grid-template: "top top top" auto / "left . right" 1fr / "bottom bottom bottom" auto;
     pointer-events:none)  -> anak yang interaktif memakai pointer-events:auto
   ```
   Penempatan tetap: **atas-kiri** chip statistik ringkas (aktif/idle), **atas-kanan** pengaturan tampilan (kualitas, toggle 2D/3D, panel Tasks/Calendar/Tokens/Crew bawaan `Office.tsx`, dipindah ke satu toolbar rapi), **bawah** HUD 3 klaster (bagian 6). `QualityPicker` pindah ke toolbar atas-kanan, bukan melayang bebas. Baca `Office.tsx` penuh dulu dan pertahankan semua fungsinya (fallback 2D, overlay panel, dialog detail agent, kunci profil).
3. **Area aman untuk kamera.** Ukur tinggi/lebar HUD dengan `ResizeObserver`, tulis ke CSS variable `--hud-top`, `--hud-bottom`, `--hud-left`, `--hud-right`. Di `ManorCamera.tsx` ganti perhitungan `goal` supaya **seluruh bounding box level yang dipilih muat** di area bebas:
   - Hitung jarak kamera dari bounding box (dengan `fov` vertikal dan `aspect` sebenarnya, ditambah margin 8%), bukan dari `offset.length() * max(1, 1.35 / aspect)`.
   - Geser pusat tampilan memakai `camera.setViewOffset(...)` atau pergeseran target, sehingga model berada di tengah area bebas (di antara topbar HUD dan bar bawah), tidak di balik panel.
   - Dengarkan resize (`useThree().size`) dan hitung ulang. Setelah user memutar atau zoom manual, jangan memaksa kembali ke preset kecuali menekan Reset (`R`).
   - Longgarkan batas `preset.pan` agar rumah tidak terjepit; batas harus mencakup seluruh bounding box ditambah margin.
   - `maxPolarAngle` tetap di bawah horizon (`Math.PI/2 - 0.05`) supaya kamera tidak masuk ke bawah lantai.
4. Perbaiki tombol zoom: `onZoom` harus benar-benar mendekat/menjauh (tambah `zoom(dir)` ke `ManorCameraHandle`, ubah jarak dengan batas `minDistance/maxDistance`). Scroll wheel dan pinch tetap bekerja.
5. Tekan masalah kualitas gambar: `dpr={[1, 2]}`, `antialias` bukan `low`, `onPointerMissed` untuk deselect, dan `ResizeObserver` bawaan r3f bekerja karena kontainer punya ukuran pasti (bukan `height: auto`).

**Kriteria selesai fase 2:** screenshot tiap level dan tiap mode dinding pada ukuran 1280x720, 1366x768, 1920x1080, 2560x1080, 390x844 menunjukkan **seluruh bangunan level itu terlihat, tidak ada bagian terpotong di tepi, dan tidak ada yang tertutup panel**. Lampirkan screenshot ke `docs/screenshots/sims-manor/` dan rujuk di `docs/batcave-redesign/MANUAL_VERIFY.md`.

---

## 5. FASE 3: Hanya 3 level dan mode dinding yang benar-benar bekerja

### 5.1 Model data

Di `src/scenes/manor/ZoneLayout.ts` tambahkan (jangan hapus `ManorView` dulu, ubah bertahap):

```ts
export type Level = "deck" | "ground" | "upper"; // Command Deck, Grand Manor, Lantai 2
export type WallMode = "wallsUp" | "cutaway" | "wallsDown";
export const LEVELS: { id: Level; label: string; y: number }[] = [
  { id: "upper", label: "Lantai 2", y: UPPER_Y }, // paling atas dalam daftar
  { id: "ground", label: "Grand Manor", y: SURFACE_Y },
  { id: "deck", label: "Command Deck", y: DECK_Y },
];
```

- Hapus `exterior`, `lobby`, `hangar`, `overview` sebagai **level**. Preset kamera tidak hilang: jadikan `lobby` dan `hangar` sebagai _fokus zona_ kecil (lihat 5.4) dan `exterior`/`overview` digantikan oleh tampak luar di bagian 5.3.
- Simpan di `localStorage`: `batcave.level` (`deck|ground|upper`) dan `batcave.wallMode`. Tambahkan migrasi dari `batcave.manorView` lama (`deck|hangar` -> `deck`; `manor|lobby` -> `ground`; `exterior|overview` -> `upper`). Nilai tak dikenal jatuh ke default: `level = ground`, `wallMode = cutaway`.
- Perbarui `shownIn()` di `ManorOffice3D.tsx`, `showsDeck/showsManor/isDeckView/isManorView`, dan `Crew` visibility agar berdasar `Level`, bukan `ManorView`. Agent hanya digambar di level yang sedang ditampilkan; agent di level lain tidak tampil dan labelnya disembunyikan (periksa `LabelProjector` agar tidak menampilkan label agent yang tidak terlihat).

### 5.2 Kontrol level (panel lift, klaster tengah HUD)

- Tiga tombol vertikal bergaya panel elevator, urut atas ke bawah: **Lantai 2**, **Grand Manor**, **Command Deck**. Level aktif disorot; tiap tombol menampilkan jumlah agent di level itu.
- Tombol panah naik/turun di sampingnya. Kunci pintas `[`/`PageUp` (naik) dan `]`/`PageDown` (turun). Berhenti di batas (tidak berputar).
- Transisi: kamera terbang halus ke level baru (sudah ada mekanisme `flight`), lantai di atas level terpilih memudar keluar (opacity animasi 250 ms; `prefers-reduced-motion` = langsung ganti).
- Aturan tampil per level (konsisten dengan game simulasi rumah):
  | Level terpilih | Yang digambar |
  | --- | --- |
  | Command Deck | Gua + deck (ruang komando, operasi, vault, armory, server, forensik, latihan, hangar, catwalk). Manor di atasnya disembunyikan. |
  | Grand Manor | Lantai dasar manor + halaman/teras/kolam. Lantai 2 dan atap disembunyikan. Deck bawah tanah tidak digambar. |
  | Lantai 2 | Seluruh manor: lantai dasar + lantai 2 + atap (sesuai mode dinding). |
- Kendala: `shaft`/lift kaca (`VerticalShaft`) dan air terjun tetap konsisten di tiap level.

### 5.3 Mode dinding dan tampak luar (inti permintaan "seperti game simulasi rumah")

Sambungkan `wallMode` ke scene: `ThemeManor` -> `SurfaceManor`, `SubterraneanCave` (dan `HangarBay` bila ada dinding). Tiga mode (tombol `1`, `2`, `3`, dan kontrol di HUD):

| Mode                 | Perilaku                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Walls Up** (`1`)   | Semua dinding setinggi penuh pada level aktif (dan semua level di bawahnya). Di level **Lantai 2** atap ikut tampil, jadi rumah terlihat **utuh dari luar**: dinding luar, jendela, pintu depan, atap.                                          |
| **Cutaway** (`2`)    | Dinding yang menghadap kamera turun ke sekitar 1 unit; dinding yang membelakangi kamera tetap penuh. Dihitung dari sudut kamera (kuadran terdekat) dan berubah mulus saat kamera diputar 90 derajat (`Q`/`E`). Atap disembunyikan. **Default.** |
| **Walls Down** (`3`) | Semua dinding menjadi alas setinggi 0.3 supaya tata ruang terlihat jelas. Atap disembunyikan.                                                                                                                                                   |

Implementasi dinding:

- Ganti `CUTAWAY_WALL = 1` yang tetap dengan tinggi per dinding yang dihitung di `useFrame` (atau via uniform pada material) berdasarkan `wallMode` dan sudut azimut kamera. Gunakan instancing dengan atribut skala-Y per instans supaya tidak menambah draw call. Dinding interior tetap memakai `INTERIOR_WALL = 2.4` pada Walls Up, dan turun ke wainscot pada mode lain.
- Pintu dan jendela harus ikut turun/naik bersama dinding induknya (jangan melayang). Dinding turun memakai animasi (lerp, ~200 ms).
- Dinding luar bangunan harus tampak **solid dan rapi dari luar**: ketebalan nyata, trim/cornice di atas, plinth granit (sudah ada foundation curb), jendela kaca dengan bingkai, pintu depan ganda di titik `D` menghadap `F`, beranda/teras depan dan tangga masuk (sudah ada di `ExteriorGrounds`; sambungkan, jangan duplikat).
- **Atap prosedural** (file baru `src/scenes/manor/Roof.tsx`):
  - Atap joglo/hip/gable per sayap berdasarkan footprint zona permukaan (`layout.zones` untuk inti foyer-lounge, sayap barat, sayap timur, perpustakaan dua lantai lebih tinggi; teras kolam tidak beratap). Jangan sebuah kotak datar.
  - Kemiringan 30-35 derajat, overhang (eave) 0.6, ridge sejajar sisi terpanjang tiap sayap, dormer/cerobong asap kecil di atas perapian (`hearth`), jalur nok (ridge cap) berwarna kuningan/tembaga gelap.
  - Material: tekstur genteng prosedural (pola baris dari `textures.ts`), tanpa file gambar. Satu material sirap + satu material trim; merge geometri sehingga atap total <= 6 draw call.
  - Atap hanya terlihat pada `level === 'upper' && wallMode === 'wallsUp'`. Animasi: naik 1.5 unit sambil memudar (opacity), atau memudar saja bila reduced-motion. Atap tidak boleh menembus dinding lantai 2 atau perpustakaan.
  - Shadow: atap `castShadow` hanya di kualitas High; `receiveShadow` mati di Low.
- Kamera default untuk **level Lantai 2 + Walls Up** adalah **tampak depan-atas isometrik** dari arah jalan masuk (di belakang `-F`, ketinggian ~35 derajat), supaya fasad depan, atap, jalan masuk dan gerbang terlihat. Sertakan lahan sekitar (halaman, jalan, pagar) tetapi **bangunan harus mengisi >= 55% lebar area aman** dan tidak terpotong.
- Untuk Command Deck pada Walls Up: dinding ruangan penuh, kaca partisi tetap transparan, **langit-langit batu/gua disembunyikan** (kecuali tepi) supaya isi ruangan terlihat dari atas (ini setara "atap" dek bawah tanah).
- Pastikan tidak ada z-fighting, kebocoran cahaya melalui dinding yang turun, atau rumput menembus lantai (foundation curb dan mask rumput di `CliffGrounds` tetap dipakai).

### 5.4 Fokus zona (opsional, kecil, bukan level)

Di klaster kamera, satu popover "Fokus" berisi pintasan: _Hangar_ (hanya level Command Deck), _Lobby_ (hanya Grand Manor), _Tampak Luar_ (Lantai 2 + Walls Up). Memilih salah satu hanya memindahkan kamera (preset lama `hangarBay`, `manorLobby`, dan preset baru tampak luar); tidak mengganti level kecuali perlu.

**Kriteria selesai fase 3:** tombol dan kunci 1/2/3 mengubah dinding secara nyata; di Lantai 2 + Walls Up terlihat rumah utuh dengan atap; hanya ada 3 level di kontrol; screenshot tiap kombinasi (3 level x 3 mode x 4 sudut Q/E) tersimpan dan diperiksa tanpa potongan.

---

## 6. FASE 4: HUD ala simulasi rumah (rapi, tidak berantakan)

Ganti `SimsHud.tsx` menjadi `LotHud.tsx` (nama kelas `mo-lot-hud`; perbarui impor). Tiga klaster di bar bawah, tinggi seragam 80px, jarak 12px, lebar tidak pernah melampaui area `main` (jangan lebih lebar dari kanvas). Di layar < 900px, klaster menumpuk jadi dua baris atau tab ringkas; di < 560px hanya klaster level + kamera, panel agent menjadi bottom sheet saat agent dipilih.

1. **Kiri: Panel Agent** (gaya potret + status). Kosong: teks "Pilih agent" + ringkasan aktif/idle. Terpilih: avatar (inisial atau potret ringkas dari warna peran), nama, status dengan `StatusDot`, peran, ruangan/level, **tugas saat ini** (dipotong dengan ellipsis), model/gateway, durasi di status, lencana _Locked_ bila `privacy === 'locked'`. Tombol aksi: Inspect, Follow (toggle), Locate, Missions, Logs.
2. **Atas klaster kiri: roster** (strip potret kecil seluruh agent, seperti panel rumah tangga di game simulasi). Klik potret = pilih agent + terbang ke agent + pindah level otomatis bila agent ada di level lain. Gulir horizontal bila banyak (hingga 40). Titik status warna `--st-*`.
3. **Tengah: Level dan dinding.** Panel lift 3 tombol (bagian 5.2) dan segmented kontrol dinding Up / Cut / Down (bagian 5.3) dengan ikon, label, dan kunci pintas (`Kbd`).
4. **Kanan: Kamera.** Putar kiri/kanan (`Q`/`E`), zoom +/-, reset (`R`), fokus agent (`F`), popover Fokus zona (5.4). Tooltip jelas.
5. Semua teks satu bahasa: **Indonesia** untuk label HUD baru (Lantai 2, Dinding, Fokus, Pilih agent), kecuali nama level yang diminta persis: `Command Deck`, `Grand Manor`, `Lantai 2`. Jangan campur dalam satu kontrol.
6. Gaya: Minimal Obsidian (`--surface-1`, garis 1px `--line`, aksen `--accent`, radius `--r-md`), tanpa bayangan berat. Tinggi sentuh minimum 40px. Fokus keyboard terlihat. Semua tombol punya `aria-label`/`title`.
7. Bersihkan sisa: hapus tombol dan state yang tidak berfungsi (`panMode` tanpa kontrol, `showUpper` konstanta). Bila fitur tetap berguna (pan, tidur/Sleep), beri kontrol nyata di toolbar atas-kanan; bila tidak, hapus kodenya. Jangan meninggalkan state mati.

---

## 7. FASE 5: Interaksi agent seperti game simulasi rumah

Perilaku yang diminta saat agent diklik (baik **mesh 3D** maupun **label 2D**; sekarang keduanya berbeda, harus disatukan lewat satu fungsi `selectAgent(id, source)`):

1. **Hover**: kursor `pointer`, siluet/outline tipis pada agent (atau penebalan label), tooltip kecil berisi nama + status. Gunakan raycast pada grup agent di `Crew.tsx` (`onPointerOver/Out`), bukan listener DOM tambahan.
2. **Klik sekali**: pilih agent. Muncul **penanda berlian (plumbob) 3D** di atas kepala (oktahedron prosedural, berputar pelan dan naik-turun, warna mengikuti status `--st-*`; satu mesh bersama, tidak per agent). Klaster kiri HUD terisi. Radial menu muncul di titik klik (ambil koordinat dari event pointer, bukan `getBoundingClientRect` label, karena klik mesh tidak punya label). **Jangan** langsung membuka dialog detail pada klik mesh (perilaku lama `onSelect` di `Crew`).
3. **Radial menu (5 slot)**: Inspect (buka dialog detail yang ada; pertahankan fokus dan test `office-detail`/`office-dialog-focus`), Follow, Locate, Missions (filter agent), Logs (filter agent). Tutup dengan `Esc`, klik di luar, atau pilih aksi. Posisi dibatasi agar tidak keluar layar atau menutup HUD.
4. **Follow yang benar**: kamera harus mengikuti posisi agent **setiap frame** (baca `anchors.current.get('agent-<id>')` di `useFrame`, jangan snapshot di `useMemo`). Ikuti lewat toggle; berhenti bila pengguna mengubah level, menekan `Esc`, atau memutar/pan manual melewati ambang kecil. Locate = sekali terbang ke agent lalu berhenti.
5. **Klik ganda** pada agent = Follow. **Klik tanah/area kosong** (`onPointerMissed`) = batalkan pilihan.
6. **Pindah level otomatis**: memilih agent (dari roster atau label) di level yang tidak sedang tampil mengganti level dan dinding ke default yang cocok, lalu terbang ke agent.
7. **Missions/Logs terfilter**: tambahkan dukungan filter agent **tanpa mengubah `server/`** dan tanpa merusak invariant parameter query. Pakai query di hash (`#/missions?agent=<id>`) yang dibaca `Missions.tsx` dan `Logs.tsx` hanya di sisi klien (filter data yang sudah dimuat). Periksa `scripts/guard-invariants` agar tidak menganggapnya pelanggaran; bila guard memang melarang, simpan filter di state memori/`sessionStorage` sebagai gantinya dan catat di ADR-005.
8. **Status dari data nyata saja.** Status yang tampil hanya yang dikirim server (`Idle`, `Working`, `Reviewing`, `Collaborating`, `Unknown`, ditambah `Locked` dari `privacy`). Jangan mengarang status. Agent terkunci: tampilkan _Locked_ dan sembunyikan tugasnya.
9. **Aksesibilitas**: tiap label agent tetap `button` yang bisa difokus Tab, Enter memilih, aksi radial bisa lewat keyboard (panah dan Enter). Hormati `prefers-reduced-motion` untuk plumbob dan radial.
10. Hapus duplikasi `onFollow`/`onLocate` yang identik; satu untuk toggle, satu untuk sekali jalan.

**Kriteria selesai fase 5:** klik tiap agent di 3 level (mesh dan label) memunculkan plumbob, panel kiri, dan radial menu; Follow mengikuti agent yang berjalan; Inspect membuka dialog yang sama dengan sebelumnya; `Esc` membersihkan semuanya. Cek dengan `?mockAgents=12#/office` dan `?mockAgents=cycle` (mock hanya ada saat `npm run dev`).

---

## 8. FASE 6: Rapikan semua halaman

Untuk **setiap** rute (Batcave, Agents, Missions, Task Board, Calendar, Usage, Activity, Memory, Folders, Logs, Settings, plus LockScreen dan fallback 2D tanpa WebGL):

1. Buka di 390, 768, 1280, 1920 piksel. Catat setiap: scroll horizontal, teks terpotong, elemen bertumpuk, tabel melebihi layar, tinggi tidak wajar, jarak tidak konsisten, kontras rendah (WCAG AA tetap lulus via `tests/tokens-contrast.test.ts`).
2. Perbaiki dengan token yang ada (`--space` 8px, `--r-*`, tipografi 1.3). Satu ritme jarak: 8/12/16/24/32. Judul halaman memakai Display/H2 sesuai brief. Baris data memakai hairline, bukan kotak tebal.
3. Dengan menu samping, ruang konten menyempit: pastikan grid/tabel responsif (`minmax`, `overflow-x: auto` pada pembungkus tabel saja, bukan halaman).
4. Hapus CSS mati sisa tema lama dan sistem sebelumnya yang tidak lagi direferensikan (verifikasi dengan grep selector sebelum hapus). Jangan mengubah perilaku data.
5. Papan Task Board dan Calendar tetap berfungsi (kolom scroll sendiri, tampilan bulan).
6. Mode `prefers-reduced-motion`, tema gelap tunggal, dan fallback 2D tetap bekerja.

---

## 9. Verifikasi akhir (wajib, sebelum menyatakan selesai)

1. `npm run lint`, `npm test`, `npm run build` hijau (selain dua kegagalan lingkungan di `server/`). Bundle chunk `ManorOffice3D` tidak membengkak > +40 kB gzip dari sekarang (115 kB / gzip 41 kB); laporkan angka.
2. `scripts/guard-invariants` hijau; gate HARUS BERBEDA 11/11 hijau; `originality.test.ts` hijau.
3. Draw call (Medium, 1280x800, 12 agent) tiap level x mode: <= 150. Enam lampu. Ukur lewat `window.__batcaveRenderStats`; **perbarui tabel di `docs/theme-manor.md`** (bagian Controls, Scene, dan Measured draw calls) dan `docs/theme-manor-plan.md`.
4. Perbarui `docs/theme-manor.md` bagian _Controls_ (3 level, mode dinding, roster, interaksi agent, kunci pintas lengkap: `Q E R F 1 2 3 [ ] PageUp PageDown Esc ⌘K M`), `STATUS.md` (WP baru dan bukti), `MANUAL_VERIFY.md`, dan `DESIGN_BRIEF.md` (sidebar, HUD, 3 level).
5. Checklist visual (screenshot disimpan, diperiksa satu per satu):
   - [ ] Menu samping terlihat di semua halaman tanpa klik.
   - [ ] Hanya 3 level di kontrol: Lantai 2, Grand Manor, Command Deck; naik/turun bekerja.
   - [ ] Lantai 2 + Walls Up = rumah utuh dengan dinding dan atap dari luar, fasad depan menghadap jalan masuk.
   - [ ] Cutaway menurunkan dinding yang menghadap kamera dan berubah saat `Q`/`E`.
   - [ ] Walls Down menampilkan seluruh tata ruang.
   - [ ] Tidak ada potongan di tepi pada 5 ukuran layar; bangunan tidak tertutup HUD.
   - [ ] Klik agent: plumbob, panel kiri, radial, Inspect, Follow mengikuti, Locate, Esc.
   - [ ] Roster berfungsi dan pindah level otomatis.
   - [ ] Semua 11 rute rapi di 4 lebar layar, tanpa scroll horizontal.
   - [ ] Reduced motion tidak memunculkan animasi gerak besar.
6. Laporan akhir (singkat) berisi: file yang diubah, hasil tiap perintah di atas, angka draw call, ukuran bundle, daftar screenshot, dan hal yang tidak bisa diverifikasi (misalnya FPS pada GPU asli; mesin ini memakai render software).

---

## 10. Urutan eksekusi dan komit

1. Fase 1 (shell, menu) -> commit.
2. Fase 2 (kanvas penuh, area aman, zoom) -> commit.
3. Fase 3 (3 level, mode dinding, atap, tampak luar) -> commit. Kerjakan dinding dahulu, atap kemudian.
4. Fase 4 (HUD) -> commit.
5. Fase 5 (interaksi agent) -> commit.
6. Fase 6 (rapikan halaman) -> commit.
7. Verifikasi akhir dan docs -> commit.

Bila ada konflik antara dokumen lama dan permintaan ini, permintaan ini yang menang, dan konfliknya dicatat di ADR-005. Bila sebuah langkah tidak bisa dilakukan tanpa melanggar aturan keras di bagian 0, berhenti di langkah itu, jelaskan alasannya, dan lanjutkan ke bagian lain.
