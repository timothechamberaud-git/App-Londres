import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, ScrollView, Dimensions, TextInput, TouchableOpacity, Alert, Modal, Image } from 'react-native';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import { useAgenda } from './AgendaContext';

const { width, height } = Dimensions.get('window');

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || '';

export default function Dashboard() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [fatigue, setFatigue] = useState<number>(5); // 1 = Very energetic, 10 = Exhausted
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<any[]>([]);
  const [mode, setMode] = useState<'chill' | 'culture'>('chill');
  const [budget, setBudget] = useState<number>(1); // 0 = Gratuit, 1 = Eco, 2 = Standard, 3 = Plaisir
  const [vibe, setVibe] = useState<'tourist' | 'secret'>('tourist');
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [routeMode, setRouteMode] = useState<'WALK' | 'TRANSIT'>('WALK');
  const { items } = useAgenda();
  
  // Decode encoded polyline from Google Routes API
  const decodePolyline = (encoded: string) => {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      points.push({ latitude: (lat / 1E5), longitude: (lng / 1E5) });
    }
    return points;
  };
  
  // Clé API Gemini (L'utilisateur a fourni cette clé, bien qu'elle ne commence pas par AIzaSy)
  const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

  const generateItinerary = async () => {
    try {
      if (!location) {
        Alert.alert("Erreur de Localisation", "La position GPS n'est pas chargée.");
        return;
      }
      if (!places || places.length === 0) {
        Alert.alert("Erreur de Lieux", "La liste des lieux est vide.");
        return;
      }
      
      const destination = places[0]; 
      if (!destination || !destination.lat || !destination.lon) {
        Alert.alert("Erreur de Données", "Le lieu recommandé n'a pas de coordonnées valides.");
        return;
      }

      const originBody = {
        location: { latLng: { latitude: location.coords.latitude, longitude: location.coords.longitude } }
      };
      const destBody = {
        location: { latLng: { latitude: destination.lat, longitude: destination.lon } }
      };

      const fetchRoute = async (mode: string) => {
        const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
          },
          body: JSON.stringify({
            origin: originBody,
            destination: destBody,
            travelMode: mode
          })
        });
        return await res.json();
      };

      const transitData = await fetchRoute('TRANSIT');
      const walkData = await fetchRoute('WALK');

      if (transitData.error && walkData.error) {
        Alert.alert("Google API Erreur", `Active 'Routes API' sur Google Cloud.\nErreur: ${transitData.error.message}`);
        return;
      }

      let transitTime = 999999;
      let walkTime = 999999;
      let transitText = "";
      let walkText = "";

      if (transitData.routes && transitData.routes.length > 0) {
        const dur = transitData.routes[0].duration || "0s";
        transitTime = parseInt(dur.replace('s', ''), 10);
        transitText = `${Math.round(transitTime / 60)} min`;
      }
      
      if (walkData.routes && walkData.routes.length > 0) {
        const dur = walkData.routes[0].duration || "0s";
        walkTime = parseInt(dur.replace('s', ''), 10);
        walkText = `${Math.round(walkTime / 60)} min`;
      }

      let bestModeText = walkTime <= transitTime ? "à pied 🚶" : "en transports 🚇";
      let bestTime = walkTime <= transitTime ? walkText : transitText;

      let bestRouteData = walkTime <= transitTime ? walkData : transitData;
      setRouteMode(walkTime <= transitTime ? 'WALK' : 'TRANSIT');
      
      if (bestRouteData.routes && bestRouteData.routes.length > 0 && bestRouteData.routes[0].polyline) {
        const encoded = bestRouteData.routes[0].polyline.encodedPolyline;
        setRouteCoordinates(decodePolyline(encoded));
      } else {
        setRouteCoordinates([]);
      }

      const todayEvents = items['2026-08-17'] || [];
      const nextEvent = todayEvents.length > 0 ? todayEvents[0] : null;
      let nextEventText = nextEvent ? `${nextEvent.time} - ${nextEvent.name}` : 'Aucun (quartier libre !)';

      setAiModalVisible(true);
      setIsAiLoading(true);
      setAiResponse("Ton pote IA réfléchit au meilleur plan pour toi... 🤔");

      // Fetch Weather
      let weatherText = "Météo inconnue";
      try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&current_weather=true`);
        const weatherData = await weatherRes.json();
        if (weatherData && weatherData.current_weather) {
          const code = weatherData.current_weather.weathercode;
          const temp = weatherData.current_weather.temperature;
          if (code <= 3) weatherText = `Plutôt clair / nuageux, ${temp}°C`;
          else if (code >= 51 && code <= 67) weatherText = `Il pleut, ${temp}°C`;
          else if (code >= 71 && code <= 77) weatherText = `Il neige, ${temp}°C`;
          else weatherText = `Grisaille londonienne typique, ${temp}°C`;
        }
      } catch(e) {
        console.error("Erreur Météo", e);
      }

      // Call Gemini API
      const prompt = `Tu es mon pote étudiant de confiance à Londres. Parle-moi de manière familière, sympa et cool, comme un vrai pote.
