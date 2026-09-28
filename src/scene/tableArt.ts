import * as THREE from "three";

// The printed star chart on the table's linen sheet: ink-navy ground, cream star specks, brass
// survey rings and a compass rose. Printed into the albedo (not emitted), so the studio light
// and the linen's weave shade it like real ink on cloth.

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function makeChartAlbedo(): THREE.CanvasTexture {
  const w = 2048;
  const h = 1366;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) {
    // Ink ground with a faint mottle so the dye never reads as flat.
    const ground = g.createRadialGradient(w * 0.55, h * 0.45, 0, w * 0.5, h * 0.5, w * 0.7);
    ground.addColorStop(0, "#2a3358");
    ground.addColorStop(1, "#1b2140");
    g.fillStyle = ground;
    g.fillRect(0, 0, w, h);
    const r = rng(29);
    for (let i = 0; i < 380; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? "12,16,34" : "60,72,120"}, 0.05)`;
      g.beginPath();
      g.arc(r() * w, r() * h, 30 + r() * 140, 0, Math.PI * 2);
      g.fill();
    }
    // Survey grid, printed faintly.
    g.strokeStyle = "rgba(120, 140, 200, 0.16)";
    g.lineWidth = 1.5;
    for (let x = 0; x <= w; x += w / 24) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 0; y <= h; y += h / 16) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    for (let i = 0; i < 900; i++) {
      const big = r() < 0.07;
      g.fillStyle = `rgba(243, 234, 215, ${0.35 + r() * 0.5})`;
      g.beginPath();
      g.arc(r() * w, r() * h, big ? 2.2 : 1.1, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = "rgba(226, 176, 74, 0.35)";
    g.lineWidth = 3;
    for (const radius of [230, 460, 690, 920]) {
      g.beginPath();
      g.arc(w * 0.5, h * 0.5, radius, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([14, 18]);
    g.beginPath();
    g.moveTo(0, h * 0.5);
    g.lineTo(w, h * 0.5);
    g.moveTo(w * 0.5, 0);
    g.lineTo(w * 0.5, h);
    g.stroke();
    g.setLineDash([]);
    g.translate(w - 170, h - 170);
    g.strokeStyle = "rgba(243, 234, 215, 0.4)";
    g.lineWidth = 2.5;
    for (let k = 0; k < 16; k++) {
      g.rotate(Math.PI / 8);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, k % 4 === 0 ? 110 : k % 2 ? 40 : 70);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
