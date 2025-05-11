const mockCollection = jest.fn();
const mockAddDoc = jest.fn(() => Promise.resolve({ id: "newTripId" }));

jest.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: (...args) => {
    mockCollection(...args);
    return {};
  },
  addDoc: (...args) => mockAddDoc(...args),
}));

jest.mock("../../firebase", () => ({
  auth: { currentUser: { uid: "mockUid" } },
  db: {},
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { MaterialIcons: (props) => React.createElement(View, props) };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("firebase/auth");
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import CreateTripScreen from "../CreateTripScreen";
import { ThemeContext } from "../../ThemeContext";

describe("Create Trip", () => {
  const mockTheme = {
    placeholder: "#888",
    buttonBackground: "#000",
    buttonText: "#fff",
  };

  beforeEach(() => {
    mockCollection.mockClear();
    mockAddDoc.mockClear();
  });

  it("does nothing when destination or budget is empty", () => {
    const goBack = jest.fn();
    const { getByText } = render(
      <ThemeContext.Provider value={{ theme: mockTheme }}>
        <CreateTripScreen navigation={{ goBack }} />
      </ThemeContext.Provider>
    );

    fireEvent.press(getByText("Create"));

    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
  });

  it("calls addDoc and goes back on valid input", async () => {
    const goBack = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <ThemeContext.Provider value={{ theme: mockTheme }}>
        <CreateTripScreen navigation={{ goBack }} />
      </ThemeContext.Provider>
    );

    fireEvent.changeText(getByPlaceholderText("Destination"), "Tokyo");
    fireEvent.changeText(getByPlaceholderText("Budget"), "2500");
    fireEvent.press(getByText("Create"));

    await waitFor(() => {
      expect(mockCollection).toHaveBeenCalledWith(
        expect.any(Object),
        "users",
        "mockUid",
        "trips"
      );
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          destination: "Tokyo",
          budget: 2500,
        })
      );
      expect(goBack).toHaveBeenCalled();
    });
  });
});
