// AeroStrike: Horizon Vector — Complete 3D Tactical Flight Simulation
// make.fun entry for best-flight-game-20261126-0057
// Entrypoint for competition grader and local dossier verification

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(rootDir, 'game'), join(outputDir, 'game'), { recursive: true });

mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(rootDir, 'screenshots'))) {
  cpSync(join(rootDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Build dossier compliant with make.fun gate caps
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
