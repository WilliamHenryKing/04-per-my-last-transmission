import * as THREE from "three";
import { type PbrId, pbrTiled } from "./assets";

// Material roles for the miniature. Painted metal, powder-coat, cardboard and rock come from
// CC0 scans (assets.manifest.json): their chips, scratches and rust are real, so edges wear
// where hands would. Enamel and ceramic add a clearcoat that mirrors the studio HDRI.

function scanned(
  id: PbrId,
  repeat: number,
  params: THREE.MeshPhysicalMaterialParameters,
  offset = 0,
): THREE.MeshPhysicalMaterial {
  const set = pbrTiled(id, repeat, offset);
  return new THREE.MeshPhysicalMaterial({
    map: set.colour,
    normalMap: set.normal,
    roughnessMap: set.arm,
    metalnessMap: set.arm,
    aoMap: set.arm,
    aoMapIntensity: 0.8,
    roughness: 1,
    metalness: 1,
    ...params,
  });
}

let cache: ReturnType<typeof build> | null = null;

function build() {
  return {
    /** Postal-red enamel over steel, chipped to bare metal at the edges (PaintedMetal004). */
    postalRed: scanned("paintedmetal004", 1, { clearcoat: 0.55, clearcoatRoughness: 0.18 }),
    /** Cream enamel with rust blooms (PaintedMetal012). */
    cream: scanned("paintedmetal012", 1, {
      color: 0xfff3e0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2,
    }),
    /** The same scan tinted teal for the dock pad; the rust chips stay dark. */
    teal: scanned(
      "paintedmetal012",
      1.5,
      { color: 0x3f9e98, clearcoat: 0.5, clearcoatRoughness: 0.22 },
      0.31,
    ),
    /** Black powder-coated steel for the cannon barrel (Metal027). */
    powder: scanned("metal027", 1, { color: 0x3a3c42 }),
    /** Polished brass: fine scratches from the powder-coat normal, no albedo map. */
    brass: new THREE.MeshPhysicalMaterial({
      color: 0xd1a660,
      metalness: 1,
      roughness: 0.26,
      normalMap: pbrTiled("metal027", 2).normal,
      normalScale: new THREE.Vector2(0.35, 0.35),
    }),
    /** Glazed ceramic: the depot dome. */
    ceramic: new THREE.MeshPhysicalMaterial({
      color: 0xf2ebdd,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
    /** Battered cardboard (Cardboard001), taped. */
    cardboard: scanned("cardboard001", 1, { metalness: 0, metalnessMap: null, color: 0xe8d0b0 }),
    tapeRed: new THREE.MeshPhysicalMaterial({
      color: 0xc9412c,
      roughness: 0.45,
      clearcoat: 0.3,
    }),
    tapeBrass: new THREE.MeshPhysicalMaterial({ color: 0xd9b25e, roughness: 0.5, clearcoat: 0.3 }),
    /** Rocks (Poly Haven rock_face_03), cooled toward the table's ink. */
    rock: scanned("rock_face_03", 1, { metalness: 0, metalnessMap: null, color: 0x9a96a4 }),
  };
}

export function materials() {
  if (!cache) cache = build();
  return cache;
}

/** A glowing element with the real light it casts. Luminance is scene-linear, above bloom. */
export function lamp(colour: number, luminance: number, candela: number, range: number) {
  const bulb = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: colour,
    emissiveIntensity: luminance,
    roughness: 0.4,
  });
  const light = new THREE.PointLight(colour, candela, range, 2);
  return { bulb, light };
}
