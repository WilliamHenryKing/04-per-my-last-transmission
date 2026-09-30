import * as THREE from "three";
import { disposeTexture } from "./assets";

function texturesOf(material: THREE.Material): THREE.Texture[] {
  return Object.values(material).filter(
    (value): value is THREE.Texture => value instanceof THREE.Texture,
  );
}

/** Dispose a view's resources while keeping the materials/maps shared by the live world. */
export function disposeTree(root: THREE.Object3D, shared: ReadonlySet<THREE.Material> = new Set()) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points
    ) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!shared.has(material)) materials.add(material);
      }
      if (object instanceof THREE.InstancedMesh) object.dispose();
    } else if (object instanceof THREE.Sprite && !shared.has(object.material)) {
      materials.add(object.material);
    }
    if (
      object instanceof THREE.DirectionalLight ||
      object instanceof THREE.PointLight ||
      object instanceof THREE.SpotLight
    ) {
      object.shadow.dispose();
    }
  });
  for (const geometry of geometries) geometry.dispose();
  disposeMaterials(materials, new Set([...shared].flatMap(texturesOf)));
  root.removeFromParent();
  root.clear();
}

export function disposeMaterials(
  materials: Iterable<THREE.Material>,
  sharedTextures: ReadonlySet<THREE.Texture> = new Set(),
) {
  const textures = new Set<THREE.Texture>();
  for (const material of new Set(materials)) {
    for (const texture of texturesOf(material))
      if (!sharedTextures.has(texture)) textures.add(texture);
    material.dispose();
  }
  for (const texture of textures) disposeTexture(texture);
}
