import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCq1LP6CTRXB17pj_z8pqyoGLPb6uLsPt8",
  authDomain: "playoffs-aa98e.firebaseapp.com",
  projectId: "playoffs-aa98e",
  storageBucket: "playoffs-aa98e.firebasestorage.app",
  messagingSenderId: "119921503177",
  appId: "1:119921503177:web:9edf03309cad85afe85618",
  measurementId: "G-456BW898V7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
