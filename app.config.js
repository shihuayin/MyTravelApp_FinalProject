// app.config.js
import "dotenv/config";

export default {
  expo: {
    name: "MyTravelApp",
    slug: "MyTravelApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          "We need access to your photos to upload them.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
    },
    web: {
      favicon: "./assets/favicon.png",
    },

    // 👇 Firebase config passed into your app via Constants.expoConfig.extra
    extra: {
      firebaseApiKey: process.env.MY_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.MY_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.MY_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.MY_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.MY_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.MY_FIREBASE_APP_ID,
    },
  },
};
