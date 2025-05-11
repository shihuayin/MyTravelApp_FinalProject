// jest-preset.js
const expoPreset = require("jest-expo/jest-preset");

module.exports = {
  ...expoPreset,

  // 把我们的 fix 文件插到 setupFiles 最前面
  setupFiles: [
    require.resolve("./jest.fix-self.js"),
    ...(expoPreset.setupFiles || []),
  ],
};
