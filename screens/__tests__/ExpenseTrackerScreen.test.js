import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { ThemeContext } from "../../ThemeContext";

const mockDocRef = {};
const mockGetDoc = jest.fn(() =>
  Promise.resolve({ exists: () => false, data: () => ({ amount: 0 }) })
);
const mockSetDoc = jest.fn(() => Promise.resolve());

jest.mock("firebase/firestore", () => ({
  __esModule: true,
  doc: (...args) => mockDocRef,
  getDoc: undefined,
  setDoc: undefined,
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: (q, successCallback) => {
    successCallback({ forEach: () => {} });
    return () => {};
  },
}));

jest.mock("../../firebase", () => ({
  auth: { currentUser: { uid: "trip1" } },
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

let ExpenseTrackerScreen;
beforeAll(() => {
  // Patch getDoc and setDoc onto the mocked module
  const firestore = require("firebase/firestore");
  firestore.getDoc = mockGetDoc;
  firestore.setDoc = mockSetDoc;

  // Now import the component under test
  ExpenseTrackerScreen = require("../ExpenseTrackerScreen").default;
});

// ─── Tests ───
describe("ExpenseTrackerScreen", () => {
  const mockTheme = {
    placeholder: "#888",
    buttonBackground: "#000",
    buttonText: "#fff",
  };

  const renderWithProps = () =>
    render(
      <ThemeContext.Provider value={{ theme: mockTheme }}>
        <ExpenseTrackerScreen
          route={{ params: { tripId: "trip1", budget: 100 } }}
        />
      </ThemeContext.Provider>
    );

  it("alerts when amount is empty", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByText } = renderWithProps();
    fireEvent.press(getByText("Add Expense"));
    expect(alertSpy).toHaveBeenCalledWith(
      "Input Required",
      "Please enter an amount."
    );
    alertSpy.mockRestore();
  });

  it("alerts when amount is invalid", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByText, getByPlaceholderText } = renderWithProps();
    fireEvent.changeText(getByPlaceholderText("Amount"), "abc");
    fireEvent.press(getByText("Add Expense"));
    expect(alertSpy).toHaveBeenCalledWith(
      "Invalid Amount",
      "Please enter a valid positive number."
    );
    alertSpy.mockRestore();
  });

  it("adds expense on valid input", async () => {
    const { getByText, getByPlaceholderText } = renderWithProps();
    fireEvent.changeText(getByPlaceholderText("Amount"), "50");
    fireEvent.press(getByText("Add Expense"));

    await waitFor(() => {
      expect(mockGetDoc).toHaveBeenCalledWith(mockDocRef);
      expect(mockSetDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({ amount: 50, timestamp: expect.any(Number) })
      );
      expect(getByPlaceholderText("Amount").props.value).toBe("");
    });
  });
});
