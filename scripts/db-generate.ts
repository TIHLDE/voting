import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Glob } from 'bun';

const MIGRATIONS_DIR = join(import.meta.dir, '../drizzle');

const result = spawnSync(
    'drizzle-kit',
    ['generate', ...process.argv.slice(2)],
    { stdio: 'inherit' },
);

if (result.status !== 0) process.exit(result.status ?? 1);

const snapshotGlob = new Glob('**/snapshot.json');

const snapshotFiles = await Array.fromAsync(
    snapshotGlob.scan({ cwd: MIGRATIONS_DIR }),
);

for (const snapshotPath of snapshotFiles) {
    const file = Bun.file(join(MIGRATIONS_DIR, snapshotPath));

    const original = await file.json();
    const minified = `${JSON.stringify(original)}\n`;
    file.write(minified);
}
