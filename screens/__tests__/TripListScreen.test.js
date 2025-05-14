// screens/__tests__/TripListScreen.test.js

import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import TripListScreen from "../TripListScreen";
import { ThemeContext } from "../../ThemeContext";

// Make InteractionManager run callbacks immediately to avoid setImmediate issues
jest.mock("react-native/Libraries/Interaction/InteractionManager", () => ({
  runAfterInteractions: (cb) => cb(),
}));

// Navigation mock
const navigate = jest.fn();
const navigation = { navigate };

// Firebase auth mock
jest.mock("firebase/auth", () => ({ signOut: jest.fn() }));

// Firebase app mock (auth & db placeholders)
jest.mock("../../firebase", () => ({
  auth: { currentUser: { uid: "user1" } },
  db: {},
}));

// Replace @expo/vector-icons with a harmless <View>
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { MaterialIcons: (props) => <View {...props} /> };
});

// ---------------------------------------------------------------------------
// Firestore mock — prefix variable with "mock" so we can reference it inside factory
const mockOnSnapshot = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  doc: jest.fn(),
  deleteDoc: jest.fn(() => Promise.resolve()),
}));

// Provide a sensible default so *any* unexpected onSnapshot still works
mockOnSnapshot.mockImplementation((_, cb) => {
  cb({
    docs: [],
    forEach: () => {},
  });
  return () => {};
});

// ---------------------------------------------------------------------------
// Theme used by provider
const theme = {
  background: "#fff",
  text: "#000",
  buttonText: "#000",
  cardBackground: "#eee",
  borderColor: "#ccc",
};

/**
 * Helper: render the screen wrapped in ThemeContext.
 */
function renderScreen() {
  return render(
    <ThemeContext.Provider value={{ theme }}>
      <TripListScreen navigation={navigation} />
    </ThemeContext.Provider>
  );
}

/**
 * Helper: queue Firestore mocks — first for trips, then one for each photos sub‑collection.
 * @param {Array<{id:string,destination:string,createdAt:number}>} trips
 */
function mockTrips(trips = []) {
  // Reset previous behaviour and counts
  mockOnSnapshot.mockReset();

  // Flag so we send the trips data only once (first time onSnapshot is invoked)
  let tripsSent = false;

  mockOnSnapshot.mockImplementation((_, cb) => {
    if (!tripsSent) {
      tripsSent = true;
      cb({
        forEach(fn) {
          trips.forEach(({ id, destination, createdAt }) =>
            fn({ id, data: () => ({ destination, createdAt }) })
          );
        },
      });
    } else {
      // photos (or any other) snapshot – return empty list with required fields
      cb({
        docs: [],
        forEach: () => {},
      });
    }
    return () => {};
  });
}

// ---------------------------------------------------------------------------

describe("TripListScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ① 当没有行程时应显示空状态文本
  it("shows empty state when there are no trips", () => {
    mockTrips();
    renderScreen();

    expect(screen.getByText(/no trips found/i)).toBeTruthy();
  });

  // ② 渲染行程网格并在点击目的地卡片时导航到详情页
  it("renders a grid of trips and navigates on press", async () => {
    mockTrips([
      { id: "t1", destination: "Paris", createdAt: 1 },
      { id: "t2", destination: "Tokyo", createdAt: 2 },
    ]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Paris")).toBeTruthy();
      expect(screen.getByText("Tokyo")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Paris"));
    expect(navigate).toHaveBeenCalledWith("TripDetailScreen", { tripId: "t1" });
  });

  // ③ 点击浮动“add”按钮应导航到创建行程页面
  it("navigates to CreateTripScreen when floating button is pressed", () => {
    mockTrips();
    renderScreen();

    fireEvent.press(screen.getByLabelText("add"));
    expect(navigate).toHaveBeenCalledWith("CreateTripScreen");
  });

  // ④ 长按行程卡片应弹出删除确认对话框
  it("asks for confirmation when long-pressing a trip", async () => {
    mockTrips([{ id: "t1", destination: "Berlin", createdAt: 3 }]);
    const alertSpy = jest.spyOn(Alert, "alert");

    renderScreen();

    await waitFor(() => expect(screen.getByText("Berlin")).toBeTruthy());

    fireEvent(screen.getByText("Berlin"), "onLongPress");
    expect(alertSpy).toHaveBeenCalledWith(
      "Confirm Deletion",
      expect.stringContaining("delete this trip"),
      expect.any(Array)
    );
  });
});
