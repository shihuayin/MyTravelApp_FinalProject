// screens/PackingListScreen.js
import React, { useEffect, useState, useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from "react-native";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { ThemeContext } from "../ThemeContext";

export default function PackingListScreen({ route }) {
  const { theme } = useContext(ThemeContext);
  const { tripId } = route.params;
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState([]);

  // listener for pack list collection
  useEffect(() => {
    const colRef = collection(
      db,
      "users",
      auth.currentUser.uid,
      "trips",
      tripId,
      "packingList"
    );
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const data = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() }));
        // sort: unchecked first, then checked
        // both alphabetically by name
        const unchecked = data
          .filter((i) => !i.checked)
          .sort((a, b) => a.name.localeCompare(b.name));
        const checked = data
          .filter((i) => i.checked)
          .sort((a, b) => a.name.localeCompare(b.name));
        setItems([...unchecked, ...checked]);
      },
      (error) => {
        console.log("PackingList onSnapshot error:", error);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tripId]);

  // add new item
  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert("Input Error", "Please enter the item name.");
      return;
    }
    if (quantity < 1 || quantity > 10) {
      Alert.alert("Input Error", "Quantity must be between 1 and 10.");
      return;
    }
    try {
      const colRef = collection(
        db,
        "users",
        auth.currentUser.uid,
        "trips",
        tripId,
        "packingList"
      );
      await addDoc(colRef, {
        name: name.trim(),
        quantity: quantity,
        checked: false,
      });
      setName("");
      setQuantity(1);
      Keyboard.dismiss();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (error) {
      console.log("Add item error:", error);
      Alert.alert("Error", "Failed to add item.");
    }
  };
  //  checked/unchecked
  const toggleCheck = async (item) => {
    try {
      const docRef = doc(
        db,
        "users",
        auth.currentUser.uid,
        "trips",
        tripId,
        "packingList",
        item.id
      );
      await updateDoc(docRef, { checked: !item.checked });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (error) {
      console.log("Toggle check error:", error);
      Alert.alert("Error", "Failed to update status.");
    }
  };
  //handle delete
  const handleDelete = async (item) => {
    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const docRef = doc(
                db,
                "users",
                auth.currentUser.uid,
                "trips",
                tripId,
                "packingList",
                item.id
              );
              await deleteDoc(docRef);
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut
              );
            } catch (error) {
              console.log("Delete item error:", error);
              Alert.alert("Error", "Failed to delete item.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };
  // summary based on unchecked items
  const getSummary = () => {
    const uncheckedCount = items.filter((item) => !item.checked).length;
    if (uncheckedCount === 0 && items.length > 0) {
      return "All items checked. Ready to go!";
    } else if (uncheckedCount === 1) {
      return "You have 1 item not checked.";
    }
    return `You have ${uncheckedCount} items not checked.`;
  };

  //quantity increment
  const incrementQuantity = () => {
    setQuantity((prev) => {
      if (prev < 10) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        return prev + 1;
      }
      return prev;
    });
  };
  //quantity decrement
  const decrementQuantity = () => {
    setQuantity((prev) => {
      if (prev > 1) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        return prev - 1;
      }
      return prev;
    });
  };

  const handleQuantityChange = (text) => {
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      if (num >= 1 && num <= 10) {
        setQuantity(num);
      } else if (num < 1) {
        setQuantity(1);
      } else if (num > 10) {
        setQuantity(10);
      }
    } else if (text === "") {
      setQuantity("");
    }
  };
  // render  packing list
  const renderItem = ({ item }) => (
    <View style={[styles.listItem, item.checked && styles.listItemChecked]}>
      <TouchableOpacity
        onPress={() => toggleCheck(item)}
        style={styles.checkBox}
      >
        <MaterialIcons
          name={item.checked ? "check-box" : "check-box-outline-blank"}
          size={24}
          color={item.checked ? theme.buttonBackground : theme.text}
        />
      </TouchableOpacity>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
          {item.name} x {item.quantity}
        </Text>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item)}>
        <MaterialIcons name="delete" size={24} color={theme.text} />
      </TouchableOpacity>
    </View>
  );

  const styles = createStyles(theme);
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* close keyboard auto */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.innerContainer}>
            <Text style={styles.title}>Packing List</Text>
            <View style={styles.card}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Item Name"
                  placeholderTextColor={theme.placeholder}
                  value={name}
                  onChangeText={setName}
                />
                <View style={styles.quantityContainer}>
                  <TouchableOpacity
                    onPress={decrementQuantity}
                    style={styles.quantityButton}
                  >
                    <MaterialIcons
                      name="remove"
                      size={20}
                      color={theme.buttonText}
                    />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.quantityInput}
                    keyboardType="numeric"
                    placeholderTextColor={theme.buttonText}
                    value={quantity.toString()}
                    onChangeText={handleQuantityChange}
                    maxLength={2}
                  />
                  <TouchableOpacity
                    onPress={incrementQuantity}
                    style={styles.quantityButton}
                  >
                    <MaterialIcons
                      name="add"
                      size={20}
                      color={theme.buttonText}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.flatList}
            />
            {items.length > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryText}>{getSummary()}</Text>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
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
    inputRow: {
      flexDirection: "row",
      marginBottom: 15,
    },
    input: {
      flex: 2,
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.text,
      marginRight: 10,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    quantityContainer: {
      flexDirection: "row",
      backgroundColor: theme.buttonBackground,
      borderRadius: 8,
      overflow: "hidden",
      alignItems: "center",
    },
    quantityButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    quantityInput: {
      width: 40,
      textAlign: "center",
      color: theme.buttonText,
      fontSize: 16,
    },
    addButton: {
      backgroundColor: theme.buttonBackground,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center",
    },
    addButtonText: {
      color: theme.buttonText,
      fontSize: 18,
      fontWeight: "600",
    },
    flatList: {
      marginTop: 20,
    },
    listItem: {
      backgroundColor: theme.cardBackground,
      borderRadius: 10,
      marginBottom: 10,
      elevation: 2,
      padding: 10,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    listItemChecked: {
      backgroundColor: "#EFEFEF",
    },
    checkBox: {
      marginRight: 10,
    },
    itemInfo: {
      flex: 1,
    },
    itemText: {
      fontSize: 16,
      color: theme.text,
    },
    itemTextChecked: {
      textDecorationLine: "line-through",
      color: theme.text,
    },
    summaryCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 10,
      marginTop: 20,
      elevation: 2,
      padding: 15,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    summaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      textAlign: "center",
    },
  });
}
