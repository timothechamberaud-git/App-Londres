export default ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_API_KEY
      }
    },
    android: {
      ...config.android,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_API_KEY
        }
      }
    }
  };
};
