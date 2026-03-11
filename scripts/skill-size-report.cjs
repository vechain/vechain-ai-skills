#!/usr/bin/env node
'use strict';

/**
 * Generates a skill size report as a GitHub-flavoured Markdown table.
 * Output: JSON with { summary, skills } written to stdout.
 *
 * Usage:
 *   node scripts/skill-size-report.cjs            # prints JSON
 *   node scripts/skill-size-report.cjs --markdown  # prints Markdown table
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const LARGE_REF_THRESHOLD = 20000; // chars — flag references above this
const LARGE_SKILL_THRESHOLD = 8000; // chars — flag SKILL.md above this

function getFileStats(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;
  const chars = Buffer.byteLength(content, 'utf-8');
  return { lines, chars };
}

function analyseSkill(skillDir) {
  const name = path.basename(skillDir);
  const skillMdPath = path.join(skillDir, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) return null;

  const skillMd = getFileStats(skillMdPath);
  const refsDir = path.join(skillDir, 'references');
  const refs = [];
  let totalRefChars = 0;
  let totalRefLines = 0;

  if (fs.existsSync(refsDir)) {
    for (const file of fs.readdirSync(refsDir).sort()) {
      if (!file.endsWith('.md')) continue;
      const stats = getFileStats(path.join(refsDir, file));
      refs.push({ file, ...stats });
      totalRefChars += stats.chars;
      totalRefLines += stats.lines;
    }
  }

  return {
    name,
    skillMd,
    refs,
    totalChars: skillMd.chars + totalRefChars,
    totalLines: skillMd.lines + totalRefLines,
    totalRefChars,
    totalRefLines,
    refCount: refs.length,
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function generateMarkdown(skills) {
  const sorted = [...skills].sort((a, b) => b.totalChars - a.totalChars);
  const grandTotalChars = sorted.reduce((s, sk) => s + sk.totalChars, 0);
  const grandTotalLines = sorted.reduce((s, sk) => s + sk.totalLines, 0);

  const lines = [];
  lines.push('## Skill Size Report');
  lines.push('');
  lines.push('| Skill | SKILL.md | References | Total | Flags |');
  lines.push('|-------|----------|------------|-------|-------|');

  for (const sk of sorted) {
    const flags = [];
    if (sk.skillMd.chars > LARGE_SKILL_THRESHOLD) {
      flags.push(`SKILL.md ${formatBytes(sk.skillMd.chars)}`);
    }
    for (const ref of sk.refs) {
      if (ref.chars > LARGE_REF_THRESHOLD) {
        flags.push(`${ref.file} ${formatBytes(ref.chars)}`);
      }
    }
    const flagStr = flags.length > 0 ? flags.map(f => `\u26a0\ufe0f ${f}`).join(', ') : '\u2705';

    lines.push(
      `| **${sk.name}** ` +
      `| ${sk.skillMd.lines} lines (${formatBytes(sk.skillMd.chars)}) ` +
      `| ${sk.refCount} files, ${sk.totalRefLines} lines (${formatBytes(sk.totalRefChars)}) ` +
      `| ${formatBytes(sk.totalChars)} ` +
      `| ${flagStr} |`
    );
  }

  lines.push(
    `| **TOTAL** | | | **${formatBytes(grandTotalChars)}** (${grandTotalLines} lines) | |`
  );

  lines.push('');
  lines.push('<details><summary>Large reference files (>' + formatBytes(LARGE_REF_THRESHOLD) + ')</summary>');
  lines.push('');
  lines.push('| File | Size | Lines |');
  lines.push('|------|------|-------|');

  const largeRefs = [];
  for (const sk of sorted) {
    for (const ref of sk.refs) {
      if (ref.chars > LARGE_REF_THRESHOLD) {
        largeRefs.push({ skill: sk.name, ...ref });
      }
    }
  }
  largeRefs.sort((a, b) => b.chars - a.chars);

  if (largeRefs.length === 0) {
    lines.push('| _None_ | | |');
  } else {
    for (const ref of largeRefs) {
      lines.push(`| ${ref.skill}/references/${ref.file} | ${formatBytes(ref.chars)} | ${ref.lines} |`);
    }
  }

  lines.push('');
  lines.push('</details>');
  lines.push('');
  lines.push('> Large files consume more context window when loaded. Consider splitting files over ' + formatBytes(LARGE_REF_THRESHOLD) + ' into focused sub-references.');

  return lines.join('\n');
}

// Main
const skillDirs = fs.readdirSync(SKILLS_DIR)
  .map(d => path.join(SKILLS_DIR, d))
  .filter(d => fs.statSync(d).isDirectory());

const skills = skillDirs.map(analyseSkill).filter(Boolean);

if (process.argv.includes('--markdown')) {
  console.log(generateMarkdown(skills));
} else {
  console.log(JSON.stringify({ skills }, null, 2));
}
