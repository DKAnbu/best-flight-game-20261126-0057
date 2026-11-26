// game.js — Main Simulation Engine, Missions, Avionics HUD, Controls & Sortie Loop

import { Vec3 } from './math3d.js';
import { Terrain } from './terrain.js';
import { AircraftPhysics } from './physics.js';
import { FlightRenderer } from './renderer.js';
import { SoundEngine } from './sound.js';

export class GameEngine {
  constructor() {
    this.canvas = document.getElementById('flight-canvas');
    this.renderer = new FlightRenderer(this.canvas);
    this.sound = new SoundEngine();
    this.terrain = new Terrain(4000, 40);
    this.aircraft = new AircraftPhysics();

    this.camMode = 'CHASE'; // 'CHASE' or 'COCKPIT'
    this.gameState = 'MENU'; // 'MENU', 'FLYING', 'DEBRIEF'
    this.missionId = 1;

    // Mission targets and objectives
    this.rings = [];
    this.activeRingIndex = 0;
    this.drones = [];
    this.bullets = [];

    // Telemetry tracking
    this.score = 0;
    this.missionTime = 0;
    this.lastTime = performance.now();

    // Input state
    this.input = {
      pitchUp: false,
      pitchDown: false,
      rollLeft: false,
      rollRight: false,
      yawLeft: false,
      yawRight: false,
      throttleUp: false,
      throttleDown: false,
      fire: false,
      airbrake: false,
    };

    this.bindEvents();
    this.initHUD();
    this.resizeCanvas();
    this.setupMission(1);

    // Start render/physics loop
    requestAnimationFrame((t) => this.loop(t));
  }

