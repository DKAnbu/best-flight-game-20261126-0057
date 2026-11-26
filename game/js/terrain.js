// terrain.js — Procedural Island, Volcanic Peaks, Canyons, and Runway

export class Terrain {
  constructor(size = 4000, gridStep = 40) {
    this.size = size;
    this.halfSize = size / 2;
    this.gridStep = gridStep;
    this.cols = Math.floor(size / gridStep);
    this.rows = Math.floor(size / gridStep);

    // Lighted runway specifications
    this.runway = {
      x: 0,
      z: 1000,
      length: 800,
      width: 60,
      heading: 0, // aligned with Z axis
      altitude: 4, // slightly above water level
    };

    // Precompute height grid and colors
    this.heights = new Float32Array((this.cols + 1) * (this.rows + 1));
    this.colors = [];
    this.generateHeightmap();
  }

  // Multi-octave Perlin-like deterministic noise
  noise2D(x, z) {
    const s1 = Math.sin(x * 0.0012 + 1.2) * Math.cos(z * 0.0012 + 0.4);
    const s2 = Math.sin(x * 0.0031 - 0.7) * Math.cos(z * 0.0028 + 1.8) * 0.5;
    const s3 = Math.sin(x * 0.0083 + 2.1) * Math.cos(z * 0.0079 - 1.1) * 0.25;
    return s1 + s2 + s3;
  }

  getHeightAt(worldX, worldZ) {
    // Check if on runway flat zone
    const rx = worldX - this.runway.x;
    const rz = worldZ - this.runway.z;
    if (Math.abs(rx) < this.runway.width * 1.5 && Math.abs(rz) < this.runway.length * 0.6) {
      return this.runway.altitude;
    }

    const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
    // Island falloff radius
    const islandRadius = 1500;
    let islandMask = 1.0 - Math.min(1.0, distFromCenter / islandRadius);
    islandMask = Math.pow(islandMask, 0.85);

    if (islandMask <= 0) return 0; // Sea level

    // Mountain ridges and canyon carving (straight canyon along x=0, leading to the runway)
    const rawElevation = this.noise2D(worldX, worldZ) * 280;
    const peakRidge = Math.abs(Math.sin(worldX * 0.002 + worldZ * 0.001)) * 180;
    const canyonCut = Math.min(1.0, Math.abs(worldX) / 160);

    const elevation = (rawElevation + peakRidge) * islandMask * canyonCut;
    return Math.max(0, elevation);
  }

  generateHeightmap() {
    for (let j = 0; j <= this.rows; j++) {
      const z = -this.halfSize + j * this.gridStep;
      for (let i = 0; i <= this.cols; i++) {
        const x = -this.halfSize + i * this.gridStep;
        const h = this.getHeightAt(x, z);
        this.heights[j * (this.cols + 1) + i] = h;
      }
    }
  }

  // Check if position collides with terrain
  checkTerrainCollision(pos) {
    if (pos.y <= 0) return true; // ocean crash
    const groundH = this.getHeightAt(pos.x, pos.z);
    return pos.y <= groundH + 1.5;
  }

  // Render terrain meshes, runway with approach lights, and ocean grid
  render(renderer, camera) {
    // 1. Render Ocean Surface
    renderer.drawOceanGrid(-this.halfSize, this.halfSize, 0);

    // 2. Render Island Poly terrain patches within camera frustum
    renderer.drawTerrainPatches(this, camera);

    // 3. Render Runway with threshold markings, centerline & approach lights
    renderer.drawRunway(this.runway);
  }
}
