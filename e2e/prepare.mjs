// Starts (or resets) the local Supabase stack the end-to-end tests run against, using the
// current schema and Edge Functions. Needs Docker running.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const supabase = 'npx --yes supabase@2.122.0';
const workdir = '--workdir e2e';

rmSync('e2e/supabase/migrations', { recursive: true, force: true });
rmSync('e2e/supabase/functions', { recursive: true, force: true });
mkdirSync('e2e/supabase/migrations', { recursive: true });
cpSync('supabase/schema.sql', 'e2e/supabase/migrations/20260101000000_schema.sql');
cpSync('supabase/functions', 'e2e/supabase/functions', { recursive: true });

const run = command => execSync(command, { stdio: 'inherit' });
let running = false;
try {
  execSync(`${supabase} status ${workdir}`, { stdio: 'ignore' });
  running = true;
} catch {
  // Not running yet.
}
if (running) run(`${supabase} db reset --local ${workdir}`);
else run(`${supabase} start ${workdir} -x vector,imgproxy,logflare,supavisor,postgres-meta,studio,realtime,storage-api`);
