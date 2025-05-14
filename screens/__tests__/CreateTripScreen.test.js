import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import CreateTripScreen from "../CreateTripScreen";
import { ThemeContext } from "../../ThemeContext";

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

describe("CreateTripScreen", () => {
  const defaultTheme = {
    placeholder: "#888",
    buttonBackground: "#000",
    buttonText: "#fff",
  };

  const renderScreen = (goBackMock = jest.fn()) => {
    const utils = render(
      <ThemeContext.Provider value={{ theme: defaultTheme }}>
        <CreateTripScreen navigation={{ goBack: goBackMock }} />
      </ThemeContext.Provider>
    );
    return { ...utils, goBackMock };
  };

  beforeEach(() => {
    mockCollection.mockClear();
    mockAddDoc.mockClear();
  });

  it("alerts when destination or budget is empty and does not write or navigate", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByText, goBackMock } = renderScreen();

    // Attempt to create with empty inputs
    fireEvent.press(getByText("Create"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Input Error",
      "Please fill in both destination and budget."
    );
    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(goBackMock).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("calls addDoc and goes back on valid input", async () => {
    const { getByPlaceholderText, getByText, goBackMock } = renderScreen();

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
      expect(goBackMock).toHaveBeenCalled();
    });
  });
});
