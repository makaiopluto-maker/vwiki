"use client";

import { getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAsyJ0Dsa0ieTuISXUaqjZV3VF1Mo_PP0g",
  authDomain: "vwiki-info.firebaseapp.com",
  projectId: "vwiki-info",
  storageBucket: "vwiki-info.firebasestorage.app",
  messagingSenderId: "224998939293",
  appId: "1:224998939293:web:cee43919fa1225cc2e5274",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
