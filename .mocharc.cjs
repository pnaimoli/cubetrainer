const config = {
  require: ['esm', 'ts-node/register'],
  extension: ['ts'],
  exit: true,
  'node-option': [
    'experimental-specifier-resolution=node',
    'loader=ts-node/esm', // needed for extensionless TS imports; causes ExperimentalWarning (ts-node bug)
    'disable-warning=ExperimentalWarning', // ts-node uses deprecated --loader API (nodejs/node#51048)
    'disable-warning=DeprecationWarning', // ts-node constructs fs.Stats directly (TypeStrong/ts-node#2116)
  ],
};

// Only set default spec if no files were passed on the CLI
const hasFileArgs = process.argv.slice(2).some(
  arg => !arg.startsWith('-') && (arg.endsWith('.ts') || arg.includes('*'))
);
if (!hasFileArgs) {
  config.spec = 'src/**/*.test.ts';
}

module.exports = config;
