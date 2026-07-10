const config = {
  require: ['esm', 'ts-node/register'],
  extension: ['ts'],
  exit: true,
  'node-option': [
    'experimental-specifier-resolution=node',
    'loader=ts-node/esm',
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
