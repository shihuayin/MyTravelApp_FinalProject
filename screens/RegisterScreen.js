// screens/RegisterScreen.js
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
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { MaterialIcons } from "@expo/vector-icons";
import { ThemeContext } from "../ThemeContext";

export default function RegisterScreen({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // handle regist logic with firebase Auth
  const handleRegister = () => {
    // input validation, all fields been filled
    if (!email.trim() || !password || !confirmPassword) {
      Alert.alert("Input Error", "Please fill in all fields.");
      return;
    }
    // Validate password, check if password === confirmpassword
    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch");
      return;
    }

    // create user account with firebase auth
    // createUserWithEmailAndPassword comes from firebase/auth
    createUserWithEmailAndPassword(auth, email.trim(), password)
      .then(() => {})
      .catch((error) => {
        console.log("Registration Error: ", error.message);
        Alert.alert("Registration Failed", error.message);
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
            <Text style={styles.title}>Register</Text>
            <View style={styles.card}>
              {/* input, email */}
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
              {/* password again, confirm */}
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={theme.placeholder}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              {/* register button */}
              <TouchableOpacity style={styles.button} onPress={handleRegister}>
                <MaterialIcons
                  name="person-add"
                  size={24}
                  color={theme.buttonText}
                />
                <Text style={styles.buttonText}>Register</Text>
              </TouchableOpacity>
              {/* back to login page */}
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => navigation.goBack()}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={theme.buttonText}
                />
                <Text style={styles.buttonText}>Back to Login</Text>
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
