// PhotoManagerScreen.js

import React, { useEffect, useState, useRef, useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Button,
  TextInput,
  Image,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  SectionList,
  Animated,
  ScrollView,
} from "react-native";
import {
  PinchGestureHandler,
  State,
  PanGestureHandler,
} from "react-native-gesture-handler";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { auth, db, storage } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import { MaterialIcons } from "@expo/vector-icons";
import { ThemeContext } from "../ThemeContext";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 150;

function PinchableImage({ uri, imageStyle }) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const onPinchEvent = Animated.event([{ nativeEvent: { scale } }], {
    useNativeDriver: false,
  });
  const onPinchStateChange = (event) => {
    if (
      event.nativeEvent.state === State.END ||
      event.nativeEvent.state === State.CANCELLED
    ) {
      lastScale.current *= event.nativeEvent.scale;
      scale.setValue(lastScale.current);
    } else if (event.nativeEvent.state === State.BEGAN) {
      scale.setValue(lastScale.current);
    }
  };
  return (
    <PinchGestureHandler
      onGestureEvent={onPinchEvent}
      onHandlerStateChange={onPinchStateChange}
    >
      <Animated.Image
        source={{ uri }}
        style={[imageStyle, { transform: [{ scale }] }]}
      />
    </PinchGestureHandler>
  );
}

