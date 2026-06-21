import { loadEnvConfig } from "@next/env";

import { runLiveSmokeCommand } from "@/server/validation/liveSmoke";

loadEnvConfig(process.cwd());

void runLiveSmokeCommand({
  args: process.argv.slice(2),
  env: {
    STG_AI_MODE: process.env.STG_AI_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  },
  output: {
    write(line) {
      console.log(line);
    }
  }
}).then((exitCode) => {
  process.exitCode = exitCode;
});
