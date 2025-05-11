import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import RegisterScreen from "../RegisterScreen";
import { ThemeContext } from "../../ThemeContext";

/* ---------- mocks ---------- */
const mockGoBack = jest.fn();
const mockNavigation = { goBack: mockGoBack };

const mockCreateUser = jest.fn(() => Promise.resolve());
jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: (...args) =>
    require("jest-mock")
      .fn()
      .mockImplementation(() => mockCreateUser(...args))(),
}));
jest.mock("../../firebase", () => ({ auth: {} }));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { MaterialIcons: (props) => <View {...props} /> };
});
/* ---------- theme ---------- */
const theme = {
  background: "#fff",
  text: "#000",
  buttonText: "#000",
  cardBackground: "#eee",
  borderColor: "#ccc",
  buttonBackground: "#888",
};
/* ---------- helper ---------- */
const renderScreen = () =>
  render(
    <ThemeContext.Provider value={{ theme }}>
      <RegisterScreen navigation={mockNavigation} />
    </ThemeContext.Provider>
  );
/* ---------- tests ---------- */
describe("RegisterScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows alert if fields are empty", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getAllByText } = renderScreen();

    fireEvent.press(getAllByText("Register")[1]); // 点击按钮而非标题
    expect(alertSpy).toHaveBeenCalledWith(
      "Input Error",
      "Please fill in all fields."
    );
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("shows alert when passwords do not match", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByPlaceholderText, getAllByText } = renderScreen();

    fireEvent.changeText(getByPlaceholderText("Email"), "abc@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "123456");
    fireEvent.changeText(getByPlaceholderText("Confirm Password"), "654321");
    fireEvent.press(getAllByText("Register")[1]);

    expect(alertSpy).toHaveBeenCalledWith(
      "Password Mismatch",
      "Passwords do not match."
    );
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("calls createUserWithEmailAndPassword on valid input", async () => {
    const { getByPlaceholderText, getAllByText } = renderScreen();

    fireEvent.changeText(getByPlaceholderText("Email"), "user@test.com ");
    fireEvent.changeText(getByPlaceholderText("Password"), "mypassword");
    fireEvent.changeText(
      getByPlaceholderText("Confirm Password"),
      "mypassword"
    );
    fireEvent.press(getAllByText("Register")[1]);

    await waitFor(() =>
      expect(mockCreateUser).toHaveBeenCalledWith(
        {}, // mocked auth object
        "user@test.com",
        "mypassword"
      )
    );
  });

  it("navigates back when 'Back to Login' is pressed", () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText("Back to Login"));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