export default function PhotoManagerScreen({ route }) {
  const { theme } = useContext(ThemeContext);
  const { tripId } = route.params;

  const [photos, setPhotos] = useState([]);
  const [comment, setComment] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [modalTranslateY] = useState(new Animated.Value(0));

  useEffect(() => {
    const colRef = collection(
      db,
      "users",
      auth.currentUser.uid,
      "trips",
      tripId,
      "photos"
    );
    const q = query(colRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = [];
      snapshot.forEach((d) => all.push({ id: d.id, ...d.data() }));
      setPhotos(all);
      if (selectedPhoto) {
        if (!all.find((p) => p.id === selectedPhoto.id)) {
          setModalVisible(false);
          setSelectedPhoto(null);
        }
      }
    });
    return unsubscribe;
  }, [tripId, selectedPhoto]);

  const groupPhotosByDate = (photos) => {
    const g = {};
    photos.forEach((p) => {
      const d = new Date(p.timestamp).toISOString().split("T")[0];
      if (!g[d]) g[d] = [];
      g[d].push(p);
    });
    return Object.keys(g)
      .map((date) => {
        const items = g[date].sort((a, b) => b.timestamp - a.timestamp);
        const rows = [];
        for (let i = 0; i < items.length; i += 3)
          rows.push(items.slice(i, i + 3));
        return { title: date, data: rows };
      })
      .sort((a, b) => new Date(b.title) - new Date(a.title));
  };

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "We need permission to access your photos."
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    if (!(await requestPermission())) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!res.canceled && res.assets.length > 0) {
      const uri = res.assets[0].uri;
      const m = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      uploadPhoto(m.uri);
    }
  };

  const uploadPhoto = async (uri) => {
    try {
      const blob = await (await fetch(uri)).blob();
      const fn = `${await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uri + Date.now()
      )}.jpg`;
      const path = `users/${auth.currentUser.uid}/trips/${tripId}/${fn}`;
      const sref = ref(storage, path);
      await uploadBytes(sref, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(sref);
      await addDoc(
        collection(
          db,
          "users",
          auth.currentUser.uid,
          "trips",
          tripId,
          "photos"
        ),
        {
          imageUrl: url,
          imagePath: path,
          comments: {},
          timestamp: Date.now(),
        }
      );
    } catch (e) {
      console.log(e);
      Alert.alert("Upload failed", e.message);
    }
  };

  const addCommentToPhoto = async () => {
    if (!comment.trim() || !selectedPhoto) return;
    const refP = doc(
      db,
      "users",
      auth.currentUser.uid,
      "trips",
      tripId,
      "photos",
      selectedPhoto.id
    );
    const snap = await getDoc(refP);
    if (snap.exists()) {
      const data = snap.data();
      const c = { ...data.comments, [Date.now().toString()]: comment.trim() };
      await updateDoc(refP, { comments: c });
      setSelectedPhoto({ ...data, comments: c, id: selectedPhoto.id });
      setComment("");
    }
  };

  const deleteComment = async (cid) => {
    if (!selectedPhoto) return;
    const refP = doc(
      db,
      "users",
      auth.currentUser.uid,
      "trips",
      tripId,
      "photos",
      selectedPhoto.id
    );
    const snap = await getDoc(refP);
    if (snap.exists()) {
      const d = snap.data();
      delete d.comments[cid];
      await updateDoc(refP, { comments: d.comments });
      setSelectedPhoto({ ...d, id: selectedPhoto.id });
    }
  };

  const deletePhotoItem = (photo) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this photo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteObject(ref(storage, photo.imagePath));
              await deleteDoc(
                doc(
                  db,
                  "users",
                  auth.currentUser.uid,
                  "trips",
                  tripId,
                  "photos",
                  photo.id
                )
              );
            } catch (e) {
              console.log(e);
              Alert.alert("Error", "Failed to delete photo");
            }
          },
        },
      ]
    );
  };

  const shareImage = async (remoteUrl) => {
    try {
      const filename = remoteUrl.split("/").pop().split("?")[0];
      const localUri = FileSystem.cacheDirectory + filename;
      await FileSystem.downloadAsync(remoteUrl, localUri);
      await Sharing.shareAsync(localUri, { mimeType: "image/jpeg" });
    } catch (e) {
      console.log(e);
      Alert.alert("Share Failed", "Unable to share image");
    }
  };

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: modalTranslateY } }],
    { useNativeDriver: true }
  );
  const onPanStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      if (event.nativeEvent.translationY > SWIPE_THRESHOLD) {
        setModalVisible(false);
        modalTranslateY.setValue(0);
      } else {
        Animated.spring(modalTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const renderRow = ({ item: row }) => (
    <View style={styles.rowContainer}>
      {row.map((photo) => (
        <TouchableOpacity
          key={photo.id}
          style={styles.photoContainer}
          onPress={() => {
            setSelectedPhoto(photo);
            setModalVisible(true);
          }}
          onLongPress={() => deletePhotoItem(photo)}
        >
          <Image source={{ uri: photo.imageUrl }} style={styles.photoImage} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const sections = groupPhotosByDate(photos);
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            <Text style={styles.title}>Photo Manager</Text>
            {photos.length === 0 ? (
              <Text style={styles.emptyHint}>
                No photos yet. Tap "Add Photo" below to upload.
              </Text>
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={(row, idx) =>
                  row.map((p) => p.id).join("_") + idx
                }
                renderSectionHeader={({ section: { title } }) => (
                  <Text style={styles.sectionHeader}>{title}</Text>
                )}
                renderItem={renderRow}
                contentContainerStyle={styles.flatListContent}
              />
            )}
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={pickImage}
              >
                <MaterialIcons
                  name="photo-library"
                  size={24}
                  color={theme.buttonText}
                />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            </View>
            <Modal visible={modalVisible} transparent animationType="none">
              <PanGestureHandler
                onGestureEvent={onPanGestureEvent}
                onHandlerStateChange={onPanStateChange}
              >
                <Animated.View
                  style={[
                    styles.modalOverlay,
                    { transform: [{ translateY: modalTranslateY }] },
                  ]}
                >
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalCard}>
                      <View style={styles.modalHeader}>
                        <TouchableOpacity
                          onPress={() => setModalVisible(false)}
                          style={styles.closeButton}
                        >
                          <MaterialIcons
                            name="close"
                            size={24}
                            color={theme.text}
                          />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Photo Details</Text>
                        <TouchableOpacity
                          onPress={() =>
                            selectedPhoto && shareImage(selectedPhoto.imageUrl)
                          }
                          style={styles.shareButton}
                        >
                          <MaterialIcons
                            name="share"
                            size={24}
                            color={theme.text}
                          />
                        </TouchableOpacity>
                      </View>
                      {selectedPhoto && (
                        <>
                          <View style={styles.zoomContainer}>
                            <PinchableImage
                              uri={selectedPhoto.imageUrl}
                              imageStyle={styles.modalImage}
                            />
                          </View>
                          <ScrollView
                            style={styles.commentsList}
                            showsVerticalScrollIndicator={false}
                          >
                            {Object.entries(selectedPhoto.comments).map(
                              ([cid, txt]) => (
                                <View key={cid} style={styles.commentItem}>
                                  <Text style={styles.commentText}>{txt}</Text>
                                  <TouchableOpacity
                                    onPress={() => deleteComment(cid)}
                                  >
                                    <MaterialIcons
                                      name="delete"
                                      size={20}
                                      color={theme.text}
                                    />
                                  </TouchableOpacity>
                                </View>
                              )
                            )}
                          </ScrollView>
                          <View style={styles.commentInputContainer}>
                            <TextInput
                              placeholder="Add a comment..."
                              placeholderTextColor={theme.placeholder}
                              value={comment}
                              onChangeText={setComment}
                              style={styles.commentInput}
                            />
                            <Button
                              title="Add"
                              color={theme.buttonBackground}
                              onPress={addCommentToPhoto}
                            />
                          </View>
                        </>
                      )}
                    </View>
                  </TouchableWithoutFeedback>
                </Animated.View>
              </PanGestureHandler>
            </Modal>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme) => {
  const containerPadding = 16 * 2;
  const spacing = 4;
  const photoWidth = (SCREEN_WIDTH - containerPadding - spacing * 2) / 3;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1 },
    innerContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
    title: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.primary,
      textAlign: "center",
      marginBottom: 30,
      textTransform: "uppercase",
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: theme.accentLight,
      borderRadius: 10,
      alignSelf: "center",
      letterSpacing: 1,
      textShadowColor: theme.primaryShadow,
      textShadowOffset: { width: 0, height: 3 },
      textShadowRadius: 6,
    },
    emptyHint: { textAlign: "center", color: theme.placeholder, marginTop: 20 },
    flatListContent: { paddingBottom: 20 },
    sectionHeader: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      backgroundColor: theme.cardBackground,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      marginVertical: 4,
    },
    rowContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    photoContainer: { width: photoWidth, marginHorizontal: 2 },
    photoImage: {
      width: "100%",
      height: photoWidth,
      borderRadius: 10,
      resizeMode: "cover",
    },
    bottomBar: {
      flexDirection: "row",
      justifyContent: "center",
      paddingVertical: 12,
    },
    addPhotoButton: {
      flexDirection: "row",
      backgroundColor: theme.buttonBackground,
      borderRadius: 24,
      paddingVertical: 10,
      paddingHorizontal: 18,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 3,
    },
    addPhotoText: {
      color: theme.buttonText,
      fontSize: 16,
      marginLeft: 6,
      fontWeight: "600",
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalCard: {
      width: SCREEN_WIDTH * 0.9,
      backgroundColor: theme.cardBackground,
      borderRadius: 14,
      padding: 20,
      elevation: 5,
      maxHeight: "85%",
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    closeButton: { padding: 8 },
    modalTitle: { fontSize: 18, fontWeight: "600", color: theme.text },
    shareButton: { padding: 8 },
    zoomContainer: {
      width: "100%",
      height: 220,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    modalImage: { width: "100%", height: "100%", resizeMode: "contain" },
    commentsList: { maxHeight: 150, marginBottom: 12 },
    commentItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: theme.borderColor,
    },
    commentText: { flex: 1, color: theme.text, marginRight: 10 },
    commentInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 8,
      padding: 4,
    },
    commentInput: { flex: 1, padding: 8, fontSize: 14, color: theme.text },
  });
};
