// screens/__tests__/TripListScreen.test.js
import React from "react";
// 让 InteractionManager 立即执行回调，避免 setImmediate 未定义的问题
jest.mock("react-native/Libraries/Interaction/InteractionManager", () => ({
  runAfterInteractions: (cb) => cb(),
}));

import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import TripListScreen from "../TripListScreen";
import { ThemeContext } from "../../ThemeContext";

// mock navigation prop
const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate };

// mock firebase/auth
jest.mock("firebase/auth", () => ({
  signOut: jest.fn(),
}));

// mock ../firebase
jest.mock("../../firebase", () => ({
  auth: { currentUser: { uid: "user1" } },
  db: {},
}));

// mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { MaterialIcons: (props) => <View {...props} /> };
});

// mock firestore
const mockOnSnapshot = jest.fn();
jest.mock("firebase/firestore", () => ({
  collection: () => ({}),
  query: () => ({}),
  orderBy: () => ({}),
  onSnapshot: (q, cb) => mockOnSnapshot(q, cb),
  doc: () => ({}),
  deleteDoc: () => Promise.resolve(),
}));

describe("TripListScreen", () => {
  const theme = {
    background: "#fff",
    text: "#000",
    buttonText: "#000",
    cardBackground: "#eee",
    borderColor: "#ccc",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows empty state when there are no trips", () => {
    // 第一轮 onSnapshot trips：空列表
    mockOnSnapshot.mockImplementationOnce((_, cb) => {
      cb({ forEach() {} });
      return () => {};
    });

    render(
      <ThemeContext.Provider value={{ theme }}>
        <TripListScreen navigation={mockNavigation} />
      </ThemeContext.Provider>
    );

    expect(screen.getByText("No trips found.")).toBeTruthy();
  });

  it("renders a grid of trips and navigates on press", async () => {
    const tripsData = [
      { id: "t1", destination: "Paris", createdAt: 1 },
      { id: "t2", destination: "Tokyo", createdAt: 2 },
    ];

    // 1) trips snapshot
    mockOnSnapshot
      .mockImplementationOnce((_, cb) => {
        cb({
          forEach(fn) {
            tripsData.forEach((d) =>
              fn({
                id: d.id,
                data: () => ({
                  destination: d.destination,
                  createdAt: d.createdAt,
                }),
              })
            );
          },
        });
        return () => {};
      })
      // 2)&3) photos snapshot（stub 为空）
      .mockImplementationOnce((_, cb) => {
        cb({ docs: [] });
        return () => {};
      })
      .mockImplementationOnce((_, cb) => {
        cb({ docs: [] });
        return () => {};
      });

    render(
      <ThemeContext.Provider value={{ theme }}>
        <TripListScreen navigation={mockNavigation} />
      </ThemeContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Paris")).toBeTruthy();
      expect(screen.getByText("Tokyo")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Paris"));
    expect(mockNavigate).toHaveBeenCalledWith("TripDetailScreen", {
      tripId: "t1",
    });
  });

  it("navigates to CreateTripScreen when floating button is pressed", () => {
    // stub trips empty
    mockOnSnapshot.mockImplementationOnce((_, cb) => {
      cb({ forEach() {} });
      return () => {};
    });

    render(
      <ThemeContext.Provider value={{ theme }}>
        <TripListScreen navigation={mockNavigation} />
      </ThemeContext.Provider>
    );

    fireEvent.press(screen.getByLabelText("add"));
    expect(mockNavigate).toHaveBeenCalledWith("CreateTripScreen");
  });

  it("asks for confirmation when long-pressing a trip", async () => {
    const tripsData = [{ id: "t1", destination: "Berlin", createdAt: 3 }];

    mockOnSnapshot
      .mockImplementationOnce((_, cb) => {
        cb({
          forEach(fn) {
            tripsData.forEach((d) =>
              fn({
                id: d.id,
                data: () => ({
                  destination: d.destination,
                  createdAt: d.createdAt,
                }),
              })
            );
          },
        });
        return () => {};
      })
      // photos stub
      .mockImplementationOnce((_, cb) => {
        cb({ docs: [] });
        return () => {};
      });

    const alertSpy = jest.spyOn(Alert, "alert");

    render(
      <ThemeContext.Provider value={{ theme }}>
        <TripListScreen navigation={mockNavigation} />
      </ThemeContext.Provider>
    );

    await waitFor(() => expect(screen.getByText("Berlin")).toBeTruthy());

    fireEvent(screen.getByText("Berlin"), "onLongPress");
    expect(alertSpy).toHaveBeenCalledWith(
      "Confirm Deletion",
      expect.stringContaining("delete this trip"),
      expect.any(Array)
    );
  });
});
