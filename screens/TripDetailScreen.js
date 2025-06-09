// screens/TripDetailScreen.js
import { useEffect, useState, useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { auth, db } from "../firebase";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { ThemeContext } from "../ThemeContext";
import { query, orderBy } from "firebase/firestore";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function TripDetailScreen({ route, navigation }) {
  const { theme } = useContext(ThemeContext);
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [packingSummary, setPackingSummary] = useState("Loading...");
  const [expenseSummary, setExpenseSummary] = useState("Loading...");
  const [expensePercentage, setExpensePercentage] = useState(0);
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    let unsubPack, unsubExp, unsubPhoto;

    //get the document content of the current trip
    (async () => {
      try {
        const docRef = doc(db, "users", auth.currentUser.uid, "trips", tripId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setTrip(data);

          // real-time listen to the Packing List state.
          const packingCol = collection(
            db,
            "users",
            auth.currentUser.uid,
            "trips",
            tripId,
            "packingList"
          );
          unsubPack = onSnapshot(
            packingCol,
            (snapshot) => {
              const items = snapshot.docs.map((d) => d.data());
              const unchecked = items.filter((i) => !i.checked).length;
              let summary;
              if (unchecked === 0 && items.length > 0) {
                summary = "All packed up! You’re ready to go 🚀";
              } else if (unchecked === 1) {
                summary = "1 item not checked";
              } else {
                summary = `${unchecked} items not checked`;
              }
              setPackingSummary(summary);
            },
            console.log
          );

          //real-time listen to the expenses data
          const expCol = collection(
            db,
            "users",
            auth.currentUser.uid,
            "trips",
            tripId,
            "expenses"
          );
          unsubExp = onSnapshot(
            expCol,
            (snapshot) => {
              //calculate total expense
              let total = 0;
              snapshot.forEach((d) => {
                const n = Number(d.data().amount);
                total += isNaN(n) ? 0 : n;
              });
              const budget = data.budget || 0;
              let summary;
              let pct = 0;
              //calculate %
              if (budget > 0) {
                pct = Math.round((total / budget) * 100);
                summary = `${pct}% of budget`;
              } else {
                summary = "No budget set";
              }
              setExpensePercentage(pct);
              setExpenseSummary(summary);
            },
            console.log
          );

          //real-time listen to the photo list
          const photoCol = collection(
            db,
            "users",
            auth.currentUser.uid,
            "trips",
            tripId,
            "photos"
          );

          // order by time in descending order (newest first)
          const photoQuery = query(photoCol, orderBy("timestamp", "desc"));

          unsubPhoto = onSnapshot(
            photoQuery,
            (snapshot) => {
              const urls = snapshot.docs.map((d) => d.data().imageUrl);
              //take the 4 most recent photos
              setPhotos(urls.slice(0, 4));
            },
            console.log
          );
        }
      } catch (e) {
        console.log("Error fetching trip:", e);
      }
    })();

    return () => {
      unsubPack && unsubPack();
      unsubExp && unsubExp();
      unsubPhoto && unsubPhoto();
    };
  }, [tripId]);

  const styles = createStyles(theme);

  // display loading screen if trip not yet loaded
  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.buttonBackground} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* destination title */}

        <Text style={styles.title}>{trip.destination}</Text>

        <View style={styles.infoRow}>
          {/* packing List card */}
          <TouchableOpacity
            style={styles.infoCard}
            onPress={() => navigation.navigate("PackingListScreen", { tripId })}
          >
            <MaterialIcons name="checklist" size={30} color={theme.iconColor} />
            <Text style={styles.cardTitle}>Packing List</Text>
            <Text style={styles.cardSummary}>{packingSummary}</Text>
          </TouchableOpacity>

          {/* expenses card */}
          <TouchableOpacity
            style={styles.infoCard}
            onPress={() =>
              navigation.navigate("ExpenseTrackerScreen", {
                tripId,
                budget: trip.budget,
              })
            }
          >
            <MaterialIcons
              name="attach-money"
              size={30}
              color={theme.iconColor}
            />
            <Text style={styles.cardTitle}>Expenses</Text>
            <Text
              style={[
                styles.cardSummary,
                expensePercentage > 100 && styles.overBudget,
              ]}
            >
              {expenseSummary}
            </Text>
          </TouchableOpacity>
        </View>

        {/* photo card */}
        <TouchableOpacity
          style={styles.photoSection}
          onPress={() => navigation.navigate("PhotoManagerScreen", { tripId })}
        >
          <View style={styles.photoHeader}>
            <MaterialIcons
              name="photo-library"
              size={30}
              color={theme.iconColor}
            />
            <Text style={styles.photoTitle}>Photos</Text>
            <MaterialIcons name="chevron-right" size={24} color={theme.text} />
          </View>
          <View style={styles.photoGrid}>
            {photos.length > 0 ? (
              photos.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ))
            ) : (
              <Text style={styles.noPhotosText}>No photos available.</Text>
            )}
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 10,
      fontSize: 16,
      color: theme.text,
      fontFamily: "System",
    },
    container: {
      padding: 20,
      paddingBottom: 40,
    },
    title: {
      fontSize: 36,
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
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 30,
    },
    infoCard: {
      flex: 0.48,
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginTop: 10,
      marginBottom: 5,
      textAlign: "center",
      fontFamily: "System",
    },
    cardSummary: {
      marginTop: 10,
      fontWeight: "600",
      fontSize: 16,
      color: theme.text,
      textAlign: "center",
      fontFamily: "System",
    },
    overBudget: {
      color: theme.text,
      fontWeight: "700",
    },
    photoSection: {
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    photoHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },
    photoTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.text,
      marginLeft: 10,
      flex: 1,
      fontFamily: "System",
    },
    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    photo: {
      width: (SCREEN_WIDTH - 100) / 2,
      height: (SCREEN_WIDTH - 100) / 2,
      borderRadius: 8,
      marginBottom: 10,
    },
    noPhotosText: {
      fontSize: 16,
      color: theme.text,
      textAlign: "center",
      width: "100%",
      marginTop: 20,
      fontFamily: "System",
    },
  });
