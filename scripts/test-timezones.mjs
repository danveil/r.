import { spawnSync } from 'node:child_process';
for (const timezone of ['UTC', 'Asia/Kuala_Lumpur', 'America/New_York']) {
  process.stdout.write(`\nCalendar-date validation in ${timezone}\n`);
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/vitest/vitest.mjs',
      'run',
      'src/lib/dates.test.ts',
      'src/lib/prediction.test.ts',
      'src/partner/protocol.test.ts',
    ],
    { stdio: 'inherit', env: { ...process.env, TZ: timezone } },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
