import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB2z5UZ-sVBcAqbmMTwPGefE516-nv6Y2I",
  authDomain: "jimbo-trampin.firebaseapp.com",
  projectId: "jimbo-trampin",
  storageBucket: "jimbo-trampin.firebasestorage.app",
  messagingSenderId: "901778295914",
  appId: "1:901778295914:web:e4422ada6dea12e0ce0e13",
  measurementId: "G-YXCTYT4Z4Z",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
