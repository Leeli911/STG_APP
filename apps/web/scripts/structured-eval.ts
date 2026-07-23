import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  loadStructuredPracticeGoldenSet,
  runStructuredPracticeEval
} from "@/server/benchmarks/structuredPracticeEval";

const outputDirectory = resolve(
  process.cwd(),
  resolveOutputDirectory(process.argv.slice(2))
);
const run = runStructuredPracticeEval(loadStructuredPracticeGoldenSet());

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
  `Structured practice eval: ${run.summary.totalCases} cases, Macro-F1 ${run.summary.macroF1.toFixed(3)}, release gate ${run.summary.releaseGate.passed ? "passed" : "failed"}.`
);
console.log(`Artifacts: ${outputDirectory}`);

if (!run.summary.releaseGate.passed) {
  process.exitCode = 1;
}

function resolveOutputDirectory(args: string[]) {
  const flagIndex = args.findIndex(
    (argument) => argument === "--output" || argument === "--output-dir"
  );
  if (flagIndex >= 0) {
    const value = args[flagIndex + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${args[flagIndex]} requires a directory.`);
    }
    return value;
  }

  return args.find((argument) => !argument.startsWith("--")) ??
    "output/evals/structured-v04";
}
