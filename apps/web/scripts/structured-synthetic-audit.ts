import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  loadStructuredSyntheticTrajectories,
  runStructuredSyntheticAudit
} from "@/server/benchmarks/structuredPracticeSyntheticAudit";

const outputDirectory = resolve(
  process.cwd(),
  process.argv[2] ?? "output/evals/structured-v04-synthetic"
);
const run = runStructuredSyntheticAudit(
  loadStructuredSyntheticTrajectories()
);

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, "summary.json"),
  `${JSON.stringify(run.summary, null, 2)}\n`
);
writeFileSync(
  resolve(outputDirectory, "cases.jsonl"),
  `${run.cases.map((item) => JSON.stringify(item)).join("\n")}\n`
);
writeFileSync(resolve(outputDirectory, "report.md"), run.markdown);

console.log(
  `Synthetic user audit: ${run.summary.totalTrajectories} trajectories, ${run.summary.personas.length} personas, fixture integrity ${run.summary.fixtureIntegrity.passed ? "passed" : "failed"}.`
);
console.log(`Artifacts: ${outputDirectory}`);

if (!run.summary.fixtureIntegrity.passed) {
  process.exitCode = 1;
}
