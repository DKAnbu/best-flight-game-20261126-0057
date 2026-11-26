[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/DKAnbu/best-flight-game-20261126-0057/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/DKAnbu/best-flight-game-20261126-0057/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

# ✈️ AEROSTRIKE: HORIZON VECTOR

Simulator terbang 3D taktis di browser — murni JavaScript, tanpa engine, tanpa
aset eksternal. Renderer 3D software-written di atas canvas 2D, fisika terbang
berbasis kurva lift aerodinamis nyata, dan kokpit avionik militer lengkap.
Kamu menerbangkan **AV-77 Osprey-Delta** di arena kedirgantaraan prosedural:
ngarai vulkanik, runway pulau menyala, dan patroli anti-drone.

## Fitur

- **Fisika terbang sungguhan** — kurva lift vs angle-of-attack, induced drag,
  stall AoA tinggi, engine spool (throttle tidak instan), G-force nyata,
  rudder/aileron/elevator terpisah.
- **Renderer 3D custom** — terrain heightmap prosedural, cincin checkpoint,
  runway berlampu, drone, tracer meriam, semua diproyeksikan ke canvas 2D
  tanpa WebGL/Three.js.
- **Kokpit & chase cam** — tekan `C` untuk bolak-balik; overlay kanopi,
  glare shield, backup ADI, fuel flow, dan G-meter menyala di mode kokpit.
- **HUD avionik penuh** — tape kecepatan (IAS) dengan garis stall, tape
  altitude dengan indikator tanah, heading kompas, throttle & fuel bar,
  flight-path marker, target director + jarak waypoint, peringatan
  STALL dan PULL UP.
- **Audio synthesizer** — suara engine mengikuti throttle/speed, meriam,
  beep checkpoint; toggle dengan `M`.
- **3 sortie** dengan kondisi menang/kalah sendiri-sendiri + modal debrief
  telemetri (skor, waktu, bahan bakar).

## Cara main

- **Gerak:** `W`/`S` pitch (elevators), `A`/`D` roll (ailerons), `Q`/`E`
  yaw (rudder).
- **Throttle:** `Shift` naik (afterburner), `Ctrl` turun (airbrake).
- **Meriam:** `Space` — 20mm Vulcan.
- **Kamera:** `C` — kokpit ↔ chase. **Audio:** `M`.
- **Mulai sortie:** `Enter` (atau klik kartu misi lalu tombol LAUNCH).
- Jaga kecepatan di atas stall (110 KTS) dan hati-hati menabrak terrain —
  terrain collision = crash, kecuali landing di runway Sortie 02.

## Misi (Sorties)

1. **Sortie 01 — Canyon Rings Rally:** presisi low-level menembus 8 cincin
   ngarai vulkanik; tiap cincin = +250 skor.
2. **Sortie 02 — Runway Touchdown Protocol:** approach ke runway pulau
   berlampu, kelola glide slope, touchdown lembut lalu brake ke nol.
3. **Sortie 03 — Island Defense Patrol:** intercept 4 drone pengintai dengan
   meriam Vulcan sambil melindungi hangar suplai angkatan laut.

## Jalankan lokal

```bash
node serve.ts        # sajikan game/ di http://localhost:8080
```

Atau buka `game/index.html` langsung di browser — nol build step, nol
dependensi.
