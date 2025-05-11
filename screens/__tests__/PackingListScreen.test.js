beforeAll(() => {
  global.setImmediate ||= (cb) => cb();
});

const mockCollection = jest.fn();
const mockAddDoc = jest.fn(() => Promise.resolve());
const mockOnSnapshot = jest.fn((_ref, cb) => {
  cb({
    forEach: (iter) => {
      iter({
        id: "x",
        data: () => ({ name: "X", quantity: 2, checked: false }),
      });
      iter({
        id: "y",
        data: () => ({ name: "Y", quantity: 3, checked: true }),
      });
    },
  });
  return () => {};
});
const mockDocRef = {};
const mockUpdateDoc = jest.fn(() => Promise.resolve());
const mockDeleteDoc = jest.fn(() => Promise.resolve());

jest.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: (...a) => {
    mockCollection(...a);
    return {};
  },
  addDoc: (...a) => mockAddDoc(...a),
  onSnapshot: (...a) => mockOnSnapshot(...a),
  doc: (...a) => mockDocRef,
  updateDoc: (...a) => mockUpdateDoc(...a),
  deleteDoc: (...a) => mockDeleteDoc(...a),
}));

jest.mock("../../firebase", () => ({
  auth: { currentUser: { uid: "mockUid" } },
  db: {},
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MaterialIcons = ({ name, ...rest }) =>
    React.createElement(View, { accessibilityLabel: name, ...rest });
  return { MaterialIcons };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("firebase/auth");

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert, TouchableOpacity, TextInput } from "react-native";
import { ThemeContext } from "../../ThemeContext";
import PackingListScreen from "../PackingListScreen";

describe("PackingListScreen", () => {
  const mockTheme = {
    placeholder: "#888",
    buttonBackground: "#000",
    buttonText: "#fff",
  };

  const renderWithProvider = () =>
    render(
      <ThemeContext.Provider value={{ theme: mockTheme }}>
        <PackingListScreen route={{ params: { tripId: "trip1" } }} />
      </ThemeContext.Provider>
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("alerts when name is empty", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByText } = renderWithProvider();

    fireEvent.press(getByText("Add"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Input Error",
      "Please enter the item name."
    );
    alertSpy.mockRestore();
  });

  it("adds item on valid input", async () => {
    const { getByPlaceholderText, getByText } = renderWithProvider();

    fireEvent.changeText(getByPlaceholderText("Item Name"), "Bag");
    fireEvent.press(getByText("Add"));

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ name: "Bag", quantity: 1, checked: false })
      );
      expect(getByPlaceholderText("Item Name").props.value).toBe("");
    });
  });

  it("toggles checked state when checkbox pressed", async () => {
    const { getByLabelText } = renderWithProvider();

    const checkbox = await waitFor(() =>
      getByLabelText("check-box-outline-blank")
    );
    fireEvent.press(checkbox);

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, { checked: true });
  });

  it("deletes item when delete pressed and confirmed", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns) => btns[1].onPress());

    const { getAllByLabelText } = renderWithProvider();

    const delIcon = await waitFor(() => getAllByLabelText("delete")[0]);
    fireEvent.press(delIcon);

    expect(mockDeleteDoc).toHaveBeenCalledWith(mockDocRef);
    alertSpy.mockRestore();
  });
});
