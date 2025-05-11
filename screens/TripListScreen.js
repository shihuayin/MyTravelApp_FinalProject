// screens/TripListScreen.js
import React, { useEffect, useState, useRef, useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Alert,
  Dimensions,
  Modal,
  Switch,
  TouchableWithoutFeedback,
} from "react-native";
import { auth, db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { ThemeContext } from "../ThemeContext";

// calculate dimensions for grid layout
const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 3 * 12) / 2;
const CARD_HEIGHT = Math.round((CARD_WIDTH * 9) / 8);

export default function TripListScreen({ navigation }) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [trips, setTrips] = useState([]);
  const [photoCache, setPhotoCache] = useState({});
  const photoUnsubscribesRef = useRef([]);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);

  // fetch trips
  useEffect(() => {
    if (!auth.currentUser) return;
    const colRef = collection(db, "users", auth.currentUser.uid, "trips");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let arr = [];
        snapshot.forEach((docSnap) => {
          arr.push({ id: docSnap.id, ...docSnap.data() });
        });
        setTrips(arr);
      },
      (error) => {
        console.log("Firestore snapshot error (trips):", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // load image for each trip
  useEffect(() => {
    photoUnsubscribesRef.current.forEach((unsub) => unsub && unsub());
    photoUnsubscribesRef.current = [];
    trips.forEach((trip) => {
      const colRef = collection(
        db,
        "users",
        auth.currentUser.uid,
        "trips",
        trip.id,
        "photos"
      );
      const q = query(colRef, orderBy("timestamp", "asc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const photos = snapshot.docs.map((doc) => doc.data().imageUrl);
          if (photos.length > 0) {
            setPhotoCache((prevCache) => ({
              ...prevCache,
              [trip.id]: photos[0],
            }));
          } else {
            setPhotoCache((prevCache) => ({
              ...prevCache,
              [trip.id]: null,
            }));
          }
        },
        (error) => {
          console.log("Firestore photos snapshot error:", error);
        }
      );
      photoUnsubscribesRef.current.push(unsubscribe);
    });
    return () => {
      photoUnsubscribesRef.current.forEach((unsub) => unsub && unsub());
      photoUnsubscribesRef.current = [];
    };
  }, [trips]);

  // background image, first trip photo
  const getCardBackground = (tripId) => {
    if (photoCache[tripId]) {
      return { uri: photoCache[tripId] };
    }
    return require("../assets/default.png");
  };

  //delete trip
  const handleDeleteTrip = (tripId) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this trip? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(
                doc(db, "users", auth.currentUser.uid, "trips", tripId)
              );
              setTrips((prevTrips) =>
                prevTrips.filter((trip) => trip.id !== tripId)
              );
            } catch (error) {
              console.error("Error deleting trip:", error);
              Alert.alert("Error", "Failed to delete the trip.");
            }
          },
        },
      ]
    );
  };
  // logout
  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => signOut(auth),
        },
      ],
      { cancelable: true }
    );
  };

  const toggleSettingsModal = () => {
    setSettingsModalVisible(!isSettingsModalVisible);
  };

  // renderr each trip as a card
  // with background photo and title
  const renderTrip = ({ item }) => (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={() =>
        navigation.navigate("TripDetailScreen", { tripId: item.id })
      }
      onLongPress={() => handleDeleteTrip(item.id)}
    >
      <ImageBackground
        source={getCardBackground(item.id)}
        style={styles.cardBackground}
        imageStyle={styles.cardImage}
      >
        <View style={styles.cardOverlay}>
          <Text style={styles.cardTitle}>{item.destination}</Text>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );

  const styles = createStyles(theme);
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <View style={styles.topBar}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          My Trips
        </Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={toggleSettingsModal}
        >
          <MaterialIcons name="settings" size={24} color={theme.buttonText} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No trips found.</Text>
        }
      />
      <TouchableOpacity
        style={styles.floatingButton}
        accessibilityLabel="add"
        onPress={() => navigation.navigate("CreateTripScreen")}
      >
        <MaterialIcons name="add" size={28} color={theme.buttonText} />
      </TouchableOpacity>
      <Modal
        visible={isSettingsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={toggleSettingsModal}
      >
        <TouchableWithoutFeedback onPress={toggleSettingsModal}>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Settings
              </Text>
              <View style={styles.settingItem}>
                <Text style={[styles.settingText, { color: theme.text }]}>
                  Dark Mode
                </Text>
                <Switch
                  value={theme.background === "#1F1F1F"}
                  onValueChange={toggleTheme}
                  thumbColor={theme.buttonText}
                  trackColor={{
                    false: theme.borderColor,
                    true: theme.borderColor,
                  }}
                />
              </View>
              <TouchableOpacity
                style={styles.settingButton}
                onPress={handleLogout}
              >
                <MaterialIcons
                  name="logout"
                  size={24}
                  color={theme.buttonText}
                />
                <Text style={styles.settingButtonText}>Logout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={toggleSettingsModal}
              >
                <MaterialIcons
                  name="close"
                  size={24}
                  color={theme.buttonText}
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "800",
    },
    iconButton: {
      padding: 8,
      backgroundColor: theme.buttonBackground,
      borderRadius: 50,
      justifyContent: "center",
      alignItems: "center",
    },
    listContent: {
      paddingHorizontal: 12,
      paddingTop: 28,
      paddingBottom: 80,
    },
    columnWrapper: {
      justifyContent: "space-between",
      marginBottom: 12,
    },
    cardContainer: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 10,
      backgroundColor: theme.cardBackground,
      overflow: "hidden",
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    cardBackground: {
      flex: 1,
      justifyContent: "flex-end",
    },
    cardImage: {
      borderRadius: 10,
    },
    cardOverlay: {
      backgroundColor: "rgba(46, 46, 46, 0.35)",
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.buttonText,
    },
    floatingButton: {
      position: "absolute",
      bottom: 20,
      right: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.buttonBackground,
      justifyContent: "center",
      alignItems: "center",
      elevation: 5,
    },
    emptyText: {
      textAlign: "center",
      marginTop: 40,
      fontSize: 16,
      fontWeight: "500",
      color: theme.text,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      width: "80%",
      padding: 20,
      borderRadius: 10,
      alignItems: "center",
      position: "relative",
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: "700",
      marginBottom: 20,
    },
    settingItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 20,
    },
    settingText: {
      fontSize: 18,
    },
    settingButton: {
      flexDirection: "row",
      backgroundColor: theme.buttonBackground,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    },
    settingButtonText: {
      color: theme.buttonText,
      fontSize: 18,
      marginLeft: 10,
      fontWeight: "600",
    },
    closeModalButton: {
      position: "absolute",
      top: 10,
      right: 10,
    },
  });