Voici ma situation actuelle :
- Je suis à Londres et j'ai besoin d'un plan pour ma prochaine sortie.
- Ma jauge de fatigue est de ${fatigue}/10 (1=en pleine forme, 10=épuisé).
- Mon budget : ${budget === 0 ? 'Gratuit' : budget === 1 ? 'Pas cher' : budget === 2 ? 'Moyen' : 'Plaisir'}.
- Je recherche une ambiance : ${vibe === 'secret' ? 'Lieu secret / local' : 'Touristique / populaire'}.
- Le lieu que l'algorithme a trouvé pour moi est : ${destination.name} (${destination.type}).
- Météo actuelle à Londres : ${weatherText}.
- Temps de trajet estimé pour y aller : ${bestTime} ${bestModeText}.
- Mon prochain impératif dans mon agenda est : ${nextEventText}.

Ta mission :
1. Donne-moi ton avis très court sur "${destination.name}" et pourquoi c'est un bon choix vu mon niveau de fatigue et mon budget.
2. Dis-moi si le temps de trajet (${bestTime} ${bestModeText}) est jouable avant mon prochain impératif.
3. Propose-moi concrètement ce que je vais pouvoir y faire et combien de temps je devrais y rester (en gardant à l'esprit mon prochain impératif).
Fais court, punchy, et utilise des emojis !`;

      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const aiReq = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
        const aiData = await aiReq.json();

        if (aiData.error) {
           setAiResponse(`❌ Oups, mon cerveau d'IA a buggé.\nErreur: ${aiData.error.message}`);
        } else if (aiData.candidates && aiData.candidates.length > 0) {
           setAiResponse(aiData.candidates[0].content.parts[0].text);
        } else {
           setAiResponse("Je n'ai pas trouvé les mots pour te décrire à quel point ce plan est bien. Bug inconnu.");
        }
      } catch (aiErr: any) {
        setAiResponse(`Erreur de connexion à Gemini: ${aiErr.message}`);
      } finally {
        setIsAiLoading(false);
      }

    } catch (e: any) {
      Alert.alert("Erreur Fatale", `Impossible d'exécuter le calcul: ${e.message}`);
    }
  };

  useEffect(() => {
    (async () => {
      // Request location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      
      // FOR TESTING: Override location to OMNES Education London Campus
      setLocation({
        coords: {
          latitude: 51.518635,
          longitude: -0.152912,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      });

      // Get Battery
      const level = await Battery.getBatteryLevelAsync();
      setBatteryLevel(level);

      setLoading(false);
    })();
  }, []);

  // Fetch recommendations from Google Places API based on fatigue, battery, budget & vibe
  useEffect(() => {
    if (!location) return;

    const fetchPlaces = async () => {
      try {
        let keyword = '';

        if (mode === 'culture') {
          keyword = vibe === 'secret' ? 'hidden gem' : 'popular attraction';
        } else {
          keyword = vibe === 'secret' ? 'authentic local' : 'famous popular';
        }
        
        let type = 'tourist_attraction';
        if (mode === 'culture') {
          type = fatigue > 7 ? 'art_gallery' : 'museum';
        } else {
          if (fatigue > 7) {
            type = 'cafe';
          } else if (fatigue < 4) {
            type = 'bar';
          } else {
            type = 'restaurant';
          }
        }

        const radius = (batteryLevel !== null && batteryLevel < 0.2) ? 1000.0 : 3000.0;
        
        const url = `https://places.googleapis.com/v1/places:searchText`;
        
        let priceLevels: string[] = [];
        if (mode === 'chill') {
          // Google API ne supporte pas PRICE_LEVEL_FREE en filtre, donc on l'omet
          if (budget === 1) priceLevels = ['PRICE_LEVEL_INEXPENSIVE'];
          if (budget === 2) priceLevels = ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE'];
          if (budget === 3) priceLevels = ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'];
        }

        let queryModifier = budget === 0 ? 'free ' : '';

        const body: any = {
          textQuery: `${queryModifier}${type} ${keyword} London`,
          locationBias: {
            circle: {
              center: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
              },
              radius: radius
            }
          },
          maxResultCount: 5
        };

        if (priceLevels.length > 0) {
          body.priceLevels = priceLevels;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryType,places.priceLevel,places.location,places.photos'
          },
          body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (data.error) {
          if (data.error.status === "PERMISSION_DENIED" || data.error.code === 403) {
            Alert.alert(
              "Nouvelle API Requise", 
              "Pour que les prix marchent, tu dois activer 'Places API (New)' sur Google Cloud."
            );
          } else {
            console.error("Places API Error:", data.error);
          }
          setPlaces([]);
          return;
        }

        if (data.places && data.places.length > 0) {
          
          let results = data.places;
          // Si budget 0 et chill, on garde que les trucs vraiment pas chers car FREE n'est pas envoyé par Google
          if (mode === 'chill' && budget === 0) {
            results = results.filter((p: any) => p.priceLevel === 'PRICE_LEVEL_FREE' || p.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' || !p.priceLevel);
          }

          // Tri par prix (uniquement possible pour les Sorties car les musées n'ont pas de niveau de prix sur Google)
          if (mode === 'chill') {
            const priceOrder: any = {
              'PRICE_LEVEL_FREE': 0,
              'PRICE_LEVEL_INEXPENSIVE': 1,
              'PRICE_LEVEL_MODERATE': 2,
              'PRICE_LEVEL_EXPENSIVE': 3,
              'PRICE_LEVEL_VERY_EXPENSIVE': 4
            };
            results.sort((a: any, b: any) => {
              const priceA = priceOrder[a.priceLevel] ?? 99;
              const priceB = priceOrder[b.priceLevel] ?? 99;
              return priceA - priceB;
            });
          }

          const formattedPlaces = results.map((p: any) => {
             let priceStr = 'Prix inconnu';
             
             if (mode === 'culture') {
                priceStr = budget === 0 ? 'Gratuit' : 'Billets / Payant';
             } else {
               if (p.priceLevel === 'PRICE_LEVEL_FREE') priceStr = 'Gratuit';
               else if (p.priceLevel === 'PRICE_LEVEL_INEXPENSIVE') priceStr = '£';
               else if (p.priceLevel === 'PRICE_LEVEL_MODERATE') priceStr = '££';
               else if (p.priceLevel === 'PRICE_LEVEL_EXPENSIVE') priceStr = '£££';
               else if (p.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE') priceStr = '££££';
               else priceStr = budget === 0 ? 'Gratuit' : 'Prix inconnu';
             }
             
             return {
               id: p.id,
               name: p.displayName?.text || 'Lieu',
               type: p.primaryType ? p.primaryType.replace(/_/g, ' ') : type,
               price: priceStr,
               lat: p.location?.latitude,
               lon: p.location?.longitude,
               photoName: p.photos && p.photos.length > 0 ? p.photos[0].name : null
             };
          });
          setPlaces(formattedPlaces.slice(0, 5));
        } else {
          setPlaces([]);
        }
      } catch (error) {
        console.error("Error fetching places:", error);
      }
    };

    fetchPlaces();
  }, [fatigue, batteryLevel, location, mode, budget, vibe]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
        <Text style={styles.loadingText}>Initialisation du guide de survie étudiant...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} bounces={false}>
      {/* LLM Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={aiModalVisible}
        onRequestClose={() => setAiModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✨ Le Plan de ton Pote IA</Text>
            
            {places.length > 0 && places[0].photoName && (
              <Image 
                source={{ uri: `https://places.googleapis.com/v1/${places[0].photoName}/media?maxHeightPx=400&maxWidthPx=800&key=${GOOGLE_API_KEY}` }}
                style={styles.placeImage}
              />
            )}
            
            <ScrollView style={styles.aiResponseContainer}>
              {isAiLoading ? (
                <View style={styles.aiLoadingWrapper}>
                  <ActivityIndicator size="large" color="#FF3B30" />
                  <Text style={styles.aiLoadingText}>{aiResponse}</Text>
                </View>
              ) : (
                <Text style={styles.aiResponseText}>{aiResponse}</Text>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={styles.closeModalBtn} 
              onPress={() => setAiModalVisible(false)}
            >
              <Text style={styles.closeModalBtnText}>C'est parti ! 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🇬🇧 London Student Guide</Text>
        {batteryLevel !== null && (
          <Text style={styles.batteryText}>
            🔋 Batterie: {(batteryLevel * 100).toFixed(0)}%
          </Text>
        )}
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {location ? (
          <MapView 
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            userInterfaceStyle="dark"
          >
            <Marker 
              coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
              title="Toi"
              description="Ta position actuelle"
              pinColor="#007AFF"
            />
            {places.map(place => (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.lat, longitude: place.lon }}
                title={place.name}
                description={`${place.type} - Prix: ${place.price}`}
                pinColor="#FF3B30"
              />
            ))}
            {routeCoordinates.length > 0 && (
              <Polyline 
                coordinates={routeCoordinates}
                strokeWidth={5}
                strokeColor={routeMode === 'TRANSIT' ? "#007AFF" : "#34C759"}
                lineDashPattern={routeMode === 'WALK' ? [10, 10] : undefined}
              />
            )}
          </MapView>
        ) : (
          <Text style={styles.errorText}>Localisation indisponible.</Text>
        )}
      </View>

      {/* Controls & Recommendations */}
      <View style={styles.controlsContainer}>
        <Text style={styles.sectionTitle}>Comment te sens-tu ?</Text>
        <Text style={styles.sliderValue}>Fatigue : {fatigue}/10 (1=En forme, 10=Épuisé)</Text>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={10}
          step={1}
          value={fatigue}
          onValueChange={(val) => setFatigue(val)}
          minimumTrackTintColor="#FF3B30"
          maximumTrackTintColor="#333333"
          thumbTintColor="#FF3B30"
        />

        <View style={styles.modeContainer}>
          <Text style={styles.sectionTitle}>Budget :</Text>
          <View style={styles.toggleButtons}>
            <TouchableOpacity style={[styles.toggleBtn, budget === 0 && styles.toggleBtnActive]} onPress={() => setBudget(0)}>
              <Text style={[styles.toggleBtnText, budget === 0 && styles.toggleBtnTextActive]}>Gratuit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, budget === 1 && styles.toggleBtnActive]} onPress={() => setBudget(1)}>
              <Text style={[styles.toggleBtnText, budget === 1 && styles.toggleBtnTextActive]}>£</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, budget === 2 && styles.toggleBtnActive]} onPress={() => setBudget(2)}>
              <Text style={[styles.toggleBtnText, budget === 2 && styles.toggleBtnTextActive]}>££</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, budget === 3 && styles.toggleBtnActive]} onPress={() => setBudget(3)}>
              <Text style={[styles.toggleBtnText, budget === 3 && styles.toggleBtnTextActive]}>£££</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modeContainer}>
          <Text style={styles.sectionTitle}>Ambiance :</Text>
          <View style={styles.toggleButtons}>
            <TouchableOpacity style={[styles.toggleBtn, vibe === 'tourist' && styles.toggleBtnActive]} onPress={() => setVibe('tourist')}>
              <Text style={[styles.toggleBtnText, vibe === 'tourist' && styles.toggleBtnTextActive]}>Touristique</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, vibe === 'secret' && styles.toggleBtnActive]} onPress={() => setVibe('secret')}>
              <Text style={[styles.toggleBtnText, vibe === 'secret' && styles.toggleBtnTextActive]}>Lieux Secrets</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modeContainer}>
          <Text style={styles.sectionTitle}>
            Type d'activité :
          </Text>
          <View style={styles.toggleButtons}>
            <TouchableOpacity 
              style={[styles.toggleBtn, mode === 'chill' && styles.toggleBtnActive]}
              onPress={() => setMode('chill')}
            >
              <Text style={[styles.toggleBtnText, mode === 'chill' && styles.toggleBtnTextActive]}>Sorties</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, mode === 'culture' && styles.toggleBtnActive]}
              onPress={() => setMode('culture')}
            >
              <Text style={[styles.toggleBtnText, mode === 'culture' && styles.toggleBtnTextActive]}>Culture</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.placesList} horizontal showsHorizontalScrollIndicator={false}>
          {places.length > 0 ? (
            places.map(place => (
              <View key={place.id} style={styles.placeCard}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeInfo}>{place.type.toUpperCase()} • {place.price}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noPlacesText}>Aucun lieu trouvé pour ces filtres. Essaie d'augmenter le budget !</Text>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.generateButton} onPress={generateItinerary}>
          <Text style={styles.generateButtonText}>✨ Calculer mon itinéraire</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  generateButton: {
    backgroundColor: '#34C759',
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Dark mode background
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'System',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  batteryText: {
    color: '#34C759', // Green for battery
    fontSize: 14,
    fontWeight: '600',
  },
  mapContainer: {
    height: height * 0.45,
    width: '100%',
    backgroundColor: '#111',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  controlsContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  toggleButtons: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#FF3B30',
  },
  toggleBtnText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#FFF',
  },
  sliderValue: {
    color: '#8E8E93',
    fontSize: 14,
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  placesList: {
    marginTop: 8,
  },
  placeCard: {
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
    minWidth: 160,
    height: 100,
    justifyContent: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  placeName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  placeInfo: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  noPlacesText: {
    color: '#8E8E93',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 12,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 20,
  },
  scheduleInputContainer: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1C1C1E',
    color: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scheduleItem: {
    flexDirection: 'row',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  scheduleTime: {
    color: '#FF3B30',
    fontWeight: '700',
    marginRight: 12,
    width: 50,
  },
  scheduleTitle: {
    color: '#FFF',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    height: height * 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  placeImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 16,
  },
  aiResponseContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  aiResponseText: {
    color: '#E5E5EA',
    fontSize: 16,
    lineHeight: 24,
  },
  aiLoadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  aiLoadingText: {
    color: '#8E8E93',
    marginTop: 16,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  closeModalBtn: {
    backgroundColor: '#FF3B30',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
