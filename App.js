// App.js

import MainStack from "./navigation/MainStack";
import { ThemeProvider } from "./ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <MainStack />
    </ThemeProvider>
  );
}
