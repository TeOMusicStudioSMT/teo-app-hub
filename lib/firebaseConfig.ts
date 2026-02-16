import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Configuration for the TeO App HUB Firebase project
const firebaseConfig = {
    apiKey: "AIzaSyBmaobBqWXQZ-sZQsvzc2Phoz4ebShHQzQ",
    authDomain: "projekt-poc-6f03b.firebaseapp.com",
    projectId: "projekt-poc-6f03b",
    storageBucket: "projekt-poc-6f03b.firebasestorage.app",
    messagingSenderId: "457528627948",
    appId: "1:457528627948:web:167076b08e80dfbafd8bc9",
    measurementId: "G-1DZ7PZES3R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, auth, db, analytics };