import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAJMpwSTmO_TyVoFpOvepFkdaAC53qG0eY",
  authDomain: "app-lu-das-marmitas.firebaseapp.com",
  projectId: "app-lu-das-marmitas",
  storageBucket: "app-lu-das-marmitas.firebasestorage.app",
  messagingSenderId: "187968363139",
  appId: "1:187968363139:web:475b4181a58c35c74619b6",
  measurementId: "G-669VBRB86L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (e) {
        console.warn("Analytics not initialized:", e);
      }
    }
  }).catch(() => {});
}

