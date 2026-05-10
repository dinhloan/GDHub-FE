import { existsSync, readFileSync } from 'node:fs';

for (const file of ['.env', '.env.local', '.env.development', '.env.production']) {
  if (!existsSync(file)) {
    continue;
  }

  const content = readFileSync(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) {
      continue;
    }
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const requiredForDeploy = ['VITE_API_URL'];
const optional = ['VITE_SOCKET_URL'];
const isStrict = Boolean(process.env.CI || process.env.VERCEL);

const missing = requiredForDeploy.filter((key) => !process.env[key]?.trim());
const unsetOptional = optional.filter((key) => !process.env[key]?.trim());

if (missing.length) {
  const message = `Missing required frontend env var(s): ${missing.join(', ')}.`;
  if (isStrict) {
    console.error(message);
    console.error('Set them in Vercel Project Settings before building.');
    process.exit(1);
  }

  console.warn(`${message} Local build will fall back to http://localhost:3000/api.`);
}

if (unsetOptional.length) {
  console.warn(`Optional frontend env var(s) not set: ${unsetOptional.join(', ')}.`);
}

console.log('Frontend environment check completed.');
