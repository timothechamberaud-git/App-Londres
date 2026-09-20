# London Student Guide 🇬🇧🎓

Application mobile et web conçue pour accompagner les étudiants à Londres : exploration des quartiers, recommandations personnalisées, gestion de budget, et **intégration intelligente de l'emploi du temps PronoteCampus / Hyperplanning**.

---

## 📅 Synchroniser son Emploi du Temps (PronoteCampus / Hyperplanning)

L'application intègre un module d'agenda connecté capable de synchroniser automatiquement votre emploi du temps universitaire via flux **iCal / ICS**.

> [!NOTE]
> **Vie privée & Sécurité** : Aucun emploi du temps ni lien personnel n'est stocké dans le code source. Toutes vos données d'agenda restent strictement stockées en local sur votre appareil (`AsyncStorage`).

### Comment connecter votre emploi du temps :
1. Ouvrez l'application et rendez-vous dans l'onglet **Agenda**.
2. Cliquez sur le badge en haut à droite **"Lier Pronote"**.
3. Récupérez votre lien iCal personnel :
   * Connectez-vous à votre espace étudiant **PronoteCampus** ou **Hyperplanning** sur votre navigateur Web.
   * Allez dans **Emploi du temps** (ou cliquez sur votre profil).
   * Cliquez sur l'icône de calendrier 📅 **"Synchroniser avec son agenda personnel"** (ou *Exporter au format iCal*).
   * Copiez l'adresse URL fournie (commençant par `https://...` ou `webcal://...`).
4. Collez l'URL dans l'application et appuyez sur **"🔄 Synchroniser l'emploi du temps"**.
5. Vos cours apparaissent automatiquement avec la salle, l'enseignant et les horaires au fuseau horaire de Londres (`Europe/London`).

### 🎯 Détection intelligente des séances obligatoires vs facultatives
L'application analyse le contenu de votre emploi du temps et classe automatiquement chaque activité :
* **Cours académiques obligatoires** : identifiés avec un badge bleu `[Obligatoire]`.
* **Séances non-obligatoires** : identifiées avec un badge violet `[Facultatif]` précisant la nature de la séance :
  * *Permanence libre* : les **Office Hours** des enseignants (créneaux de questions libres).
  * *Activité libre* : sessions de sport, yoga ou tournois sur inscription libre.
  * *Club* : activités associatives et clubs étudiants (théâtre, etc.).
  * *Soutien* : ateliers méthodologiques et soutien en anglais.
  * *Événement* : sorties, excursions et salons étudiants.
* **Filtres rapides** : basculez en un clic entre `Tous`, `🎯 Obligatoires` et `💡 Facultatifs` pour voir immédiatement les cours où votre présence est requise.

---

## 🚀 Démarrage rapide

### 1. Installation des dépendances
```bash
npm install
```

### 2. Lancement du serveur de développement
```bash
# Version Web
npm run web

# ou pour iOS / Android via Expo Go
npx expo start
```

---

## 🛠️ Technologies
- **Framework** : [Expo](https://expo.dev) / React Native (Expo Router)
- **Langage** : TypeScript
- **Calendrier** : `react-native-calendars`
- **Stockage local** : `@react-native-async-storage/async-storage`
- **Cartographie** : `react-native-maps`
- **Réseau / iCal** : Parseur RFC 5545 personnalisé avec gestion des fuseaux horaires (`Intl.DateTimeFormat`)
