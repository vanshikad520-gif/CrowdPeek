const PLACES = [
  { id: "sukhna-lake", name: "Sukhna Lake", category: "Parks", sector: "Sector 1", latitude: 30.7421, longitude: 76.8188, hourly: [16, 20, 28, 45, 68, 82, 74, 52], weekend: [26, 32, 42, 60, 82, 94, 88, 64] },
  { id: "rock-garden", name: "Rock Garden", category: "Parks", sector: "Sector 1", latitude: 30.7525, longitude: 76.8107, hourly: [24, 32, 48, 62, 58, 46, 32, 18], weekend: [34, 44, 60, 74, 70, 62, 48, 30] },
  { id: "rose-garden", name: "Rose Garden", category: "Parks", sector: "Sector 16", latitude: 30.7420, longitude: 76.7820, hourly: [12, 22, 42, 52, 48, 36, 25, 15], weekend: [22, 34, 54, 64, 60, 48, 38, 25] },
  { id: "leisure-valley", name: "Leisure Valley", category: "Parks", sector: "Sector 10", latitude: 30.7366, longitude: 76.7894, hourly: [18, 25, 37, 49, 58, 55, 42, 26], weekend: [28, 38, 50, 62, 72, 70, 56, 38] },
  { id: "elante-mall", name: "Elante Mall", category: "Shopping", sector: "Industrial Area Phase 1", latitude: 30.7057, longitude: 76.8010, hourly: [12, 18, 26, 39, 55, 76, 88, 72], weekend: [24, 34, 44, 58, 75, 92, 98, 86] },
  { id: "sector-17-plaza", name: "Sector 17 Plaza", category: "Shopping", sector: "Sector 17", latitude: 30.7408, longitude: 76.7827, hourly: [15, 24, 38, 52, 66, 72, 58, 34], weekend: [27, 38, 52, 68, 82, 88, 74, 50] },
  { id: "pu-library", name: "Panjab University Library", category: "Library", sector: "Sector 14", latitude: 30.7602, longitude: 76.7686, hourly: [24, 38, 55, 72, 68, 51, 32, 14], weekend: [19, 28, 40, 52, 50, 38, 24, 10] },
  { id: "pgimer-opd", name: "PGIMER OPD", category: "Hospital", sector: "Sector 12", latitude: 30.7646, longitude: 76.7757, hourly: [72, 88, 80, 62, 52, 44, 38, 26], weekend: [66, 78, 70, 52, 42, 36, 32, 22] },
  { id: "isbt-sector-17", name: "ISBT Sector 17", category: "Transport", sector: "Sector 17", latitude: 30.7364, longitude: 76.7785, hourly: [35, 50, 62, 56, 48, 55, 72, 66], weekend: [39, 54, 66, 61, 55, 61, 78, 72] },
  { id: "railway-station", name: "Chandigarh Railway Station", category: "Transport", sector: "Sector 17", latitude: 30.6817, longitude: 76.8144, hourly: [42, 56, 48, 40, 46, 58, 74, 60], weekend: [46, 61, 53, 45, 51, 63, 79, 66] }
];

const HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
const REPORTS_KEY = "crowdpeek.mockReports";
const REPORT_COUNTS = [68, 34, 28, 21, 76, 45, 18, 92, 83, 57];

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function storedReports() {
  try {
    const data = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Could not read saved demo reports.", error);
    return [];
  }
}

function interpolate(profile, hour) {
  if (hour <= HOURS[0]) return profile[0];
  if (hour >= HOURS[HOURS.length - 1]) return profile[profile.length - 1];
  const index = HOURS.findIndex((start, i) => hour >= start && hour <= HOURS[i + 1]);
  const fraction = (hour - HOURS[index]) / (HOURS[index + 1] - HOURS[index]);
  return Math.round(profile[index] + (profile[index + 1] - profile[index]) * fraction);
}

function hourLabel(hour) {
  const normalized = hour % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 || 12;
  return `${display} ${suffix}`;
}

function asPeriod(hour) {
  return hourLabel(hour);
}

