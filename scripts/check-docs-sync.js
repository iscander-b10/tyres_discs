#!/usr/bin/env node
/**
 * Docs sync gate: production code changes must include docs/ updates,
 * unless an explicit waiver is provided.
 *
 * Waivers (any one is enough):
 * - env DOCS_NOT_NEEDED="<reason>"
 * - PR/commit body contains: docs-not-needed: <reason>
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CODE_PATH_PATTERNS = [
  /^src\//,
  /^yandex\//,
  /^scripts\//,
  /^package\.json$/,
  /^package-lock\.json$/,
];

const DOCS_PATH_PATTERNS = [
  /^docs\//,
  /^\.cursor\/rules\//,
];

const WAIVER_PATTERN = /docs-not-needed:\s*(.+)/i;

function runGit(args) {
  return execSync(['git', ...args].join(' '), {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function safeRunGit(args) {
  try {
    return runGit(args);
  } catch {
    return '';
  }
}

function resolveBaseRef() {
  if (process.env.DOCS_GATE_BASE) {
    return process.env.DOCS_GATE_BASE;
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      if (event.pull_request?.base?.sha) {
        return event.pull_request.base.sha;
      }
      if (event.before && event.before !== '0000000000000000000000000000000000000000') {
        return event.before;
      }
    } catch {
      // fall through
    }
  }

  const originMain = safeRunGit(['rev-parse', '--verify', 'origin/main']);
  if (originMain) {
    return 'origin/main';
  }

  const hasParent = safeRunGit(['rev-parse', '--verify', 'HEAD~1']);
  if (hasParent) {
    return 'HEAD~1';
  }

  return null;
}

function getChangedFiles(baseRef, headRef) {
  const diffRange = baseRef ? `${baseRef}...${headRef}` : headRef;
  const output = safeRunGit(['diff', '--name-only', diffRange]);
  if (!output) {
    return [];
  }
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => pattern.test(file));
}

function readWaiverFromEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    return null;
  }

  try {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    const candidates = [
      event.pull_request?.body,
      event.pull_request?.title,
      event.head_commit?.message,
      event.commits?.map((commit) => commit.message).join('\n'),
    ].filter(Boolean);

    for (const text of candidates) {
      const match = String(text).match(WAIVER_PATTERN);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
  } catch {
    return null;
  }

  return null;
}

function readWaiverFromRecentCommits(baseRef, headRef) {
  const range = baseRef ? `${baseRef}..${headRef}` : headRef;
  const messages = safeRunGit(['log', '--format=%B', range]);
  if (!messages) {
    return null;
  }

  const match = messages.match(WAIVER_PATTERN);
  return match?.[1]?.trim() || null;
}

function main() {
  const headRef = process.env.DOCS_GATE_HEAD || 'HEAD';
  const baseRef = resolveBaseRef();

  if (!baseRef) {
    console.log('Docs gate: no base ref — skipped (initial commit or empty history).');
    process.exit(0);
  }

  const changedFiles = getChangedFiles(baseRef, headRef);
  if (changedFiles.length === 0) {
    console.log('Docs gate: no changed files — skipped.');
    process.exit(0);
  }

  const codeChanged = changedFiles.some((file) => matchesAny(file, CODE_PATH_PATTERNS));
  const docsChanged = changedFiles.some((file) => matchesAny(file, DOCS_PATH_PATTERNS));

  if (!codeChanged) {
    console.log('Docs gate: production code not changed — passed.');
    process.exit(0);
  }

  if (docsChanged) {
    console.log('Docs gate: docs updated alongside code — passed.');
    process.exit(0);
  }

  const envReason = process.env.DOCS_NOT_NEEDED?.trim();
  const eventReason = readWaiverFromEvent();
  const commitReason = readWaiverFromRecentCommits(baseRef, headRef);
  const waiverReason = envReason || eventReason || commitReason;

  if (waiverReason) {
    console.log(`Docs gate: waived — ${waiverReason}`);
    process.exit(0);
  }

  console.error('');
  console.error('Docs gate FAILED: production code changed without documentation updates.');
  console.error('');
  console.error('Changed production paths (sample):');
  changedFiles
    .filter((file) => matchesAny(file, CODE_PATH_PATTERNS))
    .slice(0, 12)
    .forEach((file) => console.error(`  - ${file}`));
  console.error('');
  console.error('Fix one of:');
  console.error('  1. Update relevant pages under docs/');
  console.error('  2. Add to PR description: docs-not-needed: <reason>');
  console.error('  3. Set env DOCS_NOT_NEEDED="<reason>" for local/CI override');
  console.error('');
  process.exit(1);
}

main();
