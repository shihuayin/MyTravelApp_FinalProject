/** jest.config.js */
module.exports = {
  preset: "jest-expo",
  testEnvironment: "jsdom",
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|@expo|expo.*)",
  ],
  moduleNameMapper: {
    "^react-native/Libraries/Image/Image$":
      "react-native/Libraries/Image/Image.native",
    "\\.(jpg|jpeg|png|svg)$": "<rootDir>/__mocks__/fileMock.js",
  },
  setupFiles: ["<rootDir>/jest.fix-self.js"],
};
