// physics.js — Aerodynamics, Flight Dynamics, Lift/Drag Polar, Stall, Engine Spool & Damage

import { Vec3, clamp, degToRad } from './math3d.js';

export class AircraftPhysics {
  constructor() {
    // Spatial state
    this.pos = new Vec3(0, 180, 0); // start at 180m altitude
    this.vel = new Vec3(0, 0, 90);  // initial forward velocity ~175 kts (90 m/s)

    // Orientation Euler angles (radians)
    this.pitch = 0.05; // slight nose up
    this.roll = 0;
    this.yaw = 0;

    // Control surfaces input (-1 to 1)
    this.elevator = 0;
    this.aileron = 0;
    this.rudder = 0;
    this.throttle = 0.65; // 0.0 to 1.0 (with afterburner > 0.85)

    // Aircraft physical parameters (AV-77 Osprey Delta)
    this.mass = 9500; // kg
    this.wingArea = 28.5; // m^2
    this.maxThrust = 82000; // Newtons (~82 kN dry)
    this.afterburnerMultiplier = 1.45;
    this.gravity = 9.81;

    // Aerodynamic coefficients
    this.cd0 = 0.022; // parasitic drag
    this.inducedDragCoeff = 0.045; // k factor in cd = cd0 + k * cl^2
    this.stallAngleDeg = 17.5; // stall AoA threshold
    this.stallFactor = 0; // 0 = normal, 1 = deep stall

    // Fuel and integrity system
    this.maxFuel = 100; // percent
    this.fuel = 100;
    this.fuelBurnRateNormal = 0.035; // % per sec
    this.fuelBurnRateAB = 0.12;      // % per sec
    this.health = 100; // percent
    this.gForce = 1.0;
    this.isLanded = false;
    this.gearDown = true;
    this.airbrake = false;

    // Directional orientation unit vectors
    this.forward = new Vec3(0, 0, 1);
    this.up = new Vec3(0, 1, 0);
    this.right = new Vec3(1, 0, 0);

    this.updateVectors();
  }

  updateVectors() {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const cr = Math.cos(this.roll);
    const sr = Math.sin(this.roll);
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);

    // Forward vector (aircraft nose direction)
    this.forward.set(
      sy * cp,
      sp,
      cy * cp
    ).normalize();

    // Right vector (wingtip right)
    this.right.set(
      cy * cr + sy * sp * sr,
      -cp * sr,
      -sy * cr + cy * sp * sr
    ).normalize();

