// math3d.js — 3D Vector, Matrix, and Coordinate Math for AeroStrike

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  scale(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  normalize() {
    const len = this.length();
    if (len > 0.00001) {
      this.scale(1 / len);
    }
    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    return new Vec3(x, y, z);
  }

  distTo(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

export class Mat4 {
  constructor() {
    this.elements = new Float32Array(16);
    this.identity();
  }

  identity() {
    const e = this.elements;
    e.fill(0);
    e[0] = 1; e[5] = 1; e[10] = 1; e[15] = 1;
    return this;
  }

  static perspective(fovRad, aspect, near, far) {
    const m = new Mat4();
    const e = m.elements;
    const f = 1.0 / Math.tan(fovRad / 2);
    const rangeInv = 1.0 / (far - near);

    // Left-handed projection (matches the aircraft frame: right=+X, up=+Y, forward=+Z)
    e[0] = f / aspect;
    e[5] = f;
    e[10] = (far + near) * rangeInv;
    e[11] = 1;
    e[14] = -2 * far * near * rangeInv;
    e[15] = 0;
    return m;
  }

  static lookAt(eye, target, up) {
    const m = new Mat4();
    const e = m.elements;

    const zAxis = target.clone().sub(eye).normalize(); // camera forward (+Z, left-handed)
    const xAxis = up.clone().cross(zAxis).normalize();
    const yAxis = zAxis.clone().cross(xAxis).normalize();

    e[0] = xAxis.x; e[4] = xAxis.y; e[8] = xAxis.z;  e[12] = -xAxis.dot(eye);
    e[1] = yAxis.x; e[5] = yAxis.y; e[9] = yAxis.z;  e[13] = -yAxis.dot(eye);
    e[2] = zAxis.x; e[6] = zAxis.y; e[10] = zAxis.z; e[14] = -zAxis.dot(eye);
    e[3] = 0;       e[7] = 0;       e[11] = 0;       e[15] = 1;
    return m;
  }

  multiply(b) {
    const res = new Mat4();
    const r = res.elements;
    const a = this.elements;
    const be = b.elements;

    // Column-major storage (elements[col * 4 + row]) to match perspective/lookAt/transformPoint
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        r[col * 4 + row] =
          a[row] * be[col * 4] +
          a[4 + row] * be[col * 4 + 1] +
          a[8 + row] * be[col * 4 + 2] +
          a[12 + row] * be[col * 4 + 3];
      }
    }
    return res;
  }

  transformPoint(v) {
    const e = this.elements;
    const x = v.x, y = v.y, z = v.z;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];

    if (Math.abs(w) < 0.000001) return null;
    const invW = 1.0 / w;

    return {
      x: (e[0] * x + e[4] * y + e[8] * z + e[12]) * invW,
      y: (e[1] * x + e[5] * y + e[9] * z + e[13]) * invW,
      z: (e[2] * x + e[6] * y + e[10] * z + e[14]) * invW,
      w: w
    };
  }
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}
