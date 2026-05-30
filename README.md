# Anniversary carousel (`seed/`)

3D photo carousel (viewed from ~30° above) with background music.

## Setup

1. Put images in **`photos/`**
2. Put audio in **`music/`** (`.mp3`, `.wav`, `.ogg`, etc.)
3. Edit years/captions in `update-manifest.ts`, then run:

   ```bash
   node update-manifest.ts
   ```

   Or auto-scan filenames only:

   ```bash
   node generate-manifest.js
   ```

4. Edit **`config.js`** (names, wedding year, etc.)

## Open the site

```powershell
cd "C:\Users\HARIKUMAR\OneDrive\Documents\float\seed"
python -m http.server 3456
```

Then visit **http://localhost:3456**

(Don’t rely on double-clicking `index.html` if photos/music don’t load — use the local server.)

## Controls

- **Drag** or **scroll** — rotate the carousel
- **Click a card** — focus & enlarge (1.5×); click again to release
- **← →** keys — rotate
- **▶** — play music (required once; browsers block autoplay)

## Filenames

`1998-beach-trip.jpg` → year and caption are picked up automatically when you run `generate-manifest.js`.
