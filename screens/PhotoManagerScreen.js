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

// 缩放
function PinchableImage({ uri, imageStyle }) {
  //初始缩放比例 1
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  //Animated.event：将手势的 nativeEvent.scale 自动映射到 scale 动画值。
  const onPinchEvent = Animated.event([{ nativeEvent: { scale } }], {
    useNativeDriver: false,
  });
  //onPinchStateChange：在捏合开始时锁定当前比例，结束后累积到 lastScale，确保多次捏合连续生效。
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

  //real-time listen to the subcollection `/photos` subcollection, asc
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

  //group by date
  const groupPhotosByDate = (photos) => {
    const g = {};
    photos.forEach((p) => {
      const d = new Date(p.timestamp).toISOString().split("T")[0];
      if (!g[d]) g[d] = [];
      g[d].push(p);
    });
    // generate rows for each day, 3 photos per row
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

  //request photo library permission & select image
  const requestPermission = async () => {
    //ImagePicker：打开系统图库，允许裁剪。
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

  //select image from the photo library:
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
        // compress image (quality: 0.6, width: 800px).
        [{ resize: { width: 800 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      uploadPhoto(m.uri);
    }
  };

  //upload image
  const uploadPhoto = async (uri) => {
    if (typeof fetch !== "function") return;
    try {
      //first convert the local URI to a blob before uploading
      const blob = await (await fetch(uri)).blob();
      // use the URI + timestamp to generate a SHA256 hash as the file name
      const fn = `${await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uri + Date.now()
      )}.jpg`;

      // upload to Firebase Storage
      const path = `users/${auth.currentUser.uid}/trips/${tripId}/${fn}`;
      const sref = ref(storage, path);
      await uploadBytes(sref, blob, { contentType: "image/jpeg" });

      //get  downloadURL
      const url = await getDownloadURL(sref);

      // wirte a new record in Firestore
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

  //add comment
  const addCommentToPhoto = async () => {
    if (!comment.trim() || !selectedPhoto) return;
    //path
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
      // read all previous comment
      const data = snap.data();
      //add new comment
      const c = { ...data.comments, [Date.now().toString()]: comment.trim() };
      await updateDoc(refP, { comments: c });
      //update
      setSelectedPhoto({ ...data, comments: c, id: selectedPhoto.id });
      setComment("");
    }
  };

  //delete comment
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
    //read all previous comment
    const snap = await getDoc(refP);
    //excute  delete data.comments[cid]
    if (snap.exists()) {
      const d = snap.data();
      delete d.comments[cid];
      //update  comment docment (backend)
      await updateDoc(refP, { comments: d.comments });
      //update frontend
      setSelectedPhoto({ ...d, id: selectedPhoto.id });
    }
  };

  //delete image
  const deletePhotoItem = (photo) => {
    //alert
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
              //first step, delete the file from Firebase Storage
              await deleteObject(ref(storage, photo.imagePath));
              // second step, delete the document record from Firestore
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

  //share image
  const shareImage = async (remoteUrl) => {
    try {
      //extract filename from URL
      const filename = remoteUrl.split("/").pop().split("?")[0];
      const localUri = FileSystem.cacheDirectory + filename;
      await FileSystem.downloadAsync(remoteUrl, localUri);
      //call the system share menu
      await Sharing.shareAsync(localUri, { mimeType: "image/jpeg" });
    } catch (e) {
      console.log(e);
      Alert.alert("Share Failed", "Unable to share image");
    }
  };

  //pull down to close the modal
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

  // render row, 'row' is an array of 1 to 3 photos
  const renderRow = ({ item: row }) => (
    <View style={styles.rowContainer}>
      {row.map((photo) => (
        <TouchableOpacity
          key={photo.id}
          style={styles.photoContainer}
          //tap to open the detail modal
          onPress={() => {
            setSelectedPhoto(photo);
            setModalVisible(true);
          }}
          //long press delete image
          onLongPress={() => deletePhotoItem(photo)}
        >
          <Image
            testID="photo-item"
            source={{ uri: photo.imageUrl }}
            style={styles.photoImage}
          />
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
            {/* title */}
            <Text style={styles.title}>Photo Manager</Text>
            {photos.length === 0 ? (
              //if no image
              <Text style={styles.emptyHint}>
                No photos yet. Tap "Add Photo" below to upload.
              </Text>
            ) : (
              //group and display photos by date
              <SectionList
                //sections is an array
                //each element contains all the photos for a specific date
                sections={sections}
                keyExtractor={(row, idx) =>
                  row.map((p) => p.id).join("_") + idx
                }
                // date
                renderSectionHeader={({ section: { title } }) => (
                  <Text style={styles.sectionHeader}>{title}</Text>
                )}
                // each item (3 images)
                renderItem={renderRow}
                contentContainerStyle={styles.flatListContent}
              />
            )}

            {/* upload image button */}
            <View style={styles.bottomBar}>
              {/* pickImage function */}
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={pickImage}
              >
                {/* icon */}
                <MaterialIcons
                  name="photo-library"
                  size={24}
                  color={theme.buttonText}
                />
                {/* text */}
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            </View>

            {/*detail modal */}
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
                    {/* header:close icon  + title + share icon */}
                    <View style={styles.modalCard}>
                      <View style={styles.modalHeader}>
                        {/* close icon */}
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
                        {/* title  */}
                        <Text style={styles.modalTitle}>Photo Details</Text>

                        {/* share icon */}
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

                      {/* 图片展示、缩放 */}
                      {selectedPhoto && (
                        <>
                          {/* display image, support pinch-to-zoom */}
                          <View style={styles.zoomContainer}>
                            <PinchableImage
                              uri={selectedPhoto.imageUrl}
                              imageStyle={styles.modalImage}
                            />
                          </View>

                          {/* comment list, map */}
                          <ScrollView
                            style={styles.commentsList}
                            showsVerticalScrollIndicator={false}
                          >
                            {Object.entries(selectedPhoto.comments || {}).map(
                              ([cid, txt]) => (
                                <View key={cid} style={styles.commentItem}>
                                  {/* comment text */}
                                  <Text style={styles.commentText}>{txt}</Text>
                                  {/* delete icon, 🗑️ */}
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
                            {/* input comment */}
                            <TextInput
                              placeholder="Add a comment..."
                              placeholderTextColor={theme.placeholder}
                              value={comment}
                              onChangeText={setComment}
                              style={styles.commentInput}
                            />
                            {/* add button, for comment */}
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
