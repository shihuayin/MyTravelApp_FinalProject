// **在任何 import 之前** mock 所有依赖
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { MaterialIcons: (props) => React.createElement(View, props) };
});
jest.mock("firebase/firestore", () => {
  const original = jest.requireActual("firebase/firestore");
  return {
    __esModule: true,
    ...original,
    collection: jest.fn(),
    query: jest.fn(),
    orderBy: jest.fn(),
    onSnapshot: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    addDoc: jest.fn(),
  };
});
jest.mock("firebase/storage", () => ({
  __esModule: true,
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));
jest.mock("../../firebase", () => ({
  auth: { currentUser: { uid: "mockUid" } },
  db: {},
  storage: {},
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}));
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  digestStringAsync: jest.fn(() => "hash123"),
}));
jest.mock("expo-file-system", () => ({
  cacheDirectory: "/cache/",
  downloadAsync: jest.fn(),
}));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn() }));

// 之后再导入 React 及被测组件
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import PhotoManagerScreen from "../PhotoManagerScreen";
import { ThemeContext } from "../../ThemeContext";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { onSnapshot } from "firebase/firestore";

const theme = {
  background: "#fff",
  text: "#000",
  cardBackground: "#eee",
  borderColor: "#ccc",
  buttonBackground: "#000",
  buttonText: "#fff",
  placeholder: "#888",
};

beforeEach(() => {
  jest.clearAllMocks();
});

// 构造一个可 forEach 的“快照”对象
function makeSnapshot(arr) {
  const docs = arr.map((d) => ({ id: d.id, data: () => d }));
  return {
    forEach(cb) {
      docs.forEach(cb);
    },
  };
}

describe("PhotoManagerScreen", () => {
  const renderScreen = () =>
    render(
      <ThemeContext.Provider value={{ theme }}>
        <PhotoManagerScreen route={{ params: { tripId: "trip1" } }} />
      </ThemeContext.Provider>
    );

  it("renders empty hint when there are no photos", async () => {
    onSnapshot.mockImplementationOnce((_, cb) => {
      cb(makeSnapshot([]));
      return () => {};
    });
    const { getByText } = renderScreen();
    await waitFor(() =>
      expect(
        getByText(/No photos yet\. Tap "Add Photo" below to upload\./i)
      ).toBeTruthy()
    );
  });

  it("renders a grid of photos when snapshot provides images", async () => {
    const photos = [
      { id: "a1", imageUrl: "https://ex/1.jpg", timestamp: 1 },
      { id: "b2", imageUrl: "https://ex/2.jpg", timestamp: 2 },
      { id: "c3", imageUrl: "https://ex/3.jpg", timestamp: 3 },
      { id: "d4", imageUrl: "https://ex/4.jpg", timestamp: 4 },
    ];
    onSnapshot.mockImplementationOnce((_, cb) => {
      cb(makeSnapshot(photos));
      return () => {};
    });

    const { getAllByTestId } = renderScreen();
    const items = await waitFor(() => getAllByTestId("photo-item"));
    expect(items.length).toBe(4);
  });

  it("pressing Add Photo calls launchImageLibraryAsync", async () => {
    onSnapshot.mockImplementationOnce((_, cb) => {
      cb(makeSnapshot([]));
      return () => {};
    });
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "/tmp/foo.jpg" }],
    });
    ImageManipulator.manipulateAsync.mockResolvedValue({ uri: "/tmp/foo.jpg" });

    const { getByText } = renderScreen();
    const btn = await waitFor(() => getByText("Add Photo"));
    fireEvent.press(btn);

    await waitFor(() =>
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled()
    );
  });

  it("opens modal with Photo Details when tapping a photo", async () => {
    const photos = [{ id: "x1", imageUrl: "https://ex/x.jpg", timestamp: 1 }];
    onSnapshot.mockImplementationOnce((_, cb) => {
      cb(makeSnapshot(photos));
      return () => {};
    });

    const { getAllByTestId, getByText } = renderScreen();
    const imgItems = await waitFor(() => getAllByTestId("photo-item"));
    fireEvent.press(imgItems[0]);
    await waitFor(() => expect(getByText("Photo Details")).toBeTruthy());
  });
});
