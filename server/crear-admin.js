// Uso: npm run admin:crear -- <usuario> <contraseña>
// Guarda el usuario y el hash de la contraseña en data/admin.json (no se sube a git).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashClave } from './admin.js';

const [usuario, clave] = process.argv.slice(2);
if (!usuario || !clave) {
  console.error('Uso: npm run admin:crear -- <usuario> <contraseña>');
  process.exit(1);
}
const ruta = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'admin.json');
mkdirSync(dirname(ruta), { recursive: true });
writeFileSync(ruta, JSON.stringify({ usuario, ...hashClave(clave) }, null, 2), { mode: 0o600 });
console.log(`Administrador "${usuario}" guardado en data/admin.json`);
