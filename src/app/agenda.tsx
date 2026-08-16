import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, TextInput } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAgenda } from './AgendaContext';

const agendaTheme = {
  backgroundColor: '#0A0A0A',
  calendarBackground: '#1C1C1E',
  textSectionTitleColor: '#FF3B30',
  selectedDayBackgroundColor: '#FF3B30',
  selectedDayTextColor: '#ffffff',
  todayTextColor: '#FF3B30',
  dayTextColor: '#FFF',
  textDisabledColor: '#444',
  dotColor: '#FF3B30',
  selectedDotColor: '#ffffff',
  arrowColor: '#FF3B30',
  monthTextColor: '#FFF'
};

export default function AgendaScreen() {
  const { items, addEvent } = useAgenda();
  const [selectedDate, setSelectedDate] = useState('2026-08-17');
  const [newTime, setNewTime] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [timeDate, setTimeDate] = useState(new Date());

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) {
      setTimeDate(selectedDate);
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const mins = selectedDate.getMinutes().toString().padStart(2, '0');
      setNewTime(`${hours}:${mins}`);
    }
  };

  const handleAddEvent = () => {
    if (newTime && newTitle) {
      addEvent(selectedDate, newTime, newTitle);
      setNewTime('');
      setNewTitle('');
    } else {
      Alert.alert("Erreur", "Veuillez entrer une heure et un titre.");
    }
  };

  const currentItems = items[selectedDate] || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mon Agenda</Text>
      </View>

      <Calendar
        current={'2026-08-17'}
        onDayPress={(day: any) => setSelectedDate(day.dateString)}
        markedDates={{
          '2026-08-16': { marked: true, dotColor: '#FF3B30' },
          '2026-08-17': { marked: true, dotColor: '#FF3B30' },
          [selectedDate]: { selected: true, marked: true, selectedColor: '#FF3B30' }
        }}
        theme={agendaTheme}
      />

      <View style={styles.addEventContainer}>
        <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => setShowPicker(true)}>
          <Text style={{ color: newTime ? '#FFF' : '#8E8E93', fontSize: 14 }}>
            {newTime || "Heure"}
          </Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={timeDate}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={handleTimeChange}
          />
        )}
        <TextInput 
          style={[styles.input, { flex: 2, marginLeft: 8 }]} 
          placeholder="Titre de l'événement" 
          placeholderTextColor="#8E8E93"
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddEvent}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.eventsContainer}>
        <Text style={styles.dateTitle}>Programme du {selectedDate}</Text>
        {currentItems.length > 0 ? (
          currentItems.map((item: any, index: number) => (
            <View key={index} style={styles.item}>
              <Text style={styles.itemTime}>{item.time}</Text>
              <Text style={styles.itemText}>{item.name}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyDate}>
            <Text style={styles.emptyDateText}>Rien de prévu pour cette journée !</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#1C1C1E',
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  generateButton: {
    backgroundColor: '#34C759',
    margin: 16,
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
  eventsContainer: {
    flex: 1,
    padding: 20,
  },
  dateTitle: {
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  addEventContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 16,
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
    backgroundColor: '#34C759',
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
  item: {
    backgroundColor: '#1C1C1E',
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  itemTime: {
    color: '#FF3B30',
    fontWeight: '700',
    marginRight: 16,
    width: 45,
  },
  itemText: {
    color: '#FFF',
    fontSize: 16,
    flex: 1,
  },
  emptyDate: {
    paddingTop: 30,
    alignItems: 'center',
  },
  emptyDateText: {
    color: '#8E8E93',
    fontSize: 16,
    fontStyle: 'italic',
  }
});
