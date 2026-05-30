/**
 * Scans photos/ and music/, writes photo-manifest.json/music-manifest.json in each folder.
 * Run from seed/:  node generate-manifest.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".webm"]);

function scanDir(dir, extSet, mapFn) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => extSet.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(mapFn);
}

const photosDir = path.join(ROOT, "photos");
const photoManifest = scanDir(photosDir, IMAGE_EXT, (file) => {
  const base = path.basename(file, path.extname(file));
  const yearMatch = base.match(/\b(19|20)\d{2}\b/);
  return {
    src: `photos/${file}`,
    caption:
      base.replace(/[-_]+/g, " ").replace(/\b\d{4}\b/g, "").trim() || "Memory",
    year: yearMatch ? Number(yearMatch[0]) : null,
  };
});

fs.writeFileSync(
  path.join(photosDir, "photo-manifest.json"),
  JSON.stringify(photoManifest, null, 2) + "\n"
);
console.log(`photos/photo-manifest.json — ${photoManifest.length} image(s)`);

const musicDir = path.join(ROOT, "music");
const musicManifest = scanDir(musicDir, AUDIO_EXT, (file) => {
  const base = path.basename(file, path.extname(file));
  return {
    src: `music/${file}`,
    title: base.replace(/[-_]+/g, " ").trim() || "Track",
  };
});

fs.writeFileSync(
  path.join(musicDir, "music-manifest.json"),
  JSON.stringify(musicManifest, null, 2) + "\n"
);
console.log(`music/music-manifest.json — ${musicManifest.length} track(s)`);
