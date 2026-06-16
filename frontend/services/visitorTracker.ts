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

const getKstDateStrings = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';
  return {
    dailyKey: `${year}-${month}-${day}`,
    monthlyKey: `${year}-${month}`
  };
};

export const trackVisitor = async () => {
  const sessionKey = 'evenight_visit_tracked_gateoftoon';
  if (sessionStorage.getItem(sessionKey)) return;

  try {
    const { dailyKey, monthlyKey } = getKstDateStrings();
    const docRefTotal = doc(db, 'site_stats', 'gate-of-toon');
    const docRefDaily = doc(db, 'site_stats', `gate-of-toon_daily_${dailyKey}`);
    const docRefMonthly = doc(db, 'site_stats', `gate-of-toon_monthly_${monthlyKey}`);

    await Promise.all([
      setDoc(docRefTotal, { visit_count: increment(1) }, { merge: true }),
      setDoc(docRefDaily, { visit_count: increment(1) }, { merge: true }),
      setDoc(docRefMonthly, { visit_count: increment(1) }, { merge: true })
    ]);

    sessionStorage.setItem(sessionKey, 'true');
  } catch (error) {
    console.error("Failed to track visitor count:", error);
  }
};
