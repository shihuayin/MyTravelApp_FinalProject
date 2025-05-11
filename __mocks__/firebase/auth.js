export const signInWithEmailAndPassword = jest.fn(() =>
  Promise.resolve({ user: { uid: "123" } })
);
export const createUserWithEmailAndPassword = jest.fn(() =>
  Promise.resolve({ user: { uid: "123" } })
);
export const onAuthStateChanged = jest.fn((auth, cb) => {
  cb(null); // 默认“未登录”，后面可改
  return () => {}; // mock unsubscribe
});

// 真实代码里你还 import 了 auth 对象，这里给个假对象
export const auth = {};
