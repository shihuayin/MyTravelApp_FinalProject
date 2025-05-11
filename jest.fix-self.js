// jest.fix-self.js
/**
 * 这个文件什么都不做，只确保 global.self 存在。
 * 之所以写成函数体外一行，是因为 setupFiles 在每个
 * 测试环境初始化时都会重新执行一次。
 */
if (typeof global.self === "undefined") {
  global.self = {};
}
