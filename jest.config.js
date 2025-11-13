/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ["**/src/**/*.test.ts"],
  transform: {
    '^.+\.ts$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};