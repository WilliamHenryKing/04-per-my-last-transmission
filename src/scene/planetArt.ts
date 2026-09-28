import * as THREE from "three";
import type { BodyLook } from "../game/types";

// Glazed-ceramic planets: an equirectangular glaze painted per planet (bands, craters, poles,
// pooling at the edges of each colour field) plus a matching roughness map, so the clearcoat
// catches the studio unevenly the way a real hand-glazed piece does.

const W = 1024;
const H = 512;

const LOOKS: Record<BodyLook, { base: string; accent: string; deep: string }> = {
  moon: { base: "#ece4d2", accent: "#b9ae99", deep: "#8f8577" },
  rust: { base: "#d9743f", accent: "#a8452b", deep: "#f1b27b" },
  gas: { base: "#2f9c95", accent: "#f3ead7", deep: "#1c6a70" },
  ice: { base: "#d8e8f1", accent: "#94bcd6", deep: "#ffffff" },
};

function rng(seed: number) {
  let s = Math.floor(seed * 9973) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** The same colour at zero alpha, so gradients fade without a dark fringe. */
function clear(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
}

function canvas() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return [c, c.getContext("2d")] as const;
}

export function planetMaps(look: BodyLook, seed: number) {
  const [colour, g] = canvas();
  const [rough, q] = canvas();
  const pal = LOOKS[look];
  const r = rng(seed + 1);
  if (g && q) {
    g.fillStyle = pal.base;
    g.fillRect(0, 0, W, H);
    q.fillStyle = "rgb(105,105,105)"; // satin glaze by default
    q.fillRect(0, 0, W, H);
    if (look === "gas" || look === "rust") {
      // Bands of glaze, each with a wavy edge and a darker pooled rim.
      let y = 0;
      while (y < H) {
        const hgt = 18 + r() * 60;
        const fill = r() < 0.5 ? pal.accent : pal.deep;
        const amp = 3 + r() * 8;
        const freq = 2 + Math.floor(r() * 4);
        g.fillStyle = fill;
        g.globalAlpha = 0.55 + r() * 0.4;
        g.beginPath();
        for (let x = 0; x <= W; x += 8) {
          g.lineTo(x, y + Math.sin((x / W) * Math.PI * 2 * freq + seed) * amp);
        }
        for (let x = W; x >= 0; x -= 8) {
          g.lineTo(x, y + hgt + Math.sin((x / W) * Math.PI * 2 * freq + seed + 1) * amp);
        }
        g.fill();
        q.fillStyle = `rgba(150,150,150,${0.25 + r() * 0.3})`;
        q.fillRect(0, y, W, 3);
        y += hgt + r() * 30;
      }
      g.globalAlpha = 1;
    } else {
      // Craters as glaze pools: soft darker basins with a lit rim, rougher where glaze thins.
      for (let i = 0; i < 90; i++) {
        const x = r() * W;
        const y = H * 0.1 + r() * H * 0.8;
        const rad = 5 + r() ** 2.2 * 55;
        const basin = g.createRadialGradient(x, y, rad * 0.1, x, y, rad * 1.3);
        basin.addColorStop(0, pal.deep);
        basin.addColorStop(0.7, pal.accent);
        basin.addColorStop(1, clear(pal.accent));
        g.globalAlpha = 0.35 + r() * 0.35;
        g.fillStyle = basin;
        g.beginPath();
        g.ellipse(x, y, rad * 1.5, rad, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 0.5;
        g.strokeStyle = "#fbf6ea";
        g.lineWidth = Math.max(1, rad * 0.08);
        g.beginPath();
        g.ellipse(
          x - rad * 0.08,
          y - rad * 0.06,
          rad * 1.45,
          rad * 0.95,
          0,
          Math.PI * 1.1,
          Math.PI * 1.9,
        );
        g.stroke();
        const rim = q.createRadialGradient(x, y, rad * 0.6, x, y, rad * 1.4);
        rim.addColorStop(0, "rgba(0,0,0,0)");
        rim.addColorStop(0.7, "rgba(190,190,190,0.5)");
        rim.addColorStop(1, "rgba(0,0,0,0)");
        q.fillStyle = rim;
        q.beginPath();
        q.ellipse(x, y, rad * 1.5, rad, 0, 0, Math.PI * 2);
        q.fill();
      }
      // Mottle: the uneven thickness of a hand-dipped glaze.
      g.globalAlpha = 1;
      for (let i = 0; i < 260; i++) {
        g.fillStyle = r() < 0.5 ? "rgba(90,80,70,0.06)" : "rgba(255,250,240,0.07)";
        g.beginPath();
        g.arc(r() * W, r() * H, 4 + r() * 22, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      if (look === "ice") {
        g.fillStyle = pal.deep;
        g.fillRect(0, 0, W, H * 0.12);
        g.fillRect(0, H * 0.88, W, H * 0.12);
      }
    }
    // Macro variation: broad, soft tonal drift so no two regions match.
    for (let i = 0; i < 40; i++) {
      g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
      g.beginPath();
      g.arc(r() * W, r() * H, 40 + r() * 140, 0, Math.PI * 2);
      g.fill();
    }
  }
  const map = new THREE.CanvasTexture(colour);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  return { map, roughnessMap };
}
