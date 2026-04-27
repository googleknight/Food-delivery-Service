import type { Config } from "jest";

const commonConfig = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@modules/(.*)$": "<rootDir>/src/modules/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@types$": "<rootDir>/src/types",
    "^@constants/(.*)$": "<rootDir>/src/constants/$1",
    "^@config$": "<rootDir>/src/config/index",
    "^@config/(.*)$": "<rootDir>/src/config/$1",
    "^@middleware/(.*)$": "<rootDir>/src/middleware/$1",
  },
};

const config: Config = {
  verbose: true,
  globalSetup: "<rootDir>/tests/setup.ts",
  globalTeardown: "<rootDir>/tests/teardown.ts",
  projects: [
    {
      ...commonConfig,
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
    },
    {
      ...commonConfig,
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      testTimeout: 30000,
    },
  ],
  forceExit: true,
  detectOpenHandles: true,
};

export default config;
