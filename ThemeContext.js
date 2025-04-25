// ThemeContext.js
import React, { createContext, useState, useEffect } from "react";
import { Appearance } from "react-native";

export const ThemeContext = createContext();

const lightTheme = {
  background: "#FFFFFF",
  text: "#2E2E2E",
  cardBackground: "#F7F7F7",
  borderColor: "#E0E0E0",
  iconColor: "#2E2E2E",
  buttonBackground: "#2E2E2E",
  buttonText: "#FFFFFF",
  placeholder: "#757575",
};

const darkTheme = {
  background: "#1F1F1F",
  text: "#E2E2E2",
  cardBackground: "#2C2C2C",
  borderColor: "#3A3A3A",
  iconColor: "#E2E2E2",
  buttonBackground: "#2E2E2E",
  buttonText: "#FFFFFF",
  placeholder: "#A6A6A6",
};

export const ThemeProvider = ({ children }) => {
  const colorScheme = Appearance.getColorScheme();
  const [theme, setTheme] = useState(
    colorScheme === "dark" ? darkTheme : lightTheme
  );

  const toggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === lightTheme ? darkTheme : lightTheme
    );
  };

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setTheme(colorScheme === "dark" ? darkTheme : lightTheme);
    });
    return () => subscription.remove();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
