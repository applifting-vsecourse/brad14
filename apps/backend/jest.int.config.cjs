const { jest: baseConfig } = require("./package.json");

module.exports = {
  ...baseConfig,
  moduleFileExtensions: [...baseConfig.moduleFileExtensions, "tsx"],
  transform: { "^.+\\.(t|j)sx?$": "ts-jest" },
};
