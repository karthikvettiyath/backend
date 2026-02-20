const axios = require('axios');

/**
 * Serper API Utility for ElectroSpot
 * Fetches real-time EV charging station data from Google Places via Serper.dev
 */

/**
 * Search for EV charging stations near a location
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {number} radius Radius in km (Serper uses location bias mostly)
 * @returns {Promise<Array>} Array of stations in ElectroSpot format
 */
async function searchExternalStations(latitude, longitude, radius = 10) {
    const SERPER_API_KEY = process.env.SERPER_API_KEY;

    if (!SERPER_API_KEY) {
        console.warn('⚠️ SERPER_API_KEY not configured. Skipping external search.');
        return [];
    }

    try {
        // Serper Places API works best with coordinate strings to force location bias
        const data = JSON.stringify({
            "q": "EV Charging Station",
            "location": `${latitude}, ${longitude}, Kerala, India`,
            "gl": "in"
        });

        const config = {
            method: 'post',
            url: 'https://google.serper.dev/places',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            data: data
        };

        const response = await axios(config);
        const places = response.data.places || [];

        // Map Serper/Google Places data to ElectroSpot station schema
        return places.map(place => ({
            id: `ext_${place.cid || Math.random().toString(36).substr(2, 9)}`,
            name: place.title || 'Unknown Station',
            address: place.address || 'Address not available',
            latitude: parseFloat(place.latitude),
            longitude: parseFloat(place.longitude),
            status: 'available',
            connector_type: 'CCS2',
            power_output_kw: 50.0,
            price_per_kwh: 0,
            is_external: true,
            rating: place.rating,
            reviews: place.ratingCount
        }));
    } catch (error) {
        console.error('❌ Serper API error:', error.message);
        return [];
    }
}

module.exports = { searchExternalStations };
