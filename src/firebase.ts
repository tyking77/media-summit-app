import { initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Paste the config from Firebase console > Project settings > Your apps > Web app.
// This config is public by design; security comes from firestore.rules.
const firebaseConfig = {
  apiKey: "AIzaSyDjRGqMmSFPF5pin5Bks1my72bwlL_53RQ",
  authDomain: "media-summit-e3d01.firebaseapp.com",
  projectId: "media-summit-e3d01",
  storageBucket: "media-summit-e3d01.firebasestorage.app",
  messagingSenderId: "966124813067",
  appId: "1:966124813067:web:324947708616e19451400e",
};

export const firebaseConfigured = !firebaseConfig.apiKey.startsWith("PASTE");

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Memory cache only: admin, broadcast and preview tabs often share one browser,
// and the persistent cache's single-tab lock would fight over that.
export const db = getFirestore(app);
