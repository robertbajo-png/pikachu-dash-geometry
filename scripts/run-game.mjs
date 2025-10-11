#!/usr/bin/env node
import { spawn } from 'node:child_process';

const rawArgs = process.argv.slice(2);

const envPortRaw = process.env.npm_config_port;
const envPortLooksNumeric =
  typeof envPortRaw === 'string' && envPortRaw.length > 0 && !Number.isNaN(Number(envPortRaw));
const envPortNeedsValueFromArgs = Boolean(envPortRaw) && !envPortLooksNumeric;
let envPortValueCaptured = false;

const aliasMap = new Map([
  ['host', '--host'],
  ['remote', '--host'],
  ['--remote', '--host'],
  ['-H', '--host'],
  ['build', '--build'],
  ['-b', '--build'],
  ['preview', '--preview'],
  ['-p', '--preview'],
  ['--strictport', '--strictPort'],
  ['--strict-port', '--strictPort'],
  ['strictport', '--strictPort'],
  ['strict-port', '--strictPort']
]);

const helpFlags = new Set(['--help', '-h', 'help']);
const normalizedArgs = [];

for (const arg of rawArgs) {
  if (helpFlags.has(arg)) {
    console.log(
      `Usage: npm run run [--build|--preview|--host] [-- <extra vite args>]\n\n` +
        `Examples:\n` +
        `  npm run run              # local dev server\n` +
        `  npm run run --host       # hosted dev server\n` +
        `  npm run run -- --host    # hosted dev server (explicit separator)\n` +
        `  npm run run -- --build   # production build\n` +
        `  npm run run -- --preview # preview already-built output\n` +
        `  npm run run --port 5173  # dev server on a specific port (npm flag form)\n\n` +
        `Environment:\n` +
        `  RUN_GAME_HOST=true  # default to the hosted dev server\n`
    );
    process.exit(0);
  }

  if (envPortNeedsValueFromArgs && !envPortValueCaptured && !arg.startsWith('-')) {
    normalizedArgs.push('--port', arg);
    envPortValueCaptured = true;
    continue;
  }

  normalizedArgs.push(aliasMap.get(arg) ?? arg);
}

const parseNpmOriginalArgs = () => {
  const npmArgv = process.env.npm_config_argv;
  if (!npmArgv) {
    return [];
  }

  try {
    const parsed = JSON.parse(npmArgv);
    if (Array.isArray(parsed.original)) {
      return parsed.original;
    }
  } catch {
    // ignore malformed npm_config_argv
  }

  return [];
};

const npmOriginalArgs = parseNpmOriginalArgs();

const truthyEnvValues = new Set(['true', '1', 'yes']);
const npmBooleanFlagMap = new Map([
  ['npm_config_host', '--host'],
  ['npm_config_preview', '--preview'],
  ['npm_config_build', '--build'],
  ['npm_config_strictport', '--strictPort']
]);

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

const hasExplicitFlag = (flag) =>
  passthroughArgs.some((arg) => arg === flag || arg.startsWith(`${flag}=`));

const hasStrictPortFlag = hasExplicitFlag('--strictPort');
const hasPortFlag = hasExplicitFlag('--port');

const originalStrictPortRequested = npmOriginalArgs.some(
  (arg) =>
    arg === '--strictPort' ||
    arg === '--strictport' ||
    arg.startsWith('--strictPort=') ||
    arg.startsWith('--strictport=')
);

const getOriginalFlagValues = (flag) => {
  const values = [];
  for (let i = 0; i < npmOriginalArgs.length; i++) {
    const arg = npmOriginalArgs[i];
    if (arg === flag) {
      const value = npmOriginalArgs[i + 1];
      if (value && !value.startsWith('-')) {
        values.push(value);
      }
      i += 1;
    } else if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  }
  return values;
};

const originalPortValues = getOriginalFlagValues('--port');
const portValueFromOriginal = originalPortValues.at(-1);
const portValueFromEnv = process.env.npm_config_port;
const portValue = portValueFromOriginal ?? portValueFromEnv;

const passthroughWithoutStrayValues = [];
let portValueSkipped = false;
const shouldSkipPortValue = Boolean(!hasPortFlag && portValueFromOriginal);

for (const arg of passthroughArgs) {
  if (shouldSkipPortValue && !portValueSkipped && arg === portValueFromOriginal) {
    portValueSkipped = true;
    continue;
  }
  passthroughWithoutStrayValues.push(arg);
}

const passthroughExtras = [];

const wantsStrictPortFromEnv = truthyEnvValues.has(
  process.env.npm_config_strictport?.toLowerCase()
);

if (!hasStrictPortFlag && (originalStrictPortRequested || wantsStrictPortFromEnv)) {
  passthroughExtras.push('--strictPort');
}

if (!hasPortFlag && portValue) {
  passthroughExtras.push('--port', portValue);
}

const combinedPassthroughArgs = [...passthroughWithoutStrayValues, ...passthroughExtras];

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
if (combinedPassthroughArgs.length > 0) {
  npmArgs.push('--', ...combinedPassthroughArgs);
}

const extraArgsDisplay = combinedPassthroughArgs.length > 0
  ? ` (extra args: ${combinedPassthroughArgs.join(' ')})`
  : '';
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
