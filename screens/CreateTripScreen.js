// screens/CreateTripScreen.js

import React, { useState, useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { auth, db } from "../firebase";
import { addDoc, collection } from "firebase/firestore";
import { ThemeContext } from "../ThemeContext";
import { Alert } from "react-native";

// create a new trip entry
export default function CreateTripScreen({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [destination, setDestination] = useState(""); // destination
  const [budget, setBudget] = useState(""); // budget

  // store to Firestore
  const handleCreate = async () => {
    if (!destination.trim() || !budget.trim()) {
      Alert.alert("Input Error", "Please fill in both destination and budget.");
      return;
    }

    // add trip to the Firestore "trips"
    await addDoc(collection(db, "users", auth.currentUser.uid, "trips"), {
      destination: destination.trim(),
      budget: parseFloat(budget),
      createdAt: new Date(),
    });

    // back to the previous screen
    navigation.goBack();
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.innerContainer}>
            <Text style={styles.title}>Create New Trip</Text>
            <View style={styles.card}>
              {/* input trip destination */}
              <TextInput
                placeholder="Destination"
                placeholderTextColor={theme.placeholder}
                style={styles.input}
                value={destination}
                onChangeText={setDestination}
              />
              {/* input trip budget */}
              <TextInput
                placeholder="Budget"
                placeholderTextColor={theme.placeholder}
                style={styles.input}
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
              />
              {/* submit button */}
              <View style={styles.buttonContainer}>
                <Button
                  title="Create"
                  onPress={handleCreate}
                  color={theme.buttonBackground}
                />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
    },
    innerContainer: {
      flex: 1,
      padding: 20,
      justifyContent: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
      marginBottom: 20,
    },
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 10,
      padding: 20,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    input: {
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    buttonContainer: {
      borderRadius: 8,
      overflow: "hidden",
    },
  });
