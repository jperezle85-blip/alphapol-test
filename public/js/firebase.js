// Conexión con Firebase (login + base de datos).
// Esta configuración NO es secreta: es la dirección pública del proyecto.
// La seguridad real está en las reglas de Firestore (firestore.rules).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDt_6P6p0qtzAppw_2zuboss2kIF5Foxyo",
  authDomain: "alphapol-4fa0e.firebaseapp.com",
  projectId: "alphapol-4fa0e",
  storageBucket: "alphapol-4fa0e.firebasestorage.app",
  messagingSenderId: "430499282760",
  appId: "1:430499282760:web:904a90b94b7a202a3a7d7d",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = "es"; // emails de Firebase en español
export const db = getFirestore(app);

// Email del primer profesor. Solo esta cuenta puede crearse a sí misma
// el perfil de profesor la primera vez que entra (ver firestore.rules).
export const PROFESOR_INICIAL = "jperezle85@gmail.com";

export {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
};
