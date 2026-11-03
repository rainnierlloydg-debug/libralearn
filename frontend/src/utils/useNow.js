import { useEffect, useState } from 'react';

// Refresh due-date indicators and greetings even when the page stays open.
export default function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  return now;
}
