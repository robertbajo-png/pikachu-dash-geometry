#!/usr/bin/env node
import { spawn } from 'node:child_process';

const rawArgs = process.argv.slice(2);

const aliasMap = new Map([
  ['host', '--host'],
  ['remote', '--host'],
  ['--remote', '--host'],
  ['-H', '--host'],
  ['build', '--build'],
  ['-b', '--build'],
  ['preview', '--preview'],
  ['-p', '--preview']
]);

const helpFlags = new Set(['--help', '-h', 'help']);
const normalizedArgs = [];

const truthyEnvValues = new Set(['true', '1', 'yes']);
const npmBooleanFlagMap = new Map([
  ['npm_config_host', '--host'],
  ['npm_config_preview', '--preview'],
  ['npm_config_build', '--build']
]);

for (const arg of rawArgs) {
  if (helpFlags.has(arg)) {
    console.log(`Usage: npm run run [--build|--preview|--host] [-- <extra vite args>]\n\n` +
      `Examples:\n` +
      `  npm run run              # local dev server\n` +
      `  npm run run --host       # hosted dev server\n` +
      `  npm run run -- --host    # hosted dev server (explicit separator)\n` +
      `  npm run run -- --build   # production build\n` +
      `  npm run run -- --preview # preview already-built output\n\n` +
      `Environment:\n` +
      `  RUN_GAME_HOST=true  # default to the hosted dev server\n`);
    process.exit(0);
  }

  normalizedArgs.push(aliasMap.get(arg) ?? arg);
}

for (const [envKey, canonicalFlag] of npmBooleanFlagMap) {
  const envValue = process.env[envKey]?.toLowerCase();
  if (truthyEnvValues.has(envValue) && !normalizedArgs.includes(canonicalFlag)) {
    normalizedArgs.push(canonicalFlag);
  }
}

const flagSet = new Set(['--host', '--preview', '--build']);
const selectedFlags = normalizedArgs.filter((arg) => flagSet.has(arg));

if (selectedFlags.length > 1) {
  console.error('[run-game] Choose only one of --build, --preview, or --host at a time.');
  process.exit(1);
}

const passthroughArgs = normalizedArgs.filter((arg) => !flagSet.has(arg));

const envHostPreference = process.env.RUN_GAME_HOST?.toLowerCase();
const wantsHostByEnv = envHostPreference === 'true' || envHostPreference === '1' || envHostPreference === 'yes';

const wantsPreview = selectedFlags.includes('--preview');
const wantsBuild = selectedFlags.includes('--build');
const wantsHost = selectedFlags.includes('--host') || wantsHostByEnv;

let scriptName = 'dev';
let friendlyName = 'Vite dev server';
if (wantsPreview) {
  scriptName = 'preview';
  friendlyName = 'Vite preview server';
} else if (wantsBuild) {
  scriptName = 'build';
  friendlyName = 'Vite production build';
} else if (wantsHost) {
  scriptName = 'dev:host';
  friendlyName = 'hosted dev server';
}

const npmArgs = ['run', scriptName];
if (passthroughArgs.length > 0) {
  npmArgs.push('--', ...passthroughArgs);
}

const extraArgsDisplay = passthroughArgs.length > 0 ? ` (extra args: ${passthroughArgs.join(' ')})` : '';
console.log(`[run-game] Launching ${friendlyName} via "npm ${npmArgs.join(' ')}"${extraArgsDisplay}`);

const child = spawn('npm', npmArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

child.on('error', (error) => {
  console.error(`[run-game] Failed to launch npm run ${scriptName}:`, error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