  resizeCanvas() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (code === 'KeyW') this.input.pitchDown = true;
      if (code === 'KeyS') this.input.pitchUp = true;
      if (code === 'KeyA') this.input.rollLeft = true;
      if (code === 'KeyD') this.input.rollRight = true;
      if (code === 'KeyQ') this.input.yawLeft = true;
      if (code === 'KeyE') this.input.yawRight = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.throttleUp = true;
      if (code === 'ControlLeft' || code === 'ControlRight') this.input.throttleDown = true;
      if (code === 'KeyB') this.input.airbrake = true;
      if (code === 'Space') {
        this.input.fire = true;
        this.fireCannon();
      }
      if (code === 'KeyC') this.toggleCamera();
      if (code === 'KeyM') this.sound.enabled = !this.sound.enabled;
      if (code === 'Enter' && this.gameState === 'MENU') {
        this.startSortie();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyW') this.input.pitchDown = false;
      if (code === 'KeyS') this.input.pitchUp = false;
      if (code === 'KeyA') this.input.rollLeft = false;
      if (code === 'KeyD') this.input.rollRight = false;
      if (code === 'KeyQ') this.input.yawLeft = false;
      if (code === 'KeyE') this.input.yawRight = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.throttleUp = false;
      if (code === 'ControlLeft' || code === 'ControlRight') this.input.throttleDown = false;
      if (code === 'KeyB') this.input.airbrake = false;
      if (code === 'Space') this.input.fire = false;
    });

    // Mission Selection cards
    document.querySelectorAll('.mission-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mission-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.missionId = parseInt(card.dataset.mission, 10);
        this.setupMission(this.missionId);
      });
    });

    document.getElementById('btn-start-sortie')?.addEventListener('click', () => this.startSortie());
    document.getElementById('btn-retry-sortie')?.addEventListener('click', () => {
      document.getElementById('debrief-modal').classList.add('hidden');
      document.getElementById('menu-modal').classList.remove('hidden');
      this.gameState = 'MENU';
      this.setupMission(this.missionId);
    });
  }

  initHUD() {
    this.hudSpeed = document.getElementById('hud-speed');
    this.hudAlt = document.getElementById('hud-alt');
    this.hudHdg = document.getElementById('hud-hdg-val');
    this.hudCamMode = document.getElementById('hud-cam-mode');
    this.hudThrVal = document.getElementById('hud-thr-val');
    this.hudThrBar = document.getElementById('hud-throttle-bar');
    this.hudFuelVal = document.getElementById('hud-fuel-val');
    this.hudFuelBar = document.getElementById('hud-fuel-bar');
    this.hudMissionText = document.getElementById('hud-mission-text');
    this.hudScore = document.getElementById('hud-score');
    this.hudTimer = document.getElementById('hud-timer');
    this.hudGLoad = document.getElementById('hud-gload');
    this.hudStallWarn = document.getElementById('hud-stall-warning');
    this.hudPullupWarn = document.getElementById('hud-pullup-warning');
    this.cockpitOverlay = document.getElementById('cockpit-overlay');
  }

  toggleCamera() {
    this.camMode = this.camMode === 'CHASE' ? 'COCKPIT' : 'CHASE';
    if (this.hudCamMode) {
      this.hudCamMode.innerText = this.camMode === 'CHASE' ? 'CHASE VIEW' : 'COCKPIT HUD';
    }
    if (this.cockpitOverlay) {
      if (this.camMode === 'COCKPIT') {
        this.cockpitOverlay.classList.remove('hidden');
      } else {
        this.cockpitOverlay.classList.add('hidden');
      }
    }
  }

  setupMission(id) {
    this.missionId = id;
    this.rings = [];
    this.activeRingIndex = 0;
    this.drones = [];
    this.bullets = [];
    this.score = 0;
    this.missionTime = 0;

    // Reset aircraft
    this.aircraft = new AircraftPhysics();

    if (id === 1) {
      // Sortie 1: Canyon Rings Rally
      this.aircraft.pos.set(0, 180, -600);
      this.aircraft.vel.set(0, 0, 95);
      const ringCoords = [
        [0, 160, -300],
        [50, 145, 0],
        [-45, 125, 300],
        [-20, 110, 600],
        [55, 130, 900],
        [25, 150, 1200],
        [-40, 135, 1500],
        [0, 100, 1800],
      ];
      this.rings = ringCoords.map((rc) => ({
        pos: new Vec3(rc[0], rc[1], rc[2]),
        radius: 35,
        passed: false,
      }));
      if (this.hudMissionText) this.hudMissionText.innerText = 'NAVIGATE CANYON RINGS [0 / 8]';
    } else if (id === 2) {
      // Sortie 2: Runway Touchdown Protocol
      this.aircraft.pos.set(0, 240, 0); // approaching runway at z=1000
      this.aircraft.vel.set(0, -6, 80);
      if (this.hudMissionText) this.hudMissionText.innerText = 'APPROACH RUNWAY & TOUCHDOWN';
    } else if (id === 3) {
      // Sortie 3: Island Defense Patrol
      this.aircraft.pos.set(0, 220, 0);
      this.aircraft.vel.set(0, 0, 90);
      this.drones = [
        { pos: new Vec3(-200, 250, 400), alive: true },
        { pos: new Vec3(250, 220, 600), alive: true },
        { pos: new Vec3(0, 300, 900), alive: true },
        { pos: new Vec3(-150, 180, 1200), alive: true },
      ];
      if (this.hudMissionText) this.hudMissionText.innerText = 'NEUTRALIZE DRONES [0 / 4]';
    }
  }

  startSortie() {
    this.sound.init();
    document.getElementById('menu-modal').classList.add('hidden');
    this.gameState = 'FLYING';
  }

  fireCannon() {
    if (this.gameState !== 'FLYING') return;
    const bulletPos = this.aircraft.pos.clone().add(this.aircraft.forward.clone().scale(5));
    const bulletVel = this.aircraft.forward.clone().scale(350).add(this.aircraft.vel);
    this.bullets.push({ pos: bulletPos, vel: bulletVel, life: 1.5 });
    this.sound.playCannon();
  }

  update(dt) {
    if (this.gameState !== 'FLYING') return;

    this.missionTime += dt;
    this.aircraft.update(dt, this.input);

    // Audio engine sync
    const speed = this.aircraft.vel.length();
    this.sound.updateEngine(this.aircraft.throttle, speed / 150);

    // 1. Terrain collision check
    if (this.terrain.checkTerrainCollision(this.aircraft.pos)) {
      if (this.missionId === 2 && this.checkRunwayLanding()) {
        this.endSortie(true, 'EXCELLENT CARRIER RUNWAY TOUCHDOWN');
        return;
      } else {
        this.endSortie(false, 'CRITICAL IMPACT — TERRAIN COLLISION');
        return;
      }
    }

    // 2. Out of fuel check
    if (this.aircraft.fuel <= 0 && speed < 30) {
      this.endSortie(false, 'FLAMEOUT — FUEL EXHAUSTED');
      return;
    }

    // 3. Ring checkpoint checks
    if (this.missionId === 1 && this.activeRingIndex < this.rings.length) {
      const targetRing = this.rings[this.activeRingIndex];
      const dist = this.aircraft.pos.distTo(targetRing.pos);
      if (dist < targetRing.radius + 10) {
        targetRing.passed = true;
        this.activeRingIndex++;
        this.score += 250;
        this.sound.playBeep(1200, 0.15);
        if (this.hudMissionText) {
          this.hudMissionText.innerText = `NAVIGATE CANYON RINGS [${this.activeRingIndex} / 8]`;
        }
        if (this.activeRingIndex >= this.rings.length) {
          this.endSortie(true, 'ALL CANYON RINGS CLEARED WITH HONORS');
          return;
        }
      }
    }

    // 4. Bullets and drone collision check
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.pos.add(b.vel.clone().scale(dt));
      b.life -= dt;
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check drone hit
      if (this.missionId === 3) {
        for (const drone of this.drones) {
          if (drone.alive && b.pos.distTo(drone.pos) < 30) {
            drone.alive = false;
            this.score += 500;
            this.sound.playBeep(440, 0.25);
            const remaining = this.drones.filter((d) => d.alive).length;
            if (this.hudMissionText) {
              this.hudMissionText.innerText = `NEUTRALIZE DRONES [${4 - remaining} / 4]`;
            }
            if (remaining === 0) {
              this.endSortie(true, 'AIR DEFENSE SECTOR SECURED');
              return;
            }
          }
        }
      }
    }

    // Update HUD
    this.updateHUD();
  }

  checkRunwayLanding() {
    const rw = this.terrain.runway;
    const pos = this.aircraft.pos;
    const speedKts = this.aircraft.vel.length() * 1.94384;
    const sinkRate = -this.aircraft.vel.y;

    const onRunway =
      Math.abs(pos.x - rw.x) < rw.width / 2 &&
      Math.abs(pos.z - rw.z) < rw.length / 2 &&
      pos.y <= rw.altitude + 3;

    return onRunway && speedKts < 140 && sinkRate < 4.5;
  }

  updateHUD() {
    const t = this.aircraft.getTelemetry();
    if (this.hudSpeed) this.hudSpeed.innerText = t.speedKts;
    if (this.hudAlt) this.hudAlt.innerText = t.altFt;
    if (this.hudHdg) this.hudHdg.innerText = `${t.hdgDeg.toString().padStart(3, '0')}°`;
    if (this.hudThrVal) this.hudThrVal.innerText = `${t.throttlePct}%`;
    if (this.hudThrBar) this.hudThrBar.style.height = `${t.throttlePct}%`;
    if (this.hudFuelVal) this.hudFuelVal.innerText = `${t.fuelPct}%`;
    if (this.hudFuelBar) this.hudFuelBar.style.height = `${t.fuelPct}%`;
    if (this.hudScore) this.hudScore.innerText = this.score.toString().padStart(4, '0');
    if (this.hudGLoad) this.hudGLoad.innerText = `${t.gForce > 0 ? '+' : ''}${t.gForce} G`;

    const mins = Math.floor(this.missionTime / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(this.missionTime % 60)
      .toString()
      .padStart(2, '0');
    if (this.hudTimer) this.hudTimer.innerText = `${mins}:${secs}`;

    if (this.hudStallWarn) {
      if (t.isStalling) this.hudStallWarn.classList.remove('hidden');
      else this.hudStallWarn.classList.add('hidden');
    }

    if (this.hudPullupWarn) {
      if (t.isTerrainWarning) this.hudPullupWarn.classList.remove('hidden');
      else this.hudPullupWarn.classList.add('hidden');
    }
  }

  endSortie(success, reason) {
    this.gameState = 'DEBRIEF';
    const debriefModal = document.getElementById('debrief-modal');
    const title = document.getElementById('debrief-title');
    const stats = document.getElementById('debrief-stats');

    if (title) title.innerText = success ? 'MISSION ACCOMPLISHED' : 'MISSION TERMINATED';
    if (stats) {
      stats.innerHTML = `
        <div class="stat-item"><div class="stat-title">OUTCOME</div><div class="stat-val">${reason}</div></div>
        <div class="stat-item"><div class="stat-title">FINAL SCORE</div><div class="stat-val">${this.score} PTS</div></div>
        <div class="stat-item"><div class="stat-title">FLIGHT TIME</div><div class="stat-val">${Math.round(this.missionTime)} SEC</div></div>
        <div class="stat-item"><div class="stat-title">FUEL REMAINING</div><div class="stat-val">${Math.round(this.aircraft.fuel)}%</div></div>
      `;
    }
    debriefModal.classList.remove('hidden');
  }

  render() {
    // 1. Atmosphere & horizon
    this.renderer.drawAtmosphere(this.aircraft.pitch, this.aircraft.roll);

    // 2. Camera View-Projection Matrix
    this.renderer.setupCamera(this.aircraft, this.camMode);

    // 3. Terrain, Ocean & Runway
    this.terrain.render(this.renderer);

    // 4. Mission Targets
    if (this.missionId === 1) {
      this.renderer.drawTargetRings(this.rings, this.activeRingIndex);
    } else if (this.missionId === 3) {
      this.renderer.drawDrones(this.drones);
    }

    // 5. Tracers / Bullets
    this.renderer.drawTracers(this.bullets);

    // 6. 3D Aircraft
    this.renderer.drawAircraft(this.aircraft, this.camMode === 'CHASE');
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Instantiate engine when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.gameEngine = new GameEngine();
});
