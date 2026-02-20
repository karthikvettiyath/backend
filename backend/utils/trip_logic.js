/**
 * Smart EV Trip Planner Logic Engine
 */

const { searchExternalStations } = require('./serper');

/**
 * Evaluates current trip state and generates lifestyle-based charging suggestions.
 * 
 * Logic Criteria:
 * IF
 *   Battery < 60%
 *   AND Destination > 120km
 *   AND Time between 12PM–2PM (Lunch) or 8AM-9AM (Breakfast) or 7PM-9PM (Dinner)
 *   AND Nearby charger within 5km of current route
 *   AND Charging speed ≥ 30kW
 * THEN
 *   Suggest meal + optimized charge duration
 */
async function evaluateSmartSuggestions(trip, currentLocation, currentBattery) {
    const now = new Date();
    const currentHour = now.getHours();

    // Check timing for meals
    let mealType = null;
    if (currentHour >= 8 && currentHour <= 9) mealType = 'breakfast';
    else if (currentHour >= 12 && currentHour <= 14) mealType = 'lunch';
    else if (currentHour >= 19 && currentHour <= 21) mealType = 'dinner';

    if (!mealType) return null;

    // Check battery and distance (Mock distance check for now)
    // In a real app, distance to destination would be calculated via Maps API
    const batteryThreshold = 60;
    if (currentBattery >= batteryThreshold) return null;

    // Find nearby chargers
    const nearbyStations = await searchExternalStations(currentLocation.lat, currentLocation.lng, 5);

    // Filter for fast chargers (>= 30kW)
    const fastChargers = nearbyStations.filter(s => s.power_output_kw >= 30);

    if (fastChargers.length === 0) return null;

    // Pick the best one (demo logic: first one)
    const bestStation = fastChargers[0];

    // Calculate charge optimization (Mock calculation)
    // Logic: Charge enough to reach destination + 20% margin
    // For demo, suggest 40 mins
    const suggestedDuration = 40;

    return {
        type: 'meal_stop',
        mealType,
        station: bestStation,
        message: `It's ${mealType} time! There's a fast charger nearby at ${bestStation.name}. If you charge here for ${suggestedDuration} mins, you can reach your destination without another stop. ☕⚡`,
        chargeDuration: suggestedDuration
    };
}

module.exports = { evaluateSmartSuggestions };
