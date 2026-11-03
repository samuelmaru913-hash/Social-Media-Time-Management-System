const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const backendDir = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendDir, '..');

for (const envPath of [
    path.join(projectRoot, '.env.local'),
    path.join(projectRoot, '.env'),
    path.join(backendDir, '.env'),
]) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
}

const prismaArgs = process.argv.slice(2);
const isGenerate = prismaArgs[0] === 'generate';

for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']) {
    if (/^postgres(?:ql)?:\/\//i.test(process.env[key] || '')) {
        continue;
    }

    if (isGenerate) {
        process.env[key] = 'postgresql://prisma:generate@localhost:5432/prisma_generate?schema=public';
        continue;
    }

    console.error(`${key} must be a PostgreSQL connection URL to use the PostgreSQL Prisma schema.`);
    process.exit(1);
}

const prismaCli = require.resolve('prisma');
const result = spawnSync(process.execPath, [prismaCli, ...prismaArgs], {
    cwd: backendDir,
    env: process.env,
    stdio: 'inherit',
});

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);
