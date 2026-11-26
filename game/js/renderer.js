// renderer.js — 3D Software Projection Pipeline, Aircraft Geometry, Ring Portals, Runway Lights & Sky

import { Mat4, Vec3 } from './math3d.js';

export class FlightRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.width = canvas.width;
    this.height = canvas.height;

    // View & Projection matrices
    this.fovRad = (65 * Math.PI) / 180;
    this.near = 1.0;
    this.far = 4000.0;
    this.viewProjMatrix = new Mat4();
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  // Set up camera matrix (Cockpit or Chase mode)
  setupCamera(aircraft, mode) {
    const aspect = this.width / this.height;
    const projMatrix = Mat4.perspective(this.fovRad, aspect, this.near, this.far);

    let eye, target, up;

    if (mode === 'COCKPIT') {
      // First person inside canopy
      eye = aircraft.pos.clone().add(aircraft.forward.clone().scale(2.2)).add(aircraft.up.clone().scale(0.85));
      target = eye.clone().add(aircraft.forward.clone().scale(50));
      up = aircraft.up.clone();
    } else {
      // 3rd-person Chase View behind and above aircraft
      const backOffset = aircraft.forward.clone().scale(-14);
      const upOffset = aircraft.up.clone().scale(4.2);
      eye = aircraft.pos.clone().add(backOffset).add(upOffset);
      target = aircraft.pos.clone().add(aircraft.forward.clone().scale(18));
      up = aircraft.up.clone();
    }

    const viewMatrix = Mat4.lookAt(eye, target, up);
    this.viewProjMatrix = projMatrix.multiply(viewMatrix);
    this.eyePos = eye;

    return { eye, target, up };
  }

  // Project world coordinate into screen pixel coordinate
  project(worldPos) {
    const pt = this.viewProjMatrix.transformPoint(worldPos);
    if (!pt || pt.w <= 0 || pt.z < -1 || pt.z > 1) return null;

    return {
      x: (pt.x * 0.5 + 0.5) * this.width,
      y: (-pt.y * 0.5 + 0.5) * this.height,
      depth: pt.w,
    };
  }

  // Render atmospheric horizon sky and sun
  drawAtmosphere(pitch, roll) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Sky gradient with horizon shift based on pitch/roll
    const horizonY = h * 0.5 + pitch * (h * 0.4);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#041122');
    grad.addColorStop(0.4, '#0e345e');
    grad.addColorStop(0.5, '#4182b8');
    grad.addColorStop(0.52, '#d48852'); // golden twilight horizon haze
    grad.addColorStop(0.56, '#0f2b38'); // deep ocean ground fog
    grad.addColorStop(1.0, '#04121a');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Distant sun flare
    ctx.save();
    ctx.fillStyle = 'rgba(255, 230, 160, 0.4)';
    ctx.beginPath();
    ctx.arc(w * 0.75, horizonY * 0.45, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Render endless ocean wave grid
  drawOceanGrid(minCoord, maxCoord, seaLevel) {
    const ctx = this.ctx;
    const step = 200;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 180, 220, 0.18)';
    ctx.lineWidth = 1;

    for (let x = minCoord; x <= maxCoord; x += step) {
      const p1 = this.project(new Vec3(x, seaLevel, minCoord));
      const p2 = this.project(new Vec3(x, seaLevel, maxCoord));
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    for (let z = minCoord; z <= maxCoord; z += step) {
      const p1 = this.project(new Vec3(minCoord, seaLevel, z));
      const p2 = this.project(new Vec3(maxCoord, seaLevel, z));
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Render terrain patches
  drawTerrainPatches(terrain, camera) {
    const ctx = this.ctx;
    const step = terrain.gridStep * 2;
    const half = terrain.halfSize;

    ctx.save();
    for (let z = -half; z < half; z += step) {
      for (let x = -half; x < half; x += step) {
        const h00 = terrain.getHeightAt(x, z);
        const h10 = terrain.getHeightAt(x + step, z);
        const h11 = terrain.getHeightAt(x + step, z + step);
        const h01 = terrain.getHeightAt(x, z + step);

        // Skip completely flat ocean patches
        if (h00 === 0 && h10 === 0 && h11 === 0 && h01 === 0) continue;

        const p00 = this.project(new Vec3(x, h00, z));
        const p10 = this.project(new Vec3(x + step, h10, z));
        const p11 = this.project(new Vec3(x + step, h11, z + step));
        const p01 = this.project(new Vec3(x, h01, z + step));

        if (p00 && p10 && p11 && p01) {
          // Color shading based on elevation
          const avgH = (h00 + h10 + h11 + h01) * 0.25;
          let fill;
          if (avgH > 160) {
            fill = '#d4ded8'; // snow cap
          } else if (avgH > 70) {
            fill = '#4a5749'; // mountain slate
          } else {
            fill = '#1d3b2b'; // valley forest
          }

          ctx.fillStyle = fill;
          ctx.strokeStyle = 'rgba(10, 25, 20, 0.4)';
          ctx.lineWidth = 0.5;

          ctx.beginPath();
          ctx.moveTo(p00.x, p00.y);
          ctx.lineTo(p10.x, p10.y);
          ctx.lineTo(p11.x, p11.y);
          ctx.lineTo(p01.x, p01.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // Render airport runway with landing threshold and centerline strobe lights
  drawRunway(runway) {
    const ctx = this.ctx;
    const halfLen = runway.length / 2;
    const halfWid = runway.width / 2;

    const corners = [
      new Vec3(runway.x - halfWid, runway.altitude, runway.z - halfLen),
      new Vec3(runway.x + halfWid, runway.altitude, runway.z - halfLen),
      new Vec3(runway.x + halfWid, runway.altitude, runway.z + halfLen),
      new Vec3(runway.x - halfWid, runway.altitude, runway.z + halfLen),
    ];

    const p = corners.map(c => this.project(c));
    if (p.every(Boolean)) {
      ctx.save();
      // Asphalt tarmac
      ctx.fillStyle = '#1c2126';
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      ctx.lineTo(p[1].x, p[1].y);
      ctx.lineTo(p[2].x, p[2].y);
      ctx.lineTo(p[3].x, p[3].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Centerline dashed lights
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (let z = runway.z - halfLen + 40; z < runway.z + halfLen - 40; z += 60) {
        const lp1 = this.project(new Vec3(runway.x, runway.altitude + 0.2, z));
        const lp2 = this.project(new Vec3(runway.x, runway.altitude + 0.2, z + 30));
        if (lp1 && lp2) {
          ctx.beginPath();
          ctx.moveTo(lp1.x, lp1.y);
          ctx.lineTo(lp2.x, lp2.y);
          ctx.stroke();
        }
      }

      // High-intensity green runway threshold lights
      for (let x = runway.x - halfWid; x <= runway.x + halfWid; x += 15) {
        const greenLight = this.project(new Vec3(x, runway.altitude + 0.3, runway.z - halfLen));
        if (greenLight) {
          ctx.fillStyle = '#00ff66';
          ctx.beginPath();
          ctx.arc(greenLight.x, greenLight.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // Render 3D AV-77 Delta Aircraft
  drawAircraft(aircraft, isChaseMode) {
    if (!isChaseMode) return; // In cockpit view, aircraft is rendered via cockpit canopy overlay
    const ctx = this.ctx;

    // Define 3D wireframe mesh for delta fighter in local coordinates
    const localVerts = [
      new Vec3(0, 0, 4.5),     // 0: Nose cone tip
      new Vec3(0, 0.7, -1.0),   // 1: Cockpit canopy peak
      new Vec3(-4.8, 0.1, -3.2),// 2: Left delta wingtip
      new Vec3(4.8, 0.1, -3.2), // 3: Right delta wingtip
      new Vec3(0, 0.2, -4.2),   // 4: Twin engine exhaust tail center
      new Vec3(0, 2.0, -3.8),   // 5: Vertical stabilizer fin top
      new Vec3(-1.0, -0.4, -0.5),// 6: Left belly intake
      new Vec3(1.0, -0.4, -0.5), // 7: Right belly intake
    ];

    // Transform local vertices to world space using aircraft orientation vectors
    const worldVerts = localVerts.map(v => {
      return aircraft.pos.clone()
        .add(aircraft.right.clone().scale(v.x))
        .add(aircraft.up.clone().scale(v.y))
        .add(aircraft.forward.clone().scale(v.z));
    });

    const pts = worldVerts.map(wv => this.project(wv));

    // Draw polygons & edges
    ctx.save();
    ctx.lineWidth = 1.8;

    // Fuselage facets
    const drawFace = (i1, i2, i3, fill, stroke) => {
      const p1 = pts[i1], p2 = pts[i2], p3 = pts[i3];
      if (p1 && p2 && p3) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    };

    // Jet body skin: military stealth navy & turquoise accent
    drawFace(0, 1, 2, '#1b3248', '#00ffaa'); // Left top wing
    drawFace(0, 1, 3, '#223e59', '#00ffaa'); // Right top wing
    drawFace(1, 4, 5, '#15283a', '#00eeff'); // Vertical fin
    drawFace(0, 2, 6, '#111f2e', '#00aa77'); // Left underside
    drawFace(0, 3, 7, '#142536', '#00aa77'); // Right underside

    // Afterburner blue-orange flame plume
    if (aircraft.throttle > 0.4) {
      const flameLength = -4.2 - aircraft.throttle * 3.5;
      const flamePos = aircraft.pos.clone()
        .add(aircraft.up.clone().scale(0.2))
        .add(aircraft.forward.clone().scale(flameLength));
      const pFlame = this.project(flamePos);
      const pTail = pts[4];
      if (pFlame && pTail) {
        ctx.strokeStyle = aircraft.throttle > 0.85 ? '#ffaa00' : '#00ddff';
        ctx.lineWidth = aircraft.throttle > 0.85 ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(pTail.x, pTail.y);
        ctx.lineTo(pFlame.x, pFlame.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Render navigation & canyon waypoint target rings
  drawTargetRings(rings, activeIndex) {
    const ctx = this.ctx;

    rings.forEach((ring, idx) => {
      const p = this.project(ring.pos);
      if (!p) return;

      const isCurrent = idx === activeIndex;
      const radius = Math.max(8, (ring.radius * this.height) / (p.depth * 1.8));

      ctx.save();
      ctx.strokeStyle = isCurrent ? '#ffcc00' : (ring.passed ? '#00ffaa55' : '#00aaff88');
      ctx.lineWidth = isCurrent ? 3.5 : 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (isCurrent) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`TARGET RING #${idx + 1}`, p.x, p.y - radius - 8);
      }
      ctx.restore();
    });
  }

  // Render aerial target drones / enemies
  drawDrones(drones) {
    const ctx = this.ctx;
    drones.forEach(drone => {
      if (!drone.alive) return;
      const p = this.project(drone.pos);
      if (!p) return;

      const size = Math.max(6, 400 / p.depth);
      ctx.save();
      ctx.strokeStyle = '#ff3344';
      ctx.fillStyle = 'rgba(255, 50, 70, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff3344';
      ctx.font = '10px Courier New';
      ctx.fillText(`DRONE [${Math.round(p.depth)}M]`, p.x + size + 4, p.y + 4);
      ctx.restore();
    });
  }

  // Render 20mm tracer projectiles
  drawTracers(bullets) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#ffff55';
    ctx.lineWidth = 2.5;

    bullets.forEach(b => {
      const p1 = this.project(b.pos);
      const tailPos = b.pos.clone().sub(b.vel.clone().scale(0.04));
      const p2 = this.project(tailPos);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });
    ctx.restore();
  }
}
