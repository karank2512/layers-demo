import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { analyze } from "./analyze.js";

const [fixturesDir = "fixtures", outPath = "data/results.json"] = process.argv.slice(2);

const results = analyze(fixturesDir);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n");

console.log(`Checked ${results.exportsChecked} instrument exports across ${results.members.length} members.\n`);
if (results.queue.length === 0) {
  console.log("Staff review queue: empty - nothing needs a human look.");
} else {
  console.log(`Staff review queue (${results.queue.length} items, a person decides each):`);
  for (const f of results.queue) {
    console.log(`  ${f.memberId} ${f.visitDate} ${f.file.split("/").pop()}: ${f.detail}`);
  }
}
if (results.notes.length > 0) {
  console.log(`\nNotes (${results.notes.length}):`);
  for (const n of results.notes) console.log(`  ${n}`);
}
console.log(`\nResults written to ${outPath}`);
