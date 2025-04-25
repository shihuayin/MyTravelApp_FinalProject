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
import { PinchGestureHandler, State } from "react-native-gesture-handler";
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

//pinch-to-zoom on image
function PinchableImage({ uri, imageStyle }) {
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: scale } }], {
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
  const [uploadingPhotoUris, setUploadingPhotoUris] = useState([]);

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
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allData = [];
        snapshot.forEach((d) => allData.push({ id: d.id, ...d.data() }));
        setPhotos(allData);

        if (selectedPhoto) {
          const updatedPhoto = allData.find((p) => p.id === selectedPhoto.id);
          if (!updatedPhoto) {
            setModalVisible(false);
            setSelectedPhoto(null);
          }
        }
      },
      (error) => {
        console.log("Firestore photos snapshot error:", error);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tripId, selectedPhoto]);

  const groupPhotosByDate = (photos) => {
    const groups = {};
    photos.forEach((photo) => {
      const dateStr = new Date(photo.timestamp).toISOString().split("T")[0];
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(photo);
    });

    // 3 photos per row
    const sections = [];
    Object.keys(groups).forEach((dateStr) => {
      const items = groups[dateStr].sort((a, b) => b.timestamp - a.timestamp);
      const rows = [];
      for (let i = 0; i < items.length; i += 3) {
        rows.push(items.slice(i, i + 3));
      }
      sections.push({
        title: dateStr,
        data: rows,
      });
    });
    // sort  newest date first
    sections.sort((a, b) => new Date(b.title) - new Date(a.title));
    return sections;
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
    const hasPermission = await requestPermission();
    if (!hasPermission) return;
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const originalUri = result.assets[0].uri;

      // resize and compress image
      const manipResult = await ImageManipulator.manipulateAsync(
        originalUri,
        [{ resize: { width: 800 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      uploadPhoto(manipResult.uri);
    }
  };

  const uploadPhoto = async (uri) => {
    setUploadingPhotoUris((prev) => [...prev, uri]);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `${await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uri + Date.now().toString()
      )}.jpg`;
      const storagePath = `users/${auth.currentUser.uid}/trips/${tripId}/${filename}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(storageRef);

      // save metadata to firestore
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
          imagePath: storagePath,
          comments: {},
          timestamp: Date.now(),
        }
      );
    } catch (e) {
      console.log("Upload error:", e);
      Alert.alert("Upload failed", e.message);
    } finally {
      setUploadingPhotoUris((prev) => prev.filter((u) => u !== uri));
    }
  };

  //add comment
  const addCommentToPhoto = async () => {
    if (!comment.trim() || !selectedPhoto) return;
    const photoRef = doc(
      db,
      "users",
      auth.currentUser.uid,
      "trips",
      tripId,
      "photos",
      selectedPhoto.id
    );
    try {
      const photoDoc = await getDoc(photoRef);
      if (photoDoc.exists()) {
        const photoData = photoDoc.data();
        const newComments = { ...photoData.comments };
        const commentId = Date.now().toString();
        newComments[commentId] = comment.trim();
        await updateDoc(photoRef, { comments: newComments });
        setSelectedPhoto({
          ...photoData,
          comments: newComments,
          id: selectedPhoto.id,
        });
        setComment("");
      }
    } catch (e) {
      console.log("Add comment error:", e);
      Alert.alert("Error", "Failed to add comment.");
    }
  };

  //delete comment
  const deleteComment = async (commentId) => {
    if (!selectedPhoto) return;
    const photoRef = doc(
      db,
      "users",
      auth.currentUser.uid,
      "trips",
      tripId,
      "photos",
      selectedPhoto.id
    );
    try {
      const photoDoc = await getDoc(photoRef);
      if (photoDoc.exists()) {
        const photoData = photoDoc.data();
        const newComments = { ...photoData.comments };
        delete newComments[commentId];
        await updateDoc(photoRef, { comments: newComments });
        setSelectedPhoto({
          ...photoData,
          comments: newComments,
          id: selectedPhoto.id,
        });
      }
    } catch (e) {
      console.log("Delete comment error:", e);
      Alert.alert("Error", "Failed to delete comment.");
    }
  };

  //delete image
  const deletePhotoItem = async (photo) => {
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
              const storageRef = ref(storage, photo.imagePath);
              await deleteObject(storageRef);
              const photoRef = doc(
                db,
                "users",
                auth.currentUser.uid,
                "trips",
                tripId,
                "photos",
                photo.id
              );
              await deleteDoc(photoRef);
            } catch (error) {
              console.log("Delete error:", error);
              Alert.alert("Error", "Failed to delete photo.");
            }
          },
        },
      ]
    );
  };

  const renderRow = ({ item: row }) => {
    return (
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
  };

  const sections = groupPhotosByDate(photos);
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.innerContainer}>
            <Text style={styles.title}>Photo Manager</Text>
            {photos.length === 0 ? (
              <Text style={styles.emptyHint}>
                No photos yet. Tap "Add Photo" below to upload.
              </Text>
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={(row, index) =>
                  row.map((photo) => photo.id).join("_") + index.toString()
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

            <Modal
              visible={modalVisible}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setModalVisible(false)}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                  <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Photo Details</Text>
                      <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setModalVisible(false)}
                      >
                        <MaterialIcons
                          name="close"
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
                        <Text style={styles.modalSubtitle}>Comments</Text>
                        <ScrollView style={styles.commentsList}>
                          {Object.entries(selectedPhoto.comments || {}).map(
                            ([cid, text]) => (
                              <View key={cid} style={styles.commentItem}>
                                <Text style={styles.commentText}>{text}</Text>
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
                            placeholder="Add a comment"
                            placeholderTextColor={theme.placeholder}
                            value={comment}
                            onChangeText={setComment}
                            style={styles.commentInput}
                          />
                          <Button
                            title="Add"
                            onPress={addCommentToPhoto}
                            color={theme.buttonBackground}
                          />
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </TouchableWithoutFeedback>
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
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
    },
    innerContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 10,
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
    emptyHint: {
      textAlign: "center",
      color: theme.placeholder,
      marginTop: 20,
      fontSize: 16,
    },
    flatListContent: {
      paddingBottom: 20,
    },
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
    photoContainer: {
      width: photoWidth,
      marginHorizontal: 2,
    },
    photoImage: {
      width: "100%",
      height: photoWidth,
      borderRadius: 10,
      resizeMode: "cover",
    },
    uploadingOverlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      alignItems: "center",
    },
    bottomBar: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 12,
      marginBottom: 8,
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
      fontWeight: "600",
      marginLeft: 6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalCard: {
      width: SCREEN_WIDTH * 0.9,
      backgroundColor: theme.cardBackground,
      borderRadius: 14,
      padding: 20,
      position: "relative",
      elevation: 5,
      maxHeight: "85%",
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    modalTitle: {
      fontSize: 20,
      color: theme.text,
      fontWeight: "bold",
    },
    closeButton: {
      padding: 4,
    },
    zoomContainer: {
      width: "100%",
      height: 220,
      marginBottom: 12,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    modalImage: {
      width: "100%",
      height: "100%",
      resizeMode: "contain",
    },
    modalSubtitle: {
      fontSize: 18,
      color: theme.text,
      fontWeight: "600",
      marginBottom: 8,
      textAlign: "center",
    },
    commentsList: {
      maxHeight: 150,
      marginBottom: 12,
    },
    commentItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: theme.borderColor,
    },
    commentText: {
      flex: 1,
      marginRight: 10,
      color: theme.text,
    },
    commentInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    commentInput: {
      flex: 1,
      padding: 8,
      fontSize: 14,
      color: theme.text,
    },
  });
};
