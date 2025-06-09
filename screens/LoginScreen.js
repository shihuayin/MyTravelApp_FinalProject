// screens/LoginScreen.js
import React, { useState, useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  Alert,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { MaterialIcons } from "@expo/vector-icons";
import { ThemeContext } from "../ThemeContext";

export default function LoginScreen({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // login logic with firebase auth
  const handleLogin = () => {
    //  input validation
    if (!email.trim() || !password) {
      Alert.alert("Input Error", "Please enter both email and password.");
      return;
    }
    // call the Firebase Auth sign-in API
    //signInWithEmailAndPassword comes from firebase/auth
    signInWithEmailAndPassword(auth, email.trim(), password)
      .then(() => {})
      //error handle
      .catch((error) => {
        console.log("Login Error: ", error.message);
        Alert.alert("Login Failed", error.message);
      });
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
            {/* title */}
            <Text style={styles.title}>Login</Text>
            <View style={styles.card}>
              {/* input email */}
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={theme.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {/* input password */}
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={theme.placeholder}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {/* login button */}
              <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <MaterialIcons
                  name="login"
                  size={24}
                  color={theme.buttonText}
                />
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>

              {/* register button */}
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => navigation.navigate("Register")}
              >
                <MaterialIcons
                  name="person-add"
                  size={24}
                  color={theme.buttonText}
                />
                <Text style={styles.buttonText}>Register</Text>
              </TouchableOpacity>
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
      fontSize: 32,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
      marginBottom: 30,
    },
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 25,
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
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
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    button: {
      flexDirection: "row",
      backgroundColor: theme.buttonBackground,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 15,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 15,
    },
    secondaryButton: {
      backgroundColor: theme.buttonBackground,
    },
    buttonText: {
      color: theme.buttonText,
      fontSize: 18,
      marginLeft: 10,
      fontWeight: "600",
    },
  });
