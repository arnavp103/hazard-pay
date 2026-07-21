/**
 * End-of-command summary output, kept as its own seam (rather than inline
 * `console.log` calls in command code) so later harness work can append
 * context-sensitive reminders per command without restructuring commands.
 */
export function printSummary(heading: string, lines: readonly string[]): void {
  console.log(`\n${heading}`);
  for (const line of lines) {
    console.log(`  - ${line}`);
  }
}
