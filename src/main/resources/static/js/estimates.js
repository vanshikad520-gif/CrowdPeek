const HOURS = [0, 6, 9, 12, 15, 18, 21, 24];
const CURVES = {
  park: [8, 10, 28, 48, 45, 32, 18, 8],
  shopping: [5, 6, 18, 38, 52, 78, 60, 5],
  library: [2, 3, 26, 56, 48, 22, 5, 2],
  hospital: [12, 35, 82, 72, 62, 44, 28, 12],
  transport: [15, 18, 60, 45, 38, 68, 52, 15],
  food: [3, 3, 12, 28, 44, 72, 48, 3],
  tourism: [4, 5, 32, 58, 52, 31, 12, 4],
  other: [8, 10, 28, 42, 44, 48, 26, 8]
};

function categoryCurve(category) {
  const value = String(category || "").toLocaleLowerCase();
  if (/park|garden|leisure|natural|nature/.test(value)) return CURVES.park;
  if (/shop|mall|market|commercial/.test(value)) return CURVES.shopping;
  if (/library|school|college|university|education/.test(value)) return CURVES.library;
  if (/hospital|clinic|health|pharmacy/.test(value)) return CURVES.hospital;
  if (/transport|station|bus|railway|airport/.test(value)) return CURVES.transport;
  if (/restaurant|cafe|bar|fast_food|food/.test(value)) return CURVES.food;
  if (/tourism|museum|attraction|hotel|historic/.test(value)) return CURVES.tourism;
  return CURVES.other;
}

export function estimateCrowd(category, date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60;
  const curve = categoryCurve(category);
  const index = HOURS.findIndex((start, position) => hour >= start && hour <= HOURS[position + 1]);
  const segment = Math.max(0, Math.min(HOURS.length - 2, index));
  const proportion = (hour - HOURS[segment]) / (HOURS[segment + 1] - HOURS[segment]);
  return Math.round(curve[segment] + (curve[segment + 1] - curve[segment]) * proportion);
}
