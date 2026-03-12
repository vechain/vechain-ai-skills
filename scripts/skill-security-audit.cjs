#!/usr/bin/env node
'use strict';

/**
 * Security audit for skill files.
 *
 * Scans SKILL.md and reference files for:
 *   - Secrets (private keys, API keys, tokens)
 *   - Prompt injection patterns
 *   - Dangerous allowed-tools in frontmatter
 *   - Dangerous code patterns in examples
 *   - External URLs to unknown domains
 *   - Hidden/invisible Unicode characters
 *
 * Usage:
 *   node scripts/skill-security-audit.cjs              # JSON output
 *   node scripts/skill-security-audit.cjs --markdown   # Markdown report
 *
 * Exit codes:
 *   0 — no HIGH severity findings
 *   1 — one or more HIGH severity findings
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

const SAFE_URL_DOMAINS = [
  'vechain.org',
  'vechain.energy',
  'vechain.github.io',
  'github.com',
  'npmjs.com',
  'npmjs.org',
  'npm.im',
  'localhost',
  '127.0.0.1',
  'tanstack.com',
  'react.dev',
  'reactjs.org',
  'soliditylang.org',
  'hardhat.org',
  'openzeppelin.com',
  'ethereum.org',
  'eips.ethereum.org',
  'privy.io',
  'anthropic.com',
  'claude.ai',
  'typescriptlang.org',
  'nextjs.org',
  'chakra-ui.com',
  'vitejs.dev',
  'vite.dev',
  'walletconnect.com',
  'json-schema.org',
  'w3.org',
  'developer.mozilla.org',
  'expo.dev',
  'reactnative.dev',
  'apple.com',
  'android.com',
  'google.com',
  'googleapis.com',
  'vebetterdao.org',
  'docs.vebetterdao.org',
  'veworld.net',
  'www.veworld.net',
  'vet.domains',
  'turbo.build',
  'docs.ethers.org',
  'solidity-by-example.org',
  'hub.docker.com',
  'swcregistry.io',
  'vechain.discourse.group',
  'json.schemastore.org',
  'vechain.mcp.kapa.ai',
  'mainnet.vechain.org',
  'testnet.vechain.org',
  // Common placeholder domains used in code examples
  'example.com',
  'your-delegator.com',
  'myapp.com',
  'proof.url',
];

// ── Helpers ──────────────────────────────────────────────────────────

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

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { allowedTools: [] };
  const match = m[1].match(/allowed-tools:\s*\[([^\]]*)\]/);
  const tools = match
    ? match[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
    : [];
  return { allowedTools: tools };
}

function isDomainSafe(host) {
  return SAFE_URL_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
}

// ── Security Checks ──────────────────────────────────────────────────

function checkSecrets(lines) {
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Private key: 64-char hex near a sensitive keyword
    if (/(?:private|secret|mnemonic|seed)/i.test(line)) {
      const hexMatch = line.match(/(?:0x)?[0-9a-fA-F]{64}\b/);
      if (hexMatch && !/(?:YOUR_|example|placeholder|dummy|process\.env|0{16}|f{16})/i.test(line)) {
        findings.push({
          severity: 'HIGH', id: 'secret-hex-key',
          message: 'Potential private key (64-char hex with sensitive keyword)',
          line: i + 1, excerpt: line.trim().substring(0, 100),
        });
      }
    }

    // 2. AWS access key
    if (/AKIA[0-9A-Z]{16}/.test(line)) {
      findings.push({
        severity: 'HIGH', id: 'secret-aws-key',
        message: 'AWS access key ID',
        line: i + 1, excerpt: line.trim().substring(0, 100),
      });
    }

    // 3. Google API key
    if (/AIza[0-9A-Za-z_-]{35}/.test(line)) {
      findings.push({
        severity: 'HIGH', id: 'secret-gcp-key',
        message: 'Google API key',
        line: i + 1, excerpt: line.trim().substring(0, 100),
      });
    }

    // 4. JWT token (three base64url segments)
    if (/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}/.test(line)) {
      findings.push({
        severity: 'HIGH', id: 'secret-jwt',
        message: 'JWT token',
        line: i + 1, excerpt: line.trim().substring(0, 100),
      });
    }

    // 5. Generic API key assignment
    if (/(?:api[_-]?key|api[_-]?secret|auth[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i.test(line)) {
      if (!/(?:YOUR_|example|placeholder|process\.env|import\.meta)/i.test(line)) {
        findings.push({
          severity: 'MEDIUM', id: 'secret-generic-api-key',
          message: 'Potential hardcoded API key assignment',
          line: i + 1, excerpt: line.trim().substring(0, 100),
        });
      }
    }
  }

  return findings;
}

function checkPromptInjection(lines) {
  const findings = [];

  const patterns = [
    {
      id: 'injection-ignore',
      severity: 'HIGH',
      name: 'Instruction override pattern',
      regex: /ignore\s+(?:all\s+)?(?:previous|prior|above|preceding)\s+(?:instructions|rules|guidelines|prompts)/i,
    },
    {
      id: 'injection-disregard',
      severity: 'HIGH',
      name: 'Instruction disregard pattern',
      regex: /disregard\s+(?:all\s+)?(?:previous|prior|above|preceding)/i,
    },
    {
      id: 'injection-role-override',
      severity: 'HIGH',
      name: 'Role override attempt',
      regex: /^\s*you\s+are\s+now\s+(?:a|an|the)\b/i,
    },
    {
      id: 'injection-system-block',
      severity: 'HIGH',
      name: 'Fake system prompt block',
      regex: /```\s*system\b/i,
    },
    {
      id: 'injection-pretend',
      severity: 'MEDIUM',
      name: 'Role-play injection',
      regex: /(?:pretend|act\s+as\s+if)\s+you\s+(?:are|were|have)\b/i,
    },
    {
      id: 'injection-header',
      severity: 'MEDIUM',
      name: 'Injected instruction header',
      regex: /^(?:new\s+instructions:|BEGIN\s+SYSTEM\b|<\/?system>)/i,
    },
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const pat of patterns) {
      if (pat.regex.test(lines[i])) {
        findings.push({
          severity: pat.severity, id: pat.id,
          message: pat.name,
          line: i + 1, excerpt: lines[i].trim().substring(0, 100),
        });
      }
    }
  }

  return findings;
}

function checkAllowedTools(frontmatter, isSkillMd) {
  if (!isSkillMd) return [];
  const findings = [];

  const dangerous = ['bash', 'computer', 'shell', 'terminal'];

  for (const tool of frontmatter.allowedTools) {
    if (dangerous.some((d) => tool.toLowerCase().includes(d))) {
      findings.push({
        severity: 'MEDIUM', id: 'tools-dangerous',
        message: `Dangerous tool in allowed-tools: "${tool}"`,
        line: 1, excerpt: `allowed-tools includes "${tool}"`,
      });
    }
  }

  return findings;
}

function checkDangerousCode(lines) {
  const findings = [];

  const patterns = [
    {
      id: 'code-rm-rf-root',
      severity: 'HIGH',
      name: 'Destructive rm on root/home path',
      regex: /rm\s+-[a-z]*r[a-z]*f[a-z]*\s+[/~]/,
    },
    {
      id: 'code-curl-pipe-sh',
      severity: 'MEDIUM',
      name: 'Remote code execution (pipe to shell)',
      regex: /(?:curl|wget)\s+[^\n|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh)\b/,
    },
    {
      id: 'code-chmod-777',
      severity: 'MEDIUM',
      name: 'Overly permissive file permissions',
      regex: /chmod\s+777\b/,
    },
    {
      id: 'code-disable-ssl',
      severity: 'MEDIUM',
      name: 'SSL verification disabled',
      regex: /(?:NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|rejectUnauthorized\s*:\s*false)/i,
    },
    {
      id: 'code-eval-dynamic',
      severity: 'MEDIUM',
      name: 'Dynamic code execution via eval()',
      regex: /\beval\s*\(\s*[^'"`)\s]/,
    },
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const pat of patterns) {
      if (pat.regex.test(lines[i])) {
        findings.push({
          severity: pat.severity, id: pat.id,
          message: pat.name,
          line: i + 1, excerpt: lines[i].trim().substring(0, 100),
        });
      }
    }
  }

  return findings;
}

function checkExternalUrls(lines) {
  const findings = [];
  const urlRegex = /https?:\/\/([^\s)'">\]#`]+)/g;

  for (let i = 0; i < lines.length; i++) {
    let match;
    urlRegex.lastIndex = 0;
    while ((match = urlRegex.exec(lines[i])) !== null) {
      const host = match[1].split('/')[0].split(':')[0].replace(/[`'"]+$/, '');
      if (!isDomainSafe(host)) {
        findings.push({
          severity: 'LOW', id: 'url-external',
          message: `External URL: ${host}`,
          line: i + 1, excerpt: match[0].substring(0, 100),
        });
      }
    }
  }

  // javascript: and data: URIs (skip markdown headings like "### JavaScript:")
  for (let i = 0; i < lines.length; i++) {
    if (/(?:href|src|action|url)\s*=\s*['"]?\s*javascript\s*:/i.test(lines[i])) {
      findings.push({
        severity: 'HIGH', id: 'url-javascript',
        message: 'JavaScript URI scheme in attribute',
        line: i + 1, excerpt: lines[i].trim().substring(0, 100),
      });
    }
    if (/data:[^,]+;base64,/i.test(lines[i])) {
      findings.push({
        severity: 'MEDIUM', id: 'url-data-uri',
        message: 'Embedded base64 data URI',
        line: i + 1, excerpt: lines[i].trim().substring(0, 60) + '...',
      });
    }
  }

  return findings;
}

function checkHiddenChars(lines) {
  const findings = [];

  const invisible = [
    { name: 'Zero-width space', regex: /\u200B/, code: 'U+200B' },
    { name: 'Zero-width non-joiner', regex: /\u200C/, code: 'U+200C' },
    { name: 'Zero-width joiner', regex: /\u200D/, code: 'U+200D' },
    { name: 'Right-to-left override', regex: /\u202E/, code: 'U+202E' },
    { name: 'Left-to-right override', regex: /\u202D/, code: 'U+202D' },
    { name: 'Byte order mark (mid-file)', regex: /\uFEFF/, code: 'U+FEFF' },
    { name: 'Word joiner', regex: /\u2060/, code: 'U+2060' },
    { name: 'Invisible separator', regex: /\u2063/, code: 'U+2063' },
    { name: 'Invisible times', regex: /\u2062/, code: 'U+2062' },
    { name: 'Function application', regex: /\u2061/, code: 'U+2061' },
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const ch of invisible) {
      // Allow BOM only at very start of file
      if (ch.code === 'U+FEFF' && i === 0) continue;
      if (ch.regex.test(lines[i])) {
        findings.push({
          severity: 'HIGH', id: 'hidden-char',
          message: `Hidden character: ${ch.name} (${ch.code})`,
          line: i + 1, excerpt: lines[i].trim().substring(0, 80),
        });
      }
    }
  }

  // Homograph: Cyrillic mixed with Latin on the same line
  const cyrillicMixed = /[a-zA-Z][\u0400-\u04FF]|[\u0400-\u04FF][a-zA-Z]/;
  for (let i = 0; i < lines.length; i++) {
    if (cyrillicMixed.test(lines[i])) {
      findings.push({
        severity: 'HIGH', id: 'homograph',
        message: 'Mixed Latin/Cyrillic characters (potential homograph attack)',
        line: i + 1, excerpt: lines[i].trim().substring(0, 80),
      });
    }
  }

  return findings;
}

// ── Main Scanner ─────────────────────────────────────────────────────

function scanFile(filePath, relPath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const isSkillMd = path.basename(filePath) === 'SKILL.md';
  const frontmatter = isSkillMd ? parseFrontmatter(content) : { allowedTools: [] };

  return [
    ...checkSecrets(lines),
    ...checkPromptInjection(lines),
    ...checkAllowedTools(frontmatter, isSkillMd),
    ...checkDangerousCode(lines),
    ...checkExternalUrls(lines),
    ...checkHiddenChars(lines),
  ].map((f) => ({ ...f, file: relPath }));
}

function runAudit() {
  const rootDir = path.resolve(__dirname, '..');
  const files = findMarkdownFiles(SKILLS_DIR);
  const allFindings = [];

  for (const filePath of files) {
    const relPath = path.relative(rootDir, filePath);
    allFindings.push(...scanFile(filePath, relPath));
  }

  const high = allFindings.filter((f) => f.severity === 'HIGH');
  const medium = allFindings.filter((f) => f.severity === 'MEDIUM');
  const low = allFindings.filter((f) => f.severity === 'LOW');

  return { findings: allFindings, high, medium, low, fileCount: files.length };
}

// ── Output Formatting ────────────────────────────────────────────────

function formatMarkdown({ findings, high, medium, low, fileCount }) {
  const lines = [];
  lines.push('## Skill Security Audit');
  lines.push('');

  if (findings.length === 0) {
    lines.push(`Scanned ${fileCount} file(s) — no security issues found.`);
    return lines.join('\n');
  }

  const affectedFiles = new Set(findings.map((f) => f.file)).size;
  lines.push(`Scanned ${fileCount} file(s) — found **${findings.length}** issue(s) across ${affectedFiles} file(s).`);
  lines.push('');

  function severityTable(items, label, emoji) {
    if (items.length === 0) return;
    lines.push(`### ${emoji} ${label} (${items.length})`);
    lines.push('');
    lines.push('| File | Line | Finding | Excerpt |');
    lines.push('|------|------|---------|---------|');
    for (const f of items) {
    const esc = f.excerpt.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/`/g, '');
    lines.push(`| \`${f.file}\` | ${f.line} | ${f.message} | \`${esc}\` |`);
    }
    lines.push('');
  }

  severityTable(high, 'HIGH', '\u{1F534}');
  severityTable(medium, 'MEDIUM', '\u{1F7E1}');

  if (low.length > 0) {
    lines.push(`<details><summary>\u{1F535} LOW (${low.length})</summary>`);
    lines.push('');
    lines.push('| File | Line | Finding | Excerpt |');
    lines.push('|------|------|---------|---------|');
    for (const f of low) {
      const esc = f.excerpt.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/`/g, '');
      lines.push(`| \`${f.file}\` | ${f.line} | ${f.message} | \`${esc}\` |`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  if (high.length > 0) {
    lines.push('> **Action required:** HIGH severity findings must be resolved before merge.');
  } else if (medium.length > 0) {
    lines.push('> **Review recommended:** MEDIUM findings should be verified by a reviewer.');
  }

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────

const result = runAudit();

if (process.argv.includes('--markdown')) {
  console.log(formatMarkdown(result));
} else {
  // Human-readable console output
  if (result.findings.length === 0) {
    console.log(`Security audit passed! Scanned ${result.fileCount} file(s) — no issues found.`);
  } else {
    console.log(`Security audit found ${result.findings.length} issue(s):\n`);
    for (const sev of ['HIGH', 'MEDIUM', 'LOW']) {
      const items = result.findings.filter((f) => f.severity === sev);
      if (items.length === 0) continue;
      console.log(`  ${sev} (${items.length}):`);
      for (const f of items) {
        console.log(`    ${f.file}:${f.line} — ${f.message}`);
      }
      console.log('');
    }
  }
}

// Exit 1 only if HIGH severity findings exist
if (result.high.length > 0) {
  process.exit(1);
}
