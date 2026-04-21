import { CAESAREA, CITIES } from './cities';

// Haversine formula — distance in km between two lat/lng points
function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

export function getCityCoords(cityName) {
  return CITIES.find((c) => c.name === cityName) || null;
}

/**
 * Given a driver's origin and a seeker's origin,
 * return match quality: 'excellent' | 'good' | 'possible' | null
 *
 * Logic: if picking up the seeker adds ≤ X% to the driver's trip, it's a match.
 */
export function getMatchQuality(driverCityName, seekerCityName) {
  if (driverCityName === seekerCityName) return 'excellent';

  const driver = getCityCoords(driverCityName);
  const seeker = getCityCoords(seekerCityName);
  if (!driver || !seeker) return null;

  const directDist = haversine(driver, CAESAREA);
  const withPickupDist = haversine(driver, seeker) + haversine(seeker, CAESAREA);
  const ratio = withPickupDist / directDist;

  if (ratio <= 1.08) return 'excellent'; // virtually on the way
  if (ratio <= 1.20) return 'good';      // minor detour
  if (ratio <= 1.40) return 'possible';  // doable detour
  return null;
}

export const MATCH_LABELS = {
  excellent: { text: 'בדרך ממש!', color: '#22c55e', emoji: '🎯' },
  good:      { text: 'עם סטייה קטנה', color: '#84cc16', emoji: '✅' },
  possible:  { text: 'אפשרי', color: '#eab308', emoji: '🔄' },
};

/**
 * Find all matches for a given post from the list of all posts.
 * Returns array of { post, quality } sorted by quality.
 */
export function findMatches(post, allPosts) {
  const opposite = post.type === 'offering' ? 'seeking' : 'offering';
  const matches = [];

  for (const other of allPosts) {
    if (other.id === post.id) continue;
    if (other.type !== opposite) continue;

    const driverCity = post.type === 'offering' ? post.from : other.from;
    const seekerCity = post.type === 'offering' ? other.from : post.from;

    const quality = getMatchQuality(driverCity, seekerCity);
    if (quality) {
      matches.push({ post: other, quality });
    }
  }

  const order = { excellent: 0, good: 1, possible: 2 };
  return matches.sort((a, b) => order[a.quality] - order[b.quality]);
}
