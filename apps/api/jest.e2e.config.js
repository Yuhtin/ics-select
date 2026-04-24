module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@ics-select/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@ics-select/prisma$': '<rootDir>/../../packages/prisma/generated/client/index.js',
  },
  testEnvironment: 'node',
};
