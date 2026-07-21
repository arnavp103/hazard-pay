#!/usr/bin/env node
/**
 * Pre-check for a commitlint parser footgun: `conventional-commits-parser`
 * (used here via commitlint's `conventional-changelog-conventionalcommits`
 * parserPreset) walks a commit message LINE BY LINE, not paragraph by
 * paragraph. The moment any line matches its issue-reference pattern — a bare
 * `#<digits>` with the right boundary, or an action keyword like "fixes" /
 * "closes" appearing anywhere in the line, not just at its start — that line
 * and every line after it, for the rest of the message, get reclassified from
 * `body` into `footer`. The flip never reverses.
 *
 * When that reclassified footer boundary doesn't line up with a blank line
 * already present in the raw text (i.e. the ref isn't the first line of its
 * paragraph), commitlint's `footer-leading-blank` rule fires — a genuinely
 * confusing error, because the actual trailing `Refs: #N` footer the author
 * wrote is fine on its own. See hazard-pay#43 for the incident that reported
 * three failed commits and a wrong debugging path caused by this.
 *
 * Rather than reimplement that parser's line-by-line state machine here
 * (fragile, and it only reproduces the bug for refs that aren't
 * paragraph-initial), this check enforces the simpler rule this repo already
 * documents: a bare `#<digits>` issue reference belongs ONLY in the trailing
 * footer paragraph (`Refs: #43`, `Fixes #43`, ...), never in body prose —
 * regardless of exact position. That's stricter than the parser bug strictly
 * requires (a paragraph-initial bare ref currently happens not to trip it),
 * but it matches `.agents/skills/implement/SKILL.md`'s existing guidance and
 * stays correct if the parser or preset ever changes.
 *
 * Verified NOT to reproduce against this repo's actual config
 * (`issuePrefixes: ['#']` only, inherited from config-conventional's
 * `conventional-changelog-conventionalcommits` parserPreset): a bare `:NNNN`
 * pattern in body prose (e.g. "serving on :3001"), which a later session
 * suspected triggered the same misparse. It doesn't — the parser's reference
 * regex is keyed off `issuePrefixes`, and `:` isn't one of them here. No
 * detector for it is built; that would be solving a problem this config
 * doesn't have. Revisit only if `issuePrefixes` ever grows a `:`-based entry.
 */

import { readFileSync } from "node:fs";

// Mirrors conventional-commits-parser's own reference boundary: a `#`
// followed by digits, followed by whitespace, end-of-line, or one of
// `,;)]`. This is also what makes code-span refs (`` `#1` ``) safe without
// any special-casing — a closing backtick right after the digits fails this
// lookahead, so the real parser never sees them as references, and neither
// does this check.
const BARE_REF = /#\d+(?=[\s,;)\]]|$)/;

// A line counts as a footer trailer if it's either a git-trailer `Token:
// value` line (e.g. `Refs: #43`, `Signed-off-by: ...`) or a bare GitHub
// closing keyword followed by an issue ref (e.g. `Fixes #43`, `Closes #10`).
const TRAILER_LINE
  = /^(?:[A-Za-z][\w-]*:\s+\S|(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#\d+)/i;

function stripCommentLines(raw) {
  return raw
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("#"))
    .join("\n");
}

function splitParagraphs(lines) {
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length) paragraphs.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) paragraphs.push(current);
  return paragraphs;
}

function isTrailerParagraph(paragraph) {
  return paragraph.length > 0 && paragraph.every((line) => TRAILER_LINE.test(line));
}

/**
 * Returns the first bare issue ref (e.g. `"#43"`) found in the commit body
 * outside a recognized trailing footer paragraph, or `null` if the message is
 * clean.
 */
export function findBareRef(message) {
  const lines = stripCommentLines(message).split(/\r?\n/);

  // First non-blank line is the header/subject — out of scope for this check.
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  const rest = lines.slice(i + 1);

  const paragraphs = splitParagraphs(rest);
  const last = paragraphs.at(-1);
  const hasTrailingFooter = last !== undefined && isTrailerParagraph(last);
  const toScan = hasTrailingFooter ? paragraphs.slice(0, -1) : paragraphs;

  for (const paragraph of toScan) {
    for (const line of paragraph) {
      const match = BARE_REF.exec(line);
      if (match) {
        return match[0];
      }
    }
  }
  return null;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("check-commit-body-refs: no commit message file given");
    process.exit(1);
  }
  const message = readFileSync(file, "utf8");
  const ref = findBareRef(message);
  if (ref) {
    console.error(
      `commit-msg: bare issue ref "${ref}" in commit body — move it to a trailing `
      + `"Refs: ${ref}" footer (a bare ref left in body prose can otherwise make `
      + `commitlint's parser misreport the error as "footer must have leading blank line")`,
    );
    process.exit(1);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
