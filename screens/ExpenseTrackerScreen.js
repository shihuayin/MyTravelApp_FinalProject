import React, { useEffect, useState, useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
} from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { ThemeContext } from "../ThemeContext";

// expense categories
const categories = [
  { name: "food", icon: "restaurant" },
  { name: "ticket", icon: "confirmation-number" },
  { name: "hotel", icon: "hotel" },
  { name: "trans", icon: "commute" },
  { name: "other", icon: "category" },
  { name: "gift", icon: "shopping-cart" },
];

export default function ExpenseTrackerScreen({ route }) {
  const { theme } = useContext(ThemeContext);
  const { tripId, budget } = route.params; // get trip ID
  const numericBudget = Number(budget);
  const safeBudget =
    !isNaN(numericBudget) && numericBudget > 0 ? numericBudget : 1;

  const [category, setCategory] = useState("food");
  const [amount, setAmount] = useState("");
  const [expenses, setExpenses] = useState({});
  const [totalExpense, setTotalExpense] = useState(0);
  // format currency
  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  // listener
  useEffect(() => {
    const colRef = collection(
      db,
      "users",
      auth.currentUser.uid,
      "trips",
      tripId,
      "expenses"
    );
    const q = query(colRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let expObj = {};
        let total = 0;
        snapshot.forEach((d) => {
          const val = d.data().amount;
          const numericVal = Number(val);
          expObj[d.id] = isNaN(numericVal) ? 0 : numericVal;
          total += isNaN(numericVal) ? 0 : numericVal;
        });
        setExpenses(expObj);
        setTotalExpense(total);
      },
      (error) => {
        console.log("ExpenseTracker onSnapshot error:", error);
      }
    );
    return () => unsubscribe();
  }, [tripId]);

  // add  expense
  const handleAddExpense = async () => {
    if (!amount) {
      Alert.alert("Input Required", "Please enter an amount.");
      return;
    }

    const inputVal = Math.round(Number(amount));
    if (isNaN(inputVal) || inputVal <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid positive number.");
      return;
    }

    const docRef = doc(
      db,
      "users",
      auth.currentUser.uid,
      "trips",
      tripId,
      "expenses",
      category
    );

    try {
      const docSnap = await getDoc(docRef);
      let currentAmount = 0;
      if (docSnap.exists()) {
        const dataVal = docSnap.data().amount;
        const numericVal = Math.round(Number(dataVal));
        currentAmount = isNaN(numericVal) ? 0 : numericVal;
      }

      const finalAmount = currentAmount + inputVal;
      await setDoc(docRef, { amount: finalAmount, timestamp: Date.now() });
      setAmount("");
    } catch (e) {
      console.log("Add expense error:", e);
      Alert.alert("Error", "Failed to add expense.");
    }
  };

  // reset  expense to zero
  const handleDeleteExpense = async (cat) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete all expenses for "${cat}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const docRef = doc(
              db,
              "users",
              auth.currentUser.uid,
              "trips",
              tripId,
              "expenses",
              cat
            );
            try {
              await setDoc(docRef, { amount: 0, timestamp: Date.now() });
            } catch (e) {
              console.log("Delete expense error:", e);
              Alert.alert("Error", "Failed to delete expense.");
            }
          },
        },
      ]
    );
  };

  // calculate budget progress
  let ratio = totalExpense / safeBudget;
  ratio = Math.max(0, Math.min(1, ratio));
  const progress = parseFloat(ratio.toFixed(6));
  const percentage = Math.floor(progress * 100);

  return (
    <SafeAreaView style={styles(theme).safeArea}>
      <KeyboardAvoidingView
        style={styles(theme).container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView contentContainerStyle={styles(theme).scrollContainer}>
            {/* titkle */}
            <Text style={styles(theme).title}>Expense Tracker</Text>

            {/* input section */}
            <View style={styles(theme).card}>
              {/* select category  */}
              <View style={styles(theme).categoryRow}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.name}
                    style={
                      category === cat.name
                        ? [
                            styles(theme).categoryButton,
                            styles(theme).categoryButtonSelected,
                          ]
                        : styles(theme).categoryButton
                    }
                    onPress={() => setCategory(cat.name)}
                  >
                    <MaterialIcons
                      name={cat.icon}
                      size={24}
                      color={
                        category === cat.name ? theme.buttonText : theme.text
                      }
                    />
                    <Text
                      style={
                        category === cat.name
                          ? [
                              styles(theme).categoryText,
                              styles(theme).categoryTextSelected,
                            ]
                          : styles(theme).categoryText
                      }
                    >
                      {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* input amount */}
              <View style={styles(theme).inputContainer}>
                <MaterialIcons
                  name="attach-money"
                  size={24}
                  color={theme.text}
                />
                <TextInput
                  placeholder="Amount"
                  placeholderTextColor={theme.placeholder}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  style={styles(theme).input}
                />
              </View>

              {/* add button */}
              <TouchableOpacity
                style={styles(theme).addButton}
                onPress={handleAddExpense}
              >
                <Text style={styles(theme).addButtonText}>Add Expense</Text>
              </TouchableOpacity>
            </View>

            {/* expense list */}
            <View style={styles(theme).card}>
              <Text style={styles(theme).sectionTitle}>
                Expenses by Category:
              </Text>
              {Object.entries(expenses)
                .filter(([_, amount]) => amount > 0)
                .map(([cat, amount]) => (
                  <View key={cat} style={styles(theme).expenseItem}>
                    <Text style={styles(theme).expenseText}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}:{" "}
                      {formatCurrency(amount)}
                    </Text>
                    <TouchableOpacity onPress={() => handleDeleteExpense(cat)}>
                      <MaterialIcons
                        name="delete"
                        size={24}
                        color={theme.text}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
            </View>

            {/* process card */}
            <View style={styles(theme).card}>
              <View style={styles(theme).budgetRow}>
                <Text style={styles(theme).budgetText}>Total Spent:</Text>
                <Text style={styles(theme).budgetText}>Budget:</Text>
              </View>
              <View style={styles(theme).budgetRow}>
                <Text style={styles(theme).budgetValue}>
                  {formatCurrency(totalExpense)}
                </Text>
                <Text style={styles(theme).budgetValue}>
                  {formatCurrency(safeBudget)}
                </Text>
              </View>
              <Text style={styles(theme).budgetOverview}>
                {`Expenses: ${percentage}% of Budget`}
              </Text>
              <View style={styles(theme).progressBarBackground}>
                <View
                  style={[
                    styles(theme).progressFill,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor:
                        progress >= 0.8 ? "#FFA500" : theme.buttonBackground,
                    },
                  ]}
                />
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
    },
    scrollContainer: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      paddingTop: 20,
    },
    title: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.primary,
      textAlign: "center",
      marginBottom: 30,
      fontFamily: "System",
      textShadowColor: theme.primaryShadow,
      textShadowOffset: { width: 0, height: 3 },
      textShadowRadius: 6,
      letterSpacing: 1,
      textTransform: "uppercase",
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: theme.accentLight,
      borderRadius: 10,
      alignSelf: "center",
    },
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.borderColor,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 15,
    },
    categoryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginBottom: 15,
    },
    categoryButton: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 8,
      backgroundColor: theme.borderColor,
      padding: 10,
      marginBottom: 10,
      flexBasis: "30%",
    },
    categoryButtonSelected: {
      backgroundColor: theme.buttonBackground,
    },
    categoryText: {
      marginLeft: 5,
      fontSize: 16,
      color: theme.text,
    },
    categoryTextSelected: {
      color: theme.buttonText,
      fontWeight: "600",
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    input: {
      flex: 1,
      marginLeft: 10,
      fontSize: 16,
      color: theme.text,
    },
    addButton: {
      backgroundColor: theme.buttonBackground,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: "center",
    },
    addButtonText: {
      color: theme.buttonText,
      fontSize: 18,
      fontWeight: "600",
    },
    expenseItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: theme.borderColor,
    },
    expenseText: {
      fontSize: 16,
      color: theme.text,
    },
    budgetRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    budgetText: {
      fontSize: 16,
      color: theme.text,
      fontWeight: "500",
    },
    budgetValue: {
      fontSize: 16,
      color: theme.text,
      fontWeight: "700",
    },
    budgetOverview: {
      textAlign: "center",
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
      marginVertical: 15,
    },
    progressBarBackground: {
      width: "100%",
      height: 12,
      backgroundColor: theme.borderColor,
      borderRadius: 6,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 6,
    },
  });
