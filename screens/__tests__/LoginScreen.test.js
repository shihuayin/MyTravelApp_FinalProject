import React from "react";
import { View, Alert } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import LoginScreen from "../LoginScreen";
import { ThemeContext } from "../../ThemeContext";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { MaterialIcons: (props) => React.createElement(View, props) };
});

jest.mock("../../firebase", () => ({ auth: {} }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("firebase/auth");
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

describe("Sign-in", () => {
  const mockTheme = {
    placeholder: "#888",
    buttonBackground: "#000",
    buttonText: "#fff",
  };

  const WrappedLogin = () => (
    <ThemeContext.Provider value={{ theme: mockTheme }}>
      <LoginScreen />
    </ThemeContext.Provider>
  );

  it("alerts when email or password is empty", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const { getByPlaceholderText, getAllByText } = render(<WrappedLogin />);
    fireEvent.changeText(getByPlaceholderText("Email"), "");
    fireEvent.changeText(getByPlaceholderText("Password"), "");

    const [, loginBtn] = getAllByText("Login");
    fireEvent.press(loginBtn);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it("calls Firebase signInWithEmailAndPassword on valid input", () => {
    const { getByPlaceholderText, getAllByText } = render(<WrappedLogin />);
    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "mypassword");

    const [, loginBtn] = getAllByText("Login");
    fireEvent.press(loginBtn);

    const { signInWithEmailAndPassword } = require("firebase/auth");
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "test@example.com",
      "mypassword"
    );
  });
});