function currentDayType() {
  const day = new Date().getDay();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

function dayCurve(place, dayType) {
  return dayType === "weekend" ? place.weekend : place.hourly;
}

function placeWithCurrent(place) {
  const now = new Date();
  const currentHour = Math.min(22, Math.max(8, now.getHours() + now.getMinutes() / 60));
  const reports = storedReports();
  const todayReports = reports.filter((report) => report.placeId === place.id && report.dateKey === todayKey()).length;
  const recentReports = reports
    .map((report) => {
      const elapsed = now.getTime() - new Date(report.createdAt).getTime();
      return { report, ageMinutes: elapsed / 60000 };
    })
    .filter(({ report, ageMinutes }) => report.placeId === place.id && ageMinutes >= 0 && ageMinutes <= 180);
  const profileCrowd = interpolate(dayCurve(place, currentDayType()), currentHour);
  const weightedReports = recentReports
    .map(({ report, ageMinutes }) => {
      const storedLevel = Number(report.crowdLevel);
      const level = Number.isInteger(storedLevel) && storedLevel >= 1 && storedLevel <= 5
        ? storedLevel * 20
        : storedLevel;
      const weight = Math.pow(0.5, ageMinutes / 30) * (report.verified === true ? 1.5 : 1);
      return { level, weight };
    })
    .filter(({ level, weight }) => Number.isFinite(level) && Number.isFinite(weight));
  const reportWeight = weightedReports.reduce((sum, report) => sum + report.weight, 0);
  const reportAverage = reportWeight
    ? weightedReports.reduce((sum, report) => sum + report.level * report.weight, 0) / reportWeight
    : null;
  const crowd = reportAverage === null
    ? profileCrowd
    : Math.round(recentReports.length >= 3 ? reportAverage : (profileCrowd + reportAverage) / 2);
  return {
    ...place,
    crowd,
    reportsInLast3Hours: recentReports.length,
    updatedMinutes: [3, 4, 6, 2, 5, 8, 7, 2, 5, 4][PLACES.findIndex((item) => item.id === place.id)],
    reportsToday: Math.max(1, REPORT_COUNTS[PLACES.findIndex((item) => item.id === place.id)] + todayReports)
  };
}

export function listPlaces(query = "", category = "") {
  const normalized = query.trim().toLocaleLowerCase();
  return PLACES.filter((place) => {
    const matchesQuery = !normalized || `${place.name} ${place.sector} ${place.category}`.toLocaleLowerCase().includes(normalized);
    return matchesQuery && (!category || place.category === category);
  }).map(placeWithCurrent);
}

export function findPlace(id) {
  const place = PLACES.find((item) => item.id === String(id));
  return place ? placeWithCurrent(place) : null;
}

export function currentCrowd(id) {
  const place = findPlace(id);
  if (!place) return null;
  const confidence = place.reportsInLast3Hours >= 10 ? "High" : place.reportsInLast3Hours >= 3 ? "Medium" : "Low";
  const verifiedReportsToday = storedReports().filter((report) =>
    report.placeId === String(id) && report.dateKey === todayKey() && report.verified === true
  ).length;
  return {
    crowd: place.crowd,
    reportsToday: place.reportsToday,
    reportsInLast3Hours: place.reportsInLast3Hours,
    verifiedReportsToday,
    confidence,
    updatedMinutes: place.updatedMinutes,
    updatedAt: new Date(Date.now() - place.updatedMinutes * 60000).toISOString()
  };
}

export function crowdStatus(value) {
  if (value <= 20) return { level: 0, label: "Very quiet" };
  if (value <= 40) return { level: 1, label: "Quiet" };
  if (value <= 60) return { level: 2, label: "Moderate" };
  if (value <= 80) return { level: 3, label: "Busy" };
  return { level: 4, label: "Very crowded" };
}

export function history(id, dayType = currentDayType()) {
  const place = PLACES.find((item) => item.id === String(id));
  if (!place) return null;
  const nowHour = new Date().getHours();
  const values = dayCurve(place, dayType);
  return {
    labels: HOURS.map(asPeriod),
    values,
    currentIndex: HOURS.reduce((best, hour, index) => Math.abs(hour - nowHour) < Math.abs(HOURS[best] - nowHour) ? index : best, 0)
  };
}

export function bestTime(id, dayType = currentDayType()) {
  const place = PLACES.find((item) => item.id === String(id));
  if (!place) return null;
  const sorted = dayCurve(place, dayType).map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const quiet = sorted[0];
  const busiest = sorted[sorted.length - 1];
  const moderate = sorted.find((item) => item.value >= 41 && item.value <= 60) || sorted[Math.floor(sorted.length / 2)];
  const windowFor = (index) => `${hourLabel(HOURS[index])}–${hourLabel(HOURS[index] + 2)}`;
  const row = (period, data) => ({
    period,
    window: windowFor(data.index),
    min: Math.max(0, data.value - 5),
    max: Math.min(100, data.value + 5),
    crowd: data.value
  });
  return [row("Quietest", quiet), row("Moderate", moderate), row("Busiest", busiest)];
}

export function createReport(placeId, level, user, verified = false) {
  if (!PLACES.some((place) => place.id === String(placeId))) throw new Error("This place could not be found.");
  const reports = storedReports();
  const cutoff = Date.now() - 30 * 60 * 1000;
  const recentlyReported = reports.some((report) => report.placeId === String(placeId) && report.userEmail === user.email && new Date(report.createdAt).getTime() > cutoff);
  if (recentlyReported) {
    const error = new Error("You have already reported this place recently. Please try again later.");
    error.status = 409;
    throw error;
  }
  const report = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    placeId: String(placeId),
    crowdLevel: Number(level),
    verified: Boolean(verified),
    userEmail: user.email,
    createdAt: new Date().toISOString(),
    dateKey: todayKey()
  };
  reports.unshift(report);
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch (error) {
    console.error("Could not save demo report.", error);
    throw new Error("Your report could not be saved in this browser. Please try again.");
  }
  return report;
}

