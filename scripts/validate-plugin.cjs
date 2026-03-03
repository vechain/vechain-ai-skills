#!/usr/bin/env node

/**
 * Validate plugin structure and SKILL.md frontmatter.
 *
 * Usage: node scripts/validate-plugin.cjs
 * Validates from the repository root.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_FRONTMATTER = ['name', 'description', 'license'];

function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};

  for (const line of yaml.split('\n')) {
    if (!line.trim() || /^\s+/.test(line)) {
      if (/^\s+/.test(line)) {
        const subMatch = line.match(/^\s+(\w[\w-]*):\s*(.+)/);
        if (subMatch) {
          if (!result._lastKey) continue;
          if (typeof result[result._lastKey] !== 'object') {
            result[result._lastKey] = {};
          }
          result[result._lastKey][subMatch[1]] = subMatch[2].replace(/^["']|["']$/g, '');
        }
      }
      continue;
    }

    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value = kvMatch[2].trim();

      if (value === '[]') {
        value = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      } else {
        value = value.replace(/^["']|["']$/g, '');
      }

      result[key] = value;
      result._lastKey = key;
    }
  }

  delete result._lastKey;
  return result;
}

function validateSkillFile(skillPath, errors) {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const frontmatter = parseYamlFrontmatter(content);
  const relative = path.relative(process.cwd(), skillPath);

  if (!frontmatter) {
    errors.push(`${relative}: missing YAML frontmatter (---)`);
    return;
  }

  for (const key of REQUIRED_FRONTMATTER) {
    if (!frontmatter[key]) {
      errors.push(`${relative}: missing required frontmatter field "${key}"`);
    }
  }

  const skillDir = path.basename(path.dirname(skillPath));
  if (frontmatter.name && frontmatter.name !== skillDir) {
    errors.push(
      `${relative}: frontmatter name "${frontmatter.name}" does not match directory "${skillDir}"`,
    );
  }
}

function validate(rootDir) {
  const errors = [];
  const abs = path.resolve(rootDir);

  // Check .claude-plugin/plugin.json
  const pluginJsonPath = path.join(abs, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pluginJsonPath)) {
    errors.push('missing .claude-plugin/plugin.json');
  } else {
    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
    if (!pluginJson.name) errors.push('plugin.json missing "name"');
    if (!pluginJson.version) errors.push('plugin.json missing "version"');
    if (!pluginJson.skills || !Array.isArray(pluginJson.skills) || pluginJson.skills.length === 0) {
      errors.push('plugin.json missing or empty "skills" array');
    }
  }

  // Check skills/ directory
  const skillsDir = path.join(abs, 'skills');
  if (!fs.existsSync(skillsDir)) {
    errors.push('missing skills/ directory');
    return errors;
  }

  const skills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  if (skills.length === 0) {
    errors.push('no skills found in skills/ directory');
    return errors;
  }

  const skillNames = [];

  for (const skill of skills) {
    const skillMd = path.join(skillsDir, skill.name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      errors.push(`skills/${skill.name}: missing SKILL.md`);
      continue;
    }
    validateSkillFile(skillMd, errors);
    skillNames.push(skill.name);

    const refsDir = path.join(skillsDir, skill.name, 'references');
    if (fs.existsSync(refsDir)) {
      const refs = fs.readdirSync(refsDir).filter((f) => f.endsWith('.md'));
      if (refs.length === 0) {
        errors.push(`skills/${skill.name}/references: directory exists but has no .md files`);
      }
    }
  }

  // Cross-check plugin.json skills against actual directories
  if (fs.existsSync(pluginJsonPath)) {
    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
    if (pluginJson.skills && Array.isArray(pluginJson.skills)) {
      for (const skillRef of pluginJson.skills) {
        const skillName = path.basename(skillRef);
        if (!skillNames.includes(skillName)) {
          errors.push(`plugin.json references skill "${skillName}" but no matching directory found`);
        }
      }
      for (const name of skillNames) {
        const listed = pluginJson.skills.some((s) => path.basename(s) === name);
        if (!listed) {
          errors.push(`skill "${name}" exists but is not listed in plugin.json`);
        }
      }
    }
  }

  return errors;
}

// Main — validate from repo root (script location is scripts/)
const rootDir = path.resolve(__dirname, '..');
console.log(`Validating: ${rootDir}`);
const errors = validate(rootDir);

if (errors.length > 0) {
  console.error(`\nValidation failed with ${errors.length} error(s):\n`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
} else {
  const skillsDir = path.join(rootDir, 'skills');
  const skillCount = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  console.log(`\nValidation passed! ${skillCount} skill(s) validated.`);
}