    // Up vector (canopy top normal) — forward x right = +Y for this left-handed frame
    this.up = this.forward.clone().cross(this.right).normalize();
  }

  update(dt, input) {
    if (this.health <= 0) return; // Aircraft destroyed

    // 1. Process inputs with flight control damping
    const targetElevator = input.pitchUp ? 1 : (input.pitchDown ? -1 : 0);
    const targetAileron = input.rollRight ? 1 : (input.rollLeft ? -1 : 0);
    const targetRudder = input.yawRight ? 1 : (input.yawLeft ? -1 : 0);

    this.elevator += (targetElevator - this.elevator) * 8 * dt;
    this.aileron += (targetAileron - this.aileron) * 10 * dt;
    this.rudder += (targetRudder - this.rudder) * 6 * dt;

    if (input.throttleUp) this.throttle = clamp(this.throttle + 0.35 * dt, 0, 1);
    if (input.throttleDown) this.throttle = clamp(this.throttle - 0.35 * dt, 0, 1);
    this.airbrake = input.airbrake || false;

    // 2. Fuel consumption
    const isAfterburner = this.throttle > 0.85;
    const burnRate = isAfterburner ? this.fuelBurnRateAB : this.fuelBurnRateNormal;
    if (this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - burnRate * this.throttle * dt);
    }
    const enginePower = (this.fuel > 0 ? this.throttle : 0);

    // 3. Airspeed and relative wind
    const speed = this.vel.length();
    const airDensity = 1.225 * Math.exp(-this.pos.y / 8500); // barometric density

    // Angle of Attack (AoA)
    const velNorm = speed > 0.1 ? this.vel.clone().normalize() : this.forward.clone();
    const forwardDotVel = clamp(this.forward.dot(velNorm), -1, 1);
    const aoaRad = Math.acos(forwardDotVel);
    const aoaDeg = (aoaRad * 180) / Math.PI;

    // Lift curve with non-linear post-stall collapse
    let cl = 2 * Math.PI * (aoaRad);
    if (aoaDeg > this.stallAngleDeg) {
      // Stall buffeting and lift dump
      this.stallFactor = clamp((aoaDeg - this.stallAngleDeg) / 8.0, 0, 1);
      cl *= (1.0 - this.stallFactor * 0.7);
    } else {
      this.stallFactor = 0;
    }

    // Dynamic pressure Q = 0.5 * rho * v^2
    const dynamicPressure = 0.5 * airDensity * speed * speed;

    // Lift force perpendicular to velocity, aligned with aircraft UP
    const liftMagnitude = cl * dynamicPressure * this.wingArea;
    const liftDir = this.up.clone();
    const liftForce = liftDir.scale(liftMagnitude);

    // Drag force (parasitic + induced + airbrake)
    const cd = this.cd0 + this.inducedDragCoeff * cl * cl + (this.airbrake ? 0.08 : 0);
    const dragMagnitude = cd * dynamicPressure * this.wingArea;
    const dragForce = velNorm.clone().scale(-dragMagnitude);

    // Thrust force aligned with nose
    let currentThrust = enginePower * this.maxThrust;
    if (isAfterburner && this.fuel > 0) currentThrust *= this.afterburnerMultiplier;
    const thrustForce = this.forward.clone().scale(currentThrust);

    // Gravity force
    const gravityForce = new Vec3(0, -this.mass * this.gravity, 0);

    // Total net forces
    const netForce = new Vec3(0, 0, 0)
      .add(thrustForce)
      .add(liftForce)
      .add(dragForce)
      .add(gravityForce);

    // Acceleration a = F / m
    const accel = netForce.scale(1 / this.mass);
    this.vel.add(accel.scale(dt));

    // Calculate instantaneous G-load
    const normalAccel = liftMagnitude / this.mass;
    this.gForce = normalAccel / this.gravity;

    // 4. Rotational rates scaled by dynamic pressure (controls lose authority at low speed)
    const controlAuthority = clamp(speed / 60.0, 0.15, 1.2);
    const pitchRate = this.elevator * 1.8 * controlAuthority;
    const rollRate = this.aileron * 2.8 * controlAuthority;
    const yawRate = this.rudder * 0.8 * controlAuthority;

    this.pitch += pitchRate * dt;
    this.roll += rollRate * dt;
    this.yaw += yawRate * dt;

    // Inherent aerodynamic stability (yaw dampening and slip correction)
    this.roll *= (1.0 - 0.25 * dt);

    this.updateVectors();

    // 5. Integrate position
    this.pos.add(this.vel.clone().scale(dt));
  }

  // Telemetry readouts formatted for cockpit HUD
  getTelemetry() {
    const speedKts = Math.round(this.vel.length() * 1.94384);
    const altFt = Math.round(this.pos.y * 3.28084);
    let hdgDeg = Math.round(((-this.yaw * 180) / Math.PI) % 360);
    if (hdgDeg < 0) hdgDeg += 360;

    return {
      speedKts,
      altFt,
      hdgDeg,
      pitchDeg: Math.round((this.pitch * 180) / Math.PI),
      rollDeg: Math.round((this.roll * 180) / Math.PI),
      throttlePct: Math.round(this.throttle * 100),
      fuelPct: Math.round(this.fuel),
      healthPct: Math.round(this.health),
      gForce: this.gForce.toFixed(1),
      isStalling: this.stallFactor > 0.3,
      isTerrainWarning: this.pos.y < 45 && this.vel.y < -5,
    };
  }
}
