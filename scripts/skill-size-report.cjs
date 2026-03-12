#!/usr/bin/env node
'use strict';

/**
 * Generates a skill size report with estimated token counts.
 *
 * Token estimation uses ~4 chars per token (standard approximation for
 * mixed English/code content with Claude's tokenizer).
 *
 * Usage:
 *   node scripts/skill-size-report.cjs            # prints JSON
 *   node scripts/skill-size-report.cjs --markdown  # prints Markdown table
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

// Thresholds in estimated tokens
const SKILL_MD_TOKEN_THRESHOLD = 2000; // SKILL.md is always loaded — alert above this
const REF_FILE_TOKEN_THRESHOLD = 5000; // single ref file — alert above this

function estimateTokens(chars) {
  return Math.ceil(chars / 4);
}

function formatTokens(tokens) {
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}K`;
}

function getFileStats(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const chars = Buffer.byteLength(content, 'utf-8');
  return { chars, tokens: estimateTokens(chars) };
}

function analyseSkill(skillDir) {
  const name = path.basename(skillDir);
  const skillMdPath = path.join(skillDir, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) return null;

  const skillMd = getFileStats(skillMdPath);
  const refsDir = path.join(skillDir, 'references');
  const refs = [];
  let totalRefTokens = 0;

  if (fs.existsSync(refsDir)) {
    for (const file of fs.readdirSync(refsDir).sort()) {
      if (!file.endsWith('.md')) continue;
      const stats = getFileStats(path.join(refsDir, file));
      refs.push({ file, ...stats });
      totalRefTokens += stats.tokens;
    }
  }

  return {
    name,
    skillMd,
    refs,
    totalTokens: skillMd.tokens + totalRefTokens,
    totalRefTokens,
    refCount: refs.length,
  };
}

function generateMarkdown(skills) {
  const sorted = [...skills].sort((a, b) => b.totalTokens - a.totalTokens);
  const grandTotal = sorted.reduce((s, sk) => s + sk.totalTokens, 0);

  const lines = [];
  lines.push('## Skill Size Report');
  lines.push('');
  lines.push('| Skill | SKILL.md (always loaded) | Ref files (on demand) | Total est. tokens | Alerts |');
  lines.push('|-------|-------------------------|----------------------|-------------------|--------|');

  for (const sk of sorted) {
    const alerts = [];

    if (sk.skillMd.tokens > SKILL_MD_TOKEN_THRESHOLD) {
      alerts.push(`SKILL.md ~${formatTokens(sk.skillMd.tokens)} tok (always in context)`);
    }
    for (const ref of sk.refs) {
      if (ref.tokens > REF_FILE_TOKEN_THRESHOLD) {
        alerts.push(`${ref.file} ~${formatTokens(ref.tokens)} tok (consider splitting)`);
      }
    }

    const alertStr = alerts.length > 0
      ? alerts.map((a) => `\u26a0\ufe0f ${a}`).join('<br>')
      : '\u2705';

    lines.push(
      `| **${sk.name}** ` +
      `| ~${formatTokens(sk.skillMd.tokens)} tok ` +
      `| ${sk.refCount} files, ~${formatTokens(sk.totalRefTokens)} tok ` +
      `| ~${formatTokens(sk.totalTokens)} tok ` +
      `| ${alertStr} |`,
    );
  }

  lines.push(
    `| **TOTAL** | | | **~${formatTokens(grandTotal)} tok** | |`,
  );

  // Detail table for large files
  lines.push('');
  lines.push(`<details><summary>Large reference files (>${formatTokens(REF_FILE_TOKEN_THRESHOLD)} tok)</summary>`);
  lines.push('');
  lines.push('| File | Est. tokens |');
  lines.push('|------|-------------|');

  const largeRefs = [];
  for (const sk of sorted) {
    for (const ref of sk.refs) {
      if (ref.tokens > REF_FILE_TOKEN_THRESHOLD) {
        largeRefs.push({ skill: sk.name, ...ref });
      }
    }
  }
  largeRefs.sort((a, b) => b.tokens - a.tokens);

  if (largeRefs.length === 0) {
    lines.push('| _None_ | |');
  } else {
    for (const ref of largeRefs) {
      lines.push(`| ${ref.skill}/references/${ref.file} | ~${formatTokens(ref.tokens)} |`);
    }
  }

  lines.push('');
  lines.push('</details>');
  lines.push('');
  lines.push('> **How to read this:** SKILL.md is always loaded into the context window. Reference files are loaded on demand when the topic matches. Token counts are estimates (~4 chars/token). Consider splitting reference files over ~' + formatTokens(REF_FILE_TOKEN_THRESHOLD) + ' tokens.');

  return lines.join('\n');
}

// Main
const skillDirs = fs.readdirSync(SKILLS_DIR)
  .map((d) => path.join(SKILLS_DIR, d))
  .filter((d) => fs.statSync(d).isDirectory());

const skills = skillDirs.map(analyseSkill).filter(Boolean);

if (process.argv.includes('--markdown')) {
  console.log(generateMarkdown(skills));
} else {
  console.log(JSON.stringify({ skills }, null, 2));
}
