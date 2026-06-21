import { loadEnvConfig } from "@next/env";

import { runLiveAttemptVerificationCommand } from "@/server/validation/liveAttemptVerifier";

loadEnvConfig(process.cwd());

void runLiveAttemptVerificationCommand({
  args: process.argv.slice(2),
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  output: {
    write(line) {
      console.log(line);
    }
  }
}).then((exitCode) => {
  process.exitCode = exitCode;
});