export function listOsmReports(osmKey) {
  return storedReports()
    .filter((report) => report.osmKey === String(osmKey))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(({ crowdLevel, createdAt, verified }) => ({ crowdLevel, createdAt, verified: verified === true }));
}

export function createOsmReport(osmKey, placeDetails, level, user, verified = false) {
  if (!/^node\/\d+$|^way\/\d+$|^relation\/\d+$/.test(String(osmKey))) {
    throw new Error("This OpenStreetMap place could not be identified.");
  }
  const reports = storedReports();
  const cutoff = Date.now() - 30 * 60 * 1000;
  const recentlyReported = reports.some((report) => report.osmKey === String(osmKey)
    && report.userEmail === user.email && new Date(report.createdAt).getTime() > cutoff);
  if (recentlyReported) {
    const error = new Error("You have already reported this place recently. Please try again later.");
    error.status = 409;
    throw error;
  }
  const report = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    placeId: `osm-${String(osmKey).replace("/", "-")}`,
    osmKey: String(osmKey),
    placeName: String(placeDetails.name || "OpenStreetMap place"),
    crowdLevel: Number(level),
    verified: Boolean(verified),
    userEmail: user.email,
    createdAt: new Date().toISOString(),
    dateKey: todayKey()
  };
  reports.unshift(report);
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch (error) {
    console.error("Could not save demo report.", error);
    throw new Error("Your report could not be saved in this browser. Please try again.");
  }
  return report;
}

export function myReports(user) {
  return storedReports()
    .filter((report) => report.userEmail === user.email)
    .map((report) => ({ ...report, place: PLACES.find((place) => place.id === report.placeId) || null }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function registerUser(name, email) {
  return { token: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`, user: { name: name.trim(), email: email.trim().toLowerCase() } };
}

export function demoLogin(email) {
  const normalized = email.trim().toLowerCase();
  const name = normalized.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { token: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`, user: { name: name || "CrowdPeek user", email: normalized } };
}
