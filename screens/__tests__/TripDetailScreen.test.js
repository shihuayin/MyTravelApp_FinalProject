import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import TripDetailScreen from "../TripDetailScreen";
import { ThemeContext } from "../../ThemeContext";

jest.setTimeout(10000);

const mockGetDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock("../../firebase", () => ({
  auth: { currentUser: { uid: "mockUid" } },
  db: {},
}));

jest.mock("firebase/firestore", () => {
  const original = jest.requireActual("firebase/firestore");
  return {
    __esModule: true,
    ...original,
    doc: jest.fn(() => ({})),
    getDoc: (...args) => mockGetDoc(...args),
    collection: jest.fn(() => ({})),
    onSnapshot: (...args) => mockOnSnapshot(...args),
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MaterialIcons = ({ name, ...rest }) =>
    React.createElement(View, { accessibilityLabel: name, ...rest });
  return { MaterialIcons };
});

const makeDocSnap = (data) => ({
  exists: () => true,
  id: "trip1",
  data: () => data,
});

const makeSnapshot = (arr) => ({
  docs: arr.map((v) => ({ data: () => v })),
  forEach: (fn) => arr.forEach((v) => fn({ data: () => v })),
});

const queueSnapshots = (packing, expenses, photos) => {
  mockOnSnapshot
    .mockImplementationOnce((_, cb) => {
      cb(makeSnapshot(packing));
      return () => {};
    })
    .mockImplementationOnce((_, cb) => {
      cb(makeSnapshot(expenses));
      return () => {};
    })
    .mockImplementationOnce((_, cb) => {
      cb(makeSnapshot(photos));
      return () => {};
    });
};

const theme = {
  placeholder: "#888",
  buttonBackground: "#000",
  buttonText: "#fff",
};

let navigateSpy;
beforeEach(() => {
  jest.clearAllMocks();
  navigateSpy = jest.fn();
});

const renderScreen = () =>
  render(
    <ThemeContext.Provider value={{ theme }}>
      <TripDetailScreen
        route={{ params: { tripId: "trip1" } }}
        navigation={{ navigate: navigateSpy }}
      />
    </ThemeContext.Provider>
  );

describe("TripDetailScreen", () => {
  it.each`
    unchecked | expected
    ${1}      | ${/1 item not checked/i}
    ${3}      | ${/3 items not checked/i}
  `(
    "shows packing summary when $unchecked unchecked",
    async ({ unchecked, expected }) => {
      mockGetDoc.mockResolvedValue(
        makeDocSnap({ destination: "Tokyo", budget: 100 })
      );

      queueSnapshots(
        // packingList 文档：unchecked 个 false + 1 个 true
        [...Array(unchecked).fill({ checked: false }), { checked: true }],
        [], // no expenses
        [] // no photos
      );

      const { getByText } = renderScreen();

      await waitFor(() => expect(getByText(expected)).toBeTruthy());
    }
  );

  it("applies over-budget style when expense > budget", async () => {
    mockGetDoc.mockResolvedValue(
      makeDocSnap({ destination: "Paris", budget: 100 })
    );

    queueSnapshots(
      [], // no packingList
      [{ amount: 150 }], // expense = 150
      [] // no photos
    );

    const { getByText } = renderScreen();
    await waitFor(() => getByText("Expenses"));
    const node = await waitFor(() => getByText("150% of budget"));
    const stylesArr = node.props.style;
    expect(stylesArr.find((s) => s.fontWeight === "700")).toBeTruthy();
  });

  it("navigates when cards pressed", async () => {
    mockGetDoc.mockResolvedValue(
      makeDocSnap({ destination: "London", budget: 50 })
    );

    queueSnapshots(
      [{ checked: false }], // 1 unchecked
      [{ amount: 10 }], // some expense
      [] // no photos
    );

    const { getByText } = renderScreen();
    await waitFor(() => getByText("Packing List"));

    fireEvent.press(getByText("Packing List"));
    expect(navigateSpy).toHaveBeenCalledWith("PackingListScreen", {
      tripId: "trip1",
    });

    fireEvent.press(getByText("Expenses"));
    expect(navigateSpy).toHaveBeenCalledWith("ExpenseTrackerScreen", {
      tripId: "trip1",
      budget: 50,
    });
  });
});
