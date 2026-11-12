const FAVORITES_KEY = "cp_favorites";

export function getFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    if (!Array.isArray(saved)) throw new Error("Saved places were not stored as a list.");
    return [...new Set(saved.filter((id) => typeof id === "string"))];
  } catch (error) {
    console.error("Could not read saved places.", error);
    return [];
  }
}

export function isFavorite(placeId) {
  return getFavorites().includes(String(placeId));
}

export function toggleFavorite(placeId) {
  const id = String(placeId);
  const favorites = getFavorites();
  const index = favorites.indexOf(id);
  const saved = index === -1;
  if (saved) favorites.push(id);
  else favorites.splice(index, 1);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  return saved;
}

export function favoriteButtonMarkup(placeId, saved, className = "favorite-toggle") {
  const safeId = encodeURIComponent(String(placeId)).replace(/"/g, "%22");
  return `<button class="${className}" type="button" data-favorite-id="${safeId}" aria-pressed="${String(saved)}" aria-label="${saved ? "Remove from saved places" : "Save place"}">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>
    <span>${saved ? "Saved" : "Save"}</span>
  </button>`;
}
