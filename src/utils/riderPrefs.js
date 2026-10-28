import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@sticky_rider';
export const STICKY_RIDER_ORDERS = 5;

export async function getStickyRider() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.remaining > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * After saving an order: if the same rider is kept, their sticky slot counts
 * down; choosing a new rider makes them the sticky one for the next orders.
 */
export async function applyStickyRiderAfterSave(riderName) {
  const name = (riderName || '').trim();
  if (!name) return null;

  const current = await getStickyRider();
  let next;
  if (current && current.name.toLowerCase() === name.toLowerCase()) {
    const remaining = current.remaining - 1;
    next = remaining > 0 ? { name: current.name, remaining } : null;
  } else {
    next = { name, remaining: STICKY_RIDER_ORDERS };
  }

  try {
    if (next) {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(KEY);
    }
  } catch {
    // sticky rider is best-effort; orders still save fine
  }
  return next;
}

export async function clearStickyRider() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
