import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, ScrollView, Dimensions, TextInput, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import MapView, { Marker } from 'react-native-maps';
import Slider from '@react-native-community/slider';

const { width, height } = Dimensions.get('window');

const GOOGLE_API_KEY = 'AIzaSyBrdGlIPMDuHEnm61ddhQdWMhXRkDG5FuM';

export default function Dashboard() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [fatigue, setFatigue] = useState<number>(5); // 1 = Very energetic, 10 = Exhausted
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<any[]>([]);
  const [mode, setMode] = useState<'chill' | 'culture'>('chill');
  const [schedule, setSchedule] = useState<{id: string, time: string, title: string}[]>([]);
  const [newTime, setNewTime] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const addSchedule = () => {
    if (newTime && newTitle) {
      setSchedule([...schedule, { id: Date.now().toString(), time: newTime, title: newTitle }]);
      setNewTime('');
      setNewTitle('');
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
      // If we are not in London, mock the location to Central London for the demo
      if (loc.coords.latitude < 50 || loc.coords.latitude > 53) {
         loc.coords.latitude = 51.5074;
         loc.coords.longitude = -0.1278;
      }
      setLocation(loc);

      // Get Battery
      const level = await Battery.getBatteryLevelAsync();
      setBatteryLevel(level);

      setLoading(false);
    })();
  }, []);

  // Fetch recommendations from Google Places API based on fatigue & battery
  useEffect(() => {
    if (!location) return;

    const fetchPlaces = async () => {
      try {
        let type = 'point_of_interest';
        
        if (mode === 'culture') {
          if (fatigue > 7) {
            type = 'art_gallery'; // quiet culture
          } else {
            type = 'museum'; // active culture, tourist_attraction
          }
        } else {
          if (fatigue > 7) {
            type = 'cafe'; // chill
          } else if (fatigue < 4) {
            type = 'bar'; // energetic
          } else {
            type = 'restaurant'; // neutral
          }
        }

        // Reduce radius if battery is very low (500m instead of 2000m)
        const radius = (batteryLevel !== null && batteryLevel < 0.2) ? 500 : 2000;
        
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.coords.latitude},${location.coords.longitude}&radius=${radius}&type=${type}&maxprice=2&key=${GOOGLE_API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results) {
          const formattedPlaces = data.results.slice(0, 5).map((p: any) => ({
            id: p.place_id,
            name: p.name,
            type: type,
            price: p.price_level ? '$'.repeat(p.price_level) : 'Gratuit/$',
            lat: p.geometry.location.lat,
            lon: p.geometry.location.lng,
          }));
          setPlaces(formattedPlaces);
        }
      } catch (error) {
        console.error("Error fetching places:", error);
      }
    };

    fetchPlaces();
  }, [fatigue, batteryLevel, location, mode]);

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
          <Text style={styles.sectionTitle}>
            {mode === 'culture' ? "Lieux culturels :" : "Bons plans étudiants :"}
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
            <Text style={styles.noPlacesText}>Rien d'adapté à ta fatigue actuelle ! Repose-toi.</Text>
          )}
        </ScrollView>
        </ScrollView>

        {/* Emploi du temps manuel */}
        <Text style={styles.sectionTitle}>Mon Emploi du Temps :</Text>
        <View style={styles.scheduleInputContainer}>
          <TextInput 
            style={[styles.input, { flex: 1 }]} 
            placeholder="Ex: 14:00" 
            placeholderTextColor="#8E8E93"
            value={newTime}
            onChangeText={setNewTime}
          />
          <TextInput 
            style={[styles.input, { flex: 2, marginLeft: 8 }]} 
            placeholder="Ex: Cours d'anglais" 
            placeholderTextColor="#8E8E93"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          <TouchableOpacity style={styles.addButton} onPress={addSchedule}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {schedule.length > 0 ? (
          schedule.map(item => (
            <View key={item.id} style={styles.scheduleItem}>
              <Text style={styles.scheduleTime}>{item.time}</Text>
              <Text style={styles.scheduleTitle}>{item.title}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noPlacesText}>Aucune heure ajoutée.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  }
});
