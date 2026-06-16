import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, increment } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDTmS96KCL6IzAL7onJvtEsqSB7htjEyNI",
  authDomain: "evenight-cloud.firebaseapp.com",
  projectId: "evenight-cloud",
  storageBucket: "evenight-cloud.firebasestorage.app",
  messagingSenderId: "357661488366",
  appId: "1:357661488366:web:cf19e6e9500667106b2fff",
  measurementId: "G-Q4NJMVRS12"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export const trackVisitor = async () => {
  const sessionKey = 'evenight_visit_tracked_gateoftoon';
  if (sessionStorage.getItem(sessionKey)) return;

  try {
    const docRef = doc(db, 'site_stats', 'gate-of-toon');
    await setDoc(docRef, { visit_count: increment(1) }, { merge: true });
    sessionStorage.setItem(sessionKey, 'true');
  } catch (error) {
    console.error("Failed to track visitor count:", error);
  }
};
