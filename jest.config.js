// jest.config.js
// Only the pure-logic modules (engines, api, utils) are unit tested — no
// React Native components are rendered here, so plain ts-jest is enough
// and keeps this fast; no need for the heavier jest-expo/RN preset.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
};
