/* KinderGuide settings.
   GOOGLE_PLACES_KEY: leave empty to show only a "Read reviews on Google Maps" link.
   To switch on live Google ratings and reviews, the team creates a key in Google Cloud
   (Places API (New), restricted to this website's address, with a daily quota) and pastes it here.
   Only Google place IDs are stored (in the visitor's browser), as Google's policy allows. */
const CONFIG = {
  GOOGLE_PLACES_KEY: '',
  MATCH_MAX_METRES: 150,     // Google location must be this close to ours
  MATCH_MIN_NAME: 0.5,       // name similarity needed (0 to 1)
};
