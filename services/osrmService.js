/**
 * OSRM Routing Service
 * Fetches driving routes from OSRM public server
 * Modular: swap OSRM_BASE_URL for any compatible routing provider
 */

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'http://router.project-osrm.org';

/**
 * Get driving route between two points
 * @param {number} originLng - Origin longitude
 * @param {number} originLat - Origin latitude
 * @param {number} destLng - Destination longitude
 * @param {number} destLat - Destination latitude
 * @returns {Object} { distanceKm, durationMin, geometry, polyline }
 */
async function getRoute(originLng, originLat, destLng, destLat) {
  const coordinates = `${originLng},${originLat};${destLng},${destLat}`;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OSRM request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error('No route found between the given locations');
  }

  const route = data.routes[0];

  return {
    distanceKm: Math.round(route.distance / 1000 * 10) / 10, // meters → km, 1 decimal
    durationMin: Math.ceil(route.duration / 60), // seconds → minutes, rounded up
    geometry: route.geometry, // GeoJSON LineString
    steps: route.legs[0]?.steps?.map(s => ({
      instruction: s.maneuver?.type || '',
      name: s.name || '',
      distance: s.distance,
      duration: s.duration,
    })) || [],
  };
}

/**
 * Calculate straight-line (haversine) distance as fallback
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in km
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Get route with fallback to haversine
 */
async function getRouteWithFallback(originLng, originLat, destLng, destLat) {
  try {
    return await getRoute(originLng, originLat, destLng, destLat);
  } catch (err) {
    console.warn('OSRM unavailable, using haversine fallback:', err.message);
    const distKm = haversineDistance(originLat, originLng, destLat, destLng);
    const estMinutes = Math.ceil(distKm * 2.5); // rough: ~24 km/h avg city speed
    return {
      distanceKm: distKm,
      durationMin: estMinutes,
      geometry: null,
      steps: [],
      fallback: true,
    };
  }
}

module.exports = { getRoute, getRouteWithFallback, haversineDistance };
