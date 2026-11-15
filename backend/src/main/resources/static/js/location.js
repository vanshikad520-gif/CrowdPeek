import { REQUIRE_LOCATION_FOR_REPORTS } from "./config.js";

const LOCATION_ERROR = "We need your location to verify your report. Allow location access and try again.";

function distanceMeters(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(secondLatitude - firstLatitude);
  const longitudeDelta = radians(secondLongitude - firstLongitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(firstLatitude)) * Math.cos(radians(secondLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function distanceText(distance) {
  if (distance < 1000) return `${Math.round(distance / 10) * 10} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

export function verifyReportLocation(latitude, longitude) {
  if (!REQUIRE_LOCATION_FOR_REPORTS) return Promise.resolve({ verified: false });
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || !navigator.geolocation) {
    return Promise.resolve({ verified: false, message: LOCATION_ERROR });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition((position) => {
      const distance = distanceMeters(
        position.coords.latitude,
        position.coords.longitude,
        Number(latitude),
        Number(longitude)
      );
      if (distance <= 300) {
        resolve({ verified: true });
        return;
      }
      resolve({
        verified: false,
        message: `You seem to be about ${distanceText(distance)} away. Reports can only be sent from within 300 m of the place.`
      });
    }, () => {
      resolve({ verified: false, message: LOCATION_ERROR });
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  });
}
