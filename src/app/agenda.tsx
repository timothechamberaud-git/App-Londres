import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAgenda, Event } from './AgendaContext';

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
  monthTextColor: '#FFF',
};

// Formate une date YYYY-MM-DD en texte lisible (ex: "Lundi 21 septembre 2026")
function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function AgendaScreen() {
  const {
    items,
    pronoteUrl,
    lastSync,
    isSyncing,
    addEvent,
    syncPronote,
    importIcsRaw,
    unlinkPronote,
    clearAgenda,
  } = useAgenda();

  // Date du jour par défaut
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [filterMode, setFilterMode] = useState<'all' | 'mandatory' | 'optional'>('all');
  const [newTime, setNewTime] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [timeDate, setTimeDate] = useState(new Date());

  // Modal Pronote
  const [pronoteModalVisible, setPronoteModalVisible] = useState(false);
  const [inputUrl, setInputUrl] = useState(pronoteUrl);
  const [manualIcs, setManualIcs] = useState('');
  const [showManualSection, setShowManualSection] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Synchronisation des dates marquées sur le calendrier
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    // Marquer chaque jour : rouge si au moins 1 cours obligatoire, violet si uniquement facultatif
    for (const [date, eventList] of Object.entries(items)) {
      if (eventList && eventList.length > 0) {
        const hasMandatory = eventList.some(e => !e.isOptional);
        marks[date] = {
          marked: true,
          dotColor: hasMandatory ? '#FF3B30' : '#AF52DE',
        };
      }
    }

    // Mettre en valeur le jour sélectionné
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: '#FF3B30',
    };

    return marks;
  }, [items, selectedDate]);

  const handleTimeChange = (_event: any, date?: Date) => {
    setShowPicker(false);
    if (date) {
      setTimeDate(date);
      const hours = date.getHours().toString().padStart(2, '0');
      const mins = date.getMinutes().toString().padStart(2, '0');
      setNewTime(`${hours}:${mins}`);
    }
  };

  const handleAddEvent = () => {
    if (newTime && newTitle.trim()) {
      addEvent(selectedDate, newTime, newTitle.trim(), newLocation.trim() || undefined);
      setNewTime('');
      setNewTitle('');
      setNewLocation('');
    } else {
      Alert.alert('Erreur', 'Veuillez entrer une heure et un titre.');
    }
  };

  const handleClearAgenda = () => {
    Alert.alert(
      'Vider mon agenda',
      'Êtes-vous sûr de vouloir supprimer tous les événements et cours ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Vider', style: 'destructive', onPress: clearAgenda },
      ]
    );
  };

  const handleTriggerSync = async () => {
    if (!inputUrl.trim()) {
      Alert.alert('URL manquante', 'Veuillez coller le lien iCal de votre PronoteCampus.');
      return;
    }
    try {
      await syncPronote(inputUrl.trim());
      Alert.alert('Succès', 'Votre emploi du temps PronoteCampus a été synchronisé !');
      setPronoteModalVisible(false);
    } catch (e: any) {
      Alert.alert('Erreur de synchronisation', e?.message || 'Vérifiez le lien iCal et réessayez.');
    }
  };

  const handleImportManualIcs = async () => {
    if (!manualIcs.trim()) {
      Alert.alert('Contenu vide', 'Veuillez coller le texte brut du fichier .ics.');
      return;
    }
    try {
      await importIcsRaw(manualIcs.trim());
      Alert.alert('Succès', 'Les événements ont été importés avec succès !');
      setManualIcs('');
      setPronoteModalVisible(false);
    } catch (e: any) {
      Alert.alert("Erreur d'importation", e?.message || 'Le format du fichier .ics est invalide.');
    }
  };

  const handleUnlink = () => {
    Alert.alert(
      'Délier Pronote',
      'Voulez-vous supprimer le lien PronoteCampus et effacer les cours synchronisés ? Vos événements personnels seront conservés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Délier',
          style: 'destructive',
          onPress: async () => {
            await unlinkPronote();
            setInputUrl('');
            setPronoteModalVisible(false);
          },
        },
      ]
    );
  };

  const rawItems = items[selectedDate] || [];

  // Compteurs d'événements pour le jour sélectionné
  const mandatoryCount = rawItems.filter(item => !item.isOptional).length;
  const optionalCount = rawItems.filter(item => item.isOptional).length;

  // Filtrage des cours selon le mode actif
  const displayedItems = useMemo(() => {
    if (filterMode === 'mandatory') {
      return rawItems.filter(item => !item.isOptional);
    }
    if (filterMode === 'optional') {
      return rawItems.filter(item => item.isOptional);
    }
    return rawItems;
  }, [rawItems, filterMode]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mon Agenda</Text>
          <Text style={styles.subtitle}>London Student Guide</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.pronoteBadgeButton,
              pronoteUrl ? styles.pronoteBadgeActive : styles.pronoteBadgeInactive,
            ]}
            onPress={() => {
              setInputUrl(pronoteUrl);
              setPronoteModalVisible(true);
            }}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: pronoteUrl ? '#34C759' : '#8E8E93' },
              ]}
            />
            <Text style={styles.pronoteBadgeText}>
              {pronoteUrl ? 'Pronote lié' : 'Lier Pronote'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClearAgenda} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Vider</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barre d'état de synchronisation Pronote */}
      {pronoteUrl ? (
        <View style={styles.syncBar}>
          <View style={styles.syncBarInfo}>
            <Text style={styles.syncBarTitle}>🎓 Emploi du temps PronoteCampus</Text>
            <Text style={styles.syncBarSubtitle}>
              {lastSync ? `Synchro : ${lastSync}` : 'Synchronisation prête'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.syncBarButton}
            onPress={() => syncPronote()}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.syncBarButtonText}>🔄 Actualiser</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.connectPrompt}
          onPress={() => setPronoteModalVisible(true)}
        >
          <Text style={styles.connectPromptText}>
            💡 Connectez votre emploi du temps PronoteCampus pour afficher vos cours automatiquement.
          </Text>
        </TouchableOpacity>
      )}

      {/* Calendrier */}
      <Calendar
        current={selectedDate}
        onDayPress={(day: any) => {
          setSelectedDate(day.dateString);
          setFilterMode('all'); // Réinitialiser le filtre au changement de jour
        }}
        markedDates={markedDates}
        theme={agendaTheme}
      />

      {/* Ajout d'événement personnel rapide */}
      <View style={styles.addEventContainer}>
        <TouchableOpacity
          style={[styles.input, styles.timeInput]}
          onPress={() => setShowPicker(true)}
        >
          <Text style={{ color: newTime ? '#FFF' : '#8E8E93', fontSize: 13, fontWeight: '600' }}>
            {newTime || '🕒 Heure'}
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
          style={[styles.input, styles.titleInput]}
          placeholder="Ajouter une note ou révision..."
          placeholderTextColor="#8E8E93"
          value={newTitle}
          onChangeText={setNewTitle}
        />

        <TouchableOpacity style={styles.addButton} onPress={handleAddEvent}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Liste des cours & événements du jour */}
      <ScrollView style={styles.eventsContainer} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Entête du jour avec résumé */}
        <View style={styles.dateHeaderRow}>
          <View>
            <Text style={styles.dateTitle}>{formatDisplayDate(selectedDate)}</Text>
            {rawItems.length > 0 && (
              <Text style={styles.dateSummary}>
                {mandatoryCount > 0 ? `${mandatoryCount} obligatoire${mandatoryCount > 1 ? 's' : ''}` : 'Aucun obligatoire'}
                {optionalCount > 0 ? ` • ${optionalCount} facultatif${optionalCount > 1 ? 's' : ''}` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Filtres de sélection (Tous / Obligatoires / Facultatifs) */}
        {rawItems.length > 0 && optionalCount > 0 && (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, filterMode === 'all' && styles.filterPillActive]}
              onPress={() => setFilterMode('all')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filterMode === 'all' && styles.filterPillTextActive,
                ]}
              >
                Tous ({rawItems.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                filterMode === 'mandatory' && styles.filterPillActiveMandatory,
              ]}
              onPress={() => setFilterMode('mandatory')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filterMode === 'mandatory' && styles.filterPillTextActive,
                ]}
              >
                🎯 Obligatoires ({mandatoryCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                filterMode === 'optional' && styles.filterPillActiveOptional,
              ]}
              onPress={() => setFilterMode('optional')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filterMode === 'optional' && styles.filterPillTextActive,
                ]}
              >
                💡 Facultatifs ({optionalCount})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {displayedItems.length > 0 ? (
          displayedItems.map((item: Event, index: number) => {
            const isPronote = item.source === 'pronote';
            const isOptional = item.isOptional;

            return (
              <View
                key={item.id || index}
                style={[
                  styles.itemCard,
                  isOptional
                    ? styles.itemCardOptional
                    : isPronote
                    ? styles.itemCardPronote
                    : styles.itemCardManual,
                ]}
              >
                <View style={styles.itemHeader}>
                  <View
                    style={[
                      styles.timePill,
                      isOptional && styles.timePillOptional,
                    ]}
                  >
                    <Text
                      style={[
                        styles.itemTime,
                        isOptional && styles.itemTimeOptional,
                      ]}
                    >
                      {item.time}
                    </Text>
                  </View>

                  <View style={styles.tagRow}>
                    {/* Badge Obligatoire vs Facultatif */}
                    {isPronote && (
                      <View
                        style={[
                          styles.obligationBadge,
                          isOptional ? styles.badgeOptional : styles.badgeMandatory,
                        ]}
                      >
                        <Text
                          style={[
                            styles.obligationBadgeText,
                            isOptional ? styles.badgeOptionalText : styles.badgeMandatoryText,
                          ]}
                        >
                          {isOptional
                            ? `Facultatif${item.optionalReason ? ` • ${item.optionalReason}` : ''}`
                            : 'Obligatoire'}
                        </Text>
                      </View>
                    )}

                    {item.type && !isOptional && (
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{item.type}</Text>
                      </View>
                    )}

                    {!isPronote && (
                      <View style={[styles.sourceBadge, styles.sourceManual]}>
                        <Text style={styles.sourceBadgeText}>Perso</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text
                  style={[
                    styles.itemTitle,
                    isOptional && styles.itemTitleOptional,
                  ]}
                >
                  {item.name}
                </Text>

                {(item.location || item.teacher) && (
                  <View style={styles.itemDetails}>
                    {item.location ? (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>📍</Text>
                        <Text style={styles.detailText}>{item.location}</Text>
                      </View>
                    ) : null}

                    {item.teacher ? (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>👤</Text>
                        <Text style={styles.detailText}>{item.teacher}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyDate}>
            <Text style={styles.emptyIcon}>☕</Text>
            <Text style={styles.emptyDateText}>
              {filterMode === 'mandatory'
                ? 'Aucun cours obligatoire pour cette journée !'
                : filterMode === 'optional'
                ? 'Aucune séance facultative pour cette journée.'
                : 'Aucun cours ni événement prévu pour ce jour.'}
            </Text>
            <Text style={styles.emptyDateSubtext}>
              {filterMode === 'mandatory'
                ? 'Journée libre de cours obligatoires. Profitez-en pour réviser ou explorer Londres !'
                : 'Profitez-en pour vous détendre ou explorer Londres !'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modal de configuration PronoteCampus */}
      <Modal
        visible={pronoteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPronoteModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Emploi du temps PronoteCampus</Text>
              <Text style={styles.modalSubtitle}>Synchronisation de votre planning étudiant</Text>
            </View>
            <TouchableOpacity
              onPress={() => setPronoteModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 50 }}>
            {/* Guide pas à pas */}
            <TouchableOpacity
              style={styles.guideAccordion}
              onPress={() => setShowGuide(!showGuide)}
            >
              <Text style={styles.guideAccordionTitle}>
                {showGuide ? '▼ Cacher le guide' : '▶ Comment récupérer mon lien PronoteCampus ?'}
              </Text>
            </TouchableOpacity>

            {showGuide && (
              <View style={styles.guideContent}>
                <Text style={styles.guideStep}>
                  <Text style={styles.guideStepNumber}>1. </Text>
                  Connectez-vous sur votre espace étudiant <Text style={styles.bold}>PronoteCampus / Hyperplanning</Text> (sur navigateur Web de préférence).
                </Text>
                <Text style={styles.guideStep}>
                  <Text style={styles.guideStepNumber}>2. </Text>
                  Rendez-vous dans la section <Text style={styles.bold}>Emploi du temps</Text> ou cliquez sur votre <Text style={styles.bold}>Profil</Text>.
                </Text>
                <Text style={styles.guideStep}>
                  <Text style={styles.guideStepNumber}>3. </Text>
                  Cliquez sur <Text style={styles.bold}>"Synchroniser avec son agenda"</Text> (icône calendrier 📅).
                </Text>
                <Text style={styles.guideStep}>
                  <Text style={styles.guideStepNumber}>4. </Text>
                  Copiez le lien iCal qui commence par <Text style={styles.codeText}>https://...</Text> et collez-le ci-dessous.
                </Text>
              </View>
            )}

            {/* Champ URL iCal */}
            <Text style={styles.inputLabel}>Lien iCal / ICS de synchronisation :</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="https://...pronotecampus.fr/.../Edt.ics"
              placeholderTextColor="#666"
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
            />

            {/* Bouton de synchronisation */}
            <TouchableOpacity
              style={[styles.primaryButton, isSyncing && styles.buttonDisabled]}
              onPress={handleTriggerSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  🔄 Synchroniser l'emploi du temps
                </Text>
              )}
            </TouchableOpacity>

            {lastSync && (
              <Text style={styles.lastSyncLabel}>Dernière synchronisation réussie : {lastSync}</Text>
            )}

            {/* Section alternative d'import manuel ICS */}
            <TouchableOpacity
              style={styles.secondaryAccordion}
              onPress={() => setShowManualSection(!showManualSection)}
            >
              <Text style={styles.secondaryAccordionText}>
                {showManualSection
                  ? '▼ Masquer l’import manuel'
                  : '▶ Option alternative : Coller du texte .ics directement'}
              </Text>
            </TouchableOpacity>

            {showManualSection && (
              <View style={styles.manualSection}>
                <TextInput
                  style={styles.manualTextarea}
                  placeholder="Collez ici le contenu de votre fichier .ics (BEGIN:VCALENDAR...)"
                  placeholderTextColor="#666"
                  value={manualIcs}
                  onChangeText={setManualIcs}
                  multiline
                />
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleImportManualIcs}
                >
                  <Text style={styles.secondaryButtonText}>Importer le contenu ICS</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bouton Délier */}
            {pronoteUrl ? (
              <TouchableOpacity style={styles.unlinkButton} onPress={handleUnlink}>
                <Text style={styles.unlinkButtonText}>Délier mon compte Pronote</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1C1C1E',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pronoteBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  pronoteBadgeActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderColor: '#34C759',
  },
  pronoteBadgeInactive: {
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    borderColor: '#8E8E93',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  pronoteBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  clearButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 12,
  },
  syncBar: {
    backgroundColor: '#161618',
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#242426',
  },
  syncBarInfo: {
    flex: 1,
  },
  syncBarTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  syncBarSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  syncBarButton: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  syncBarButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  connectPrompt: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 122, 255, 0.3)',
  },
  connectPromptText: {
    color: '#5AC8FA',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  addEventContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#141416',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#202022',
  },
  input: {
    backgroundColor: '#1C1C1E',
    color: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  timeInput: {
    width: 80,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInput: {
    flex: 1,
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  addButton: {
    backgroundColor: '#FF3B30',
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  eventsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  dateSummary: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  // Pills de filtrage
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  filterPillActive: {
    backgroundColor: '#3A3A3C',
    borderColor: '#545458',
  },
  filterPillActiveMandatory: {
    backgroundColor: 'rgba(0, 122, 255, 0.25)',
    borderColor: '#007AFF',
  },
  filterPillActiveOptional: {
    backgroundColor: 'rgba(175, 82, 222, 0.25)',
    borderColor: '#AF52DE',
  },
  filterPillText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFF',
  },
  // Cartes de cours
  itemCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  itemCardPronote: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  itemCardOptional: {
    borderLeftWidth: 4,
    borderLeftColor: '#AF52DE',
    backgroundColor: '#17161A',
  },
  itemCardManual: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timePill: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  timePillOptional: {
    backgroundColor: 'rgba(175, 82, 222, 0.15)',
  },
  itemTime: {
    color: '#FF3B30',
    fontWeight: '700',
    fontSize: 12,
  },
  itemTimeOptional: {
    color: '#AF52DE',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  obligationBadge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  obligationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeMandatory: {
    backgroundColor: 'rgba(0, 122, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.35)',
  },
  badgeMandatoryText: {
    color: '#5AC8FA',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeOptional: {
    backgroundColor: 'rgba(175, 82, 222, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(175, 82, 222, 0.4)',
  },
  badgeOptionalText: {
    color: '#DDA0DD',
    fontSize: 10,
    fontWeight: '600',
  },
  typeBadge: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  typeBadgeText: {
    color: '#AEAEB2',
    fontSize: 10,
    fontWeight: '600',
  },
  sourceBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  sourceManual: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  sourceBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  itemTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  itemTitleOptional: {
    color: '#E0D0F5',
  },
  itemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  detailText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyDate: {
    paddingVertical: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyDateText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDateSubtext: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Styles de la modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#121214',
  },
  modalHeader: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1C1C1E',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  guideAccordion: {
    backgroundColor: '#1C1C1E',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  guideAccordionTitle: {
    color: '#5AC8FA',
    fontSize: 13,
    fontWeight: '600',
  },
  guideContent: {
    backgroundColor: '#18181A',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#28282C',
  },
  guideStep: {
    color: '#CCC',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  guideStepNumber: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  bold: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  codeText: {
    color: '#5AC8FA',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  inputLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#1C1C1E',
    color: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    fontSize: 13,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  lastSyncLabel: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  secondaryAccordion: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryAccordionText: {
    color: '#8E8E93',
    fontSize: 13,
  },
  manualSection: {
    marginTop: 10,
    backgroundColor: '#1C1C1E',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  manualTextarea: {
    backgroundColor: '#121214',
    color: '#FFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    height: 120,
    fontSize: 12,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  unlinkButton: {
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  unlinkButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
});
