import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Din Firebase-konfiguration
// Hämta aktuella nycklar från Firebase Console > Projektinställningar
const firebaseConfig = {
  apiKey: "AIzaSyC1mw54gOXrK4KH0_MnQFIur6jOIKb9JPY",
  authDomain: "newss-436717.firebaseapp.com",
  projectId: "newss-436717",
  storageBucket: "newss-436717.firebasestorage.app",
  messagingSenderId: "400816870138",
  appId: "1:400816870138:web:42c0e6de6d5fd218226f43"
};

// Initialisera Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, storage, auth, googleProvider }; 