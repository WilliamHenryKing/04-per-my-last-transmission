import * as THREE from "three";

// Chart-table surface: a faint enamel grain (colour map, near white so it only darkens a
// little) and a scatter of dim star specks and chart rings (emissive map). Both stay far
// below the brightness of the route dots.

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

export function makeGrainMap(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  if (g) {
    const img = g.createImageData(512, 512);
    const r = rng(11);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 232 + Math.floor(r() * 23);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v + 2;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeStarChartMap(): THREE.CanvasTexture {
  const w = 1536;
  const h = 1024;
  const [c, g] = canvas(w, h);
  if (g) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    const r = rng(29);
    for (let i = 0; i < 700; i++) {
      const size = r() < 0.08 ? 1.6 : 0.8;
      g.fillStyle = `rgba(243, 234, 215, ${0.12 + r() * 0.25})`;
      g.beginPath();
      g.arc(r() * w, r() * h, size, 0, Math.PI * 2);
      g.fill();
    }
    // Faint survey rings and a compass rose in one corner, like a postal star chart.
    g.strokeStyle = "rgba(226, 176, 74, 0.12)";
    g.lineWidth = 2;
    for (const radius of [180, 360, 540, 720]) {
      g.beginPath();
      g.arc(w * 0.5, h * 0.5, radius, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([10, 14]);
    g.beginPath();
    g.moveTo(0, h * 0.5);
    g.lineTo(w, h * 0.5);
    g.moveTo(w * 0.5, 0);
    g.lineTo(w * 0.5, h);
    g.stroke();
    g.setLineDash([]);
    g.translate(w - 130, h - 130);
    g.strokeStyle = "rgba(243, 234, 215, 0.16)";
    for (let k = 0; k < 8; k++) {
      g.rotate(Math.PI / 4);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, k % 2 ? 40 : 80);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
