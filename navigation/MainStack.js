// navigation/MainStack.js
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { NavigationContainer } from "@react-navigation/native";
import AuthStack from "./AuthStack";
import { createStackNavigator } from "@react-navigation/stack";
import TripDetailScreen from "../screens/TripDetailScreen";
import CreateTripScreen from "../screens/CreateTripScreen";
import PackingListScreen from "../screens/PackingListScreen";
import ExpenseTrackerScreen from "../screens/ExpenseTrackerScreen";
import PhotoManagerScreen from "../screens/PhotoManagerScreen";
import TripListScreen from "../screens/TripListScreen";

const Stack = createStackNavigator();

export default function MainStack() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator>
          <Stack.Screen
            name="TripList"
            component={TripListScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TripDetailScreen"
            component={TripDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CreateTripScreen"
            component={CreateTripScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PackingListScreen"
            component={PackingListScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ExpenseTrackerScreen"
            component={ExpenseTrackerScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PhotoManagerScreen"
            component={PhotoManagerScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
