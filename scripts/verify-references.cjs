#!/usr/bin/env node

/**
 * Verify cross-references in skill files.
 *
 * Checks:
 * 1. Markdown links to .md files resolve to existing files
 * 2. Bold skill references (**name** skill / **name** —) match existing skill directories
 *
 * Usage: node scripts/verify-references.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const skillsDir = path.join(rootDir, 'skills');

// Collect all skill directory names
const skillNames = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const errors = [];

// Recursively find all .md files under skills/
function findMarkdownFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

const mdFiles = findMarkdownFiles(skillsDir);

for (const filePath of mdFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(rootDir, filePath);
  const fileDir = path.dirname(filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // 1. Check markdown links to .md files (skip URLs)
    const linkRegex = /\[([^\]]*)\]\(([^)]+\.md(?:#[^)]*)?)\)/g;
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const target = match[2].split('#')[0]; // strip anchor
      if (target.startsWith('http://') || target.startsWith('https://')) continue;

      const resolved = path.resolve(fileDir, target);
      if (!fs.existsSync(resolved)) {
        errors.push({
          file: relPath,
          line: lineNum,
          type: 'broken-link',
          message: `broken link to \`${target}\` — file not found`,
        });
      }
    }

    // 2. Check bold skill references: **name** skill, **name** —
    // Skill names are always lowercase with optional dashes/digits
    const skillRefRegex = /\*\*([a-z][a-z0-9-]+)\*\*(?:\s+skill|\s+\u2014)/g;
    while ((match = skillRefRegex.exec(line)) !== null) {
      const refName = match[1];
      if (!skillNames.includes(refName)) {
        errors.push({
          file: relPath,
          line: lineNum,
          type: 'stale-skill-ref',
          message: `references skill \`**${refName}**\` but \`skills/${refName}/\` does not exist`,
        });
      }
    }
  }
}

// Output
if (errors.length > 0) {
  const brokenLinks = errors.filter((e) => e.type === 'broken-link');
  const staleRefs = errors.filter((e) => e.type === 'stale-skill-ref');

  console.error(
    `Reference verification failed with ${errors.length} issue(s):\n`,
  );

  if (brokenLinks.length > 0) {
    console.error('Broken file links:');
    for (const e of brokenLinks) {
      console.error(`  ${e.file}:${e.line} → ${e.message}`);
    }
    console.error('');
  }

  if (staleRefs.length > 0) {
    console.error('Stale skill references:');
    for (const e of staleRefs) {
      console.error(`  ${e.file}:${e.line} → ${e.message}`);
    }
    console.error('');
  }

  process.exit(1);
} else {
  console.log(
    `Reference verification passed! Checked ${mdFiles.length} file(s) across ${skillNames.length} skill(s).`,
  );
}
