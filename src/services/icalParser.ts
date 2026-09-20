import { Platform } from 'react-native';

export interface Event {
  id?: string;
  name: string;
  time: string; // Ex: "09:00 - 10:30"
  location?: string;
  teacher?: string;
  type?: string; // Ex: "CRS", "TD", "WORKSHOP"
  source?: 'pronote' | 'manual';
  isOptional?: boolean;
  optionalReason?: string;
  rawDescription?: string;
}

export type AgendaItems = {
  [date: string]: Event[];
};

/**
 * Déplie les lignes de l'iCal (RFC 5545).
 * Les lignes coupées commencent par un espace ou une tabulation.
 */
export function unfoldIcsLines(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/**
 * Décode une date iCal au format YYYYMMDDTHHMMSS(Z?)
 */
export function parseIcalDate(str: string): Date | null {
  if (!str) return null;
  const clean = str.replace(/[^0-9TZ]/g, '');
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (match) {
    const [, y, m, d, hh, mm, ss, isUtc] = match;
    if (isUtc === 'Z') {
      return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
    }
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss);
  }
  // Format sans heure YYYYMMDD
  const dateOnly = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(+y, +m - 1, +d);
  }
  return null;
}

/**
 * Formate une date en YYYY-MM-DD selon le fuseau horaire de Londres (Europe/London)
 */
export function formatDateLondon(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Formate une heure en HH:mm selon le fuseau horaire de Londres
 */
export function formatTimeLondon(date: Date): string {
  try {
    return date.toLocaleTimeString('fr-FR', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

/**
 * Parse un contenu ICS (RFC 5545) et retourne les événements groupés par date (YYYY-MM-DD)
 */
export function parseIcsToAgenda(rawIcs: string): AgendaItems {
  const unfolded = unfoldIcsLines(rawIcs);
  const vevents = unfolded.split('BEGIN:VEVENT').slice(1);
  const result: AgendaItems = {};

  for (const block of vevents) {
    const getField = (prefix: string): string => {
      const regex = new RegExp('^' + prefix + '(?:;[^:]*)?:(.*)$', 'm');
      const match = block.match(regex);
      if (!match) return '';
      return match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\')
        .trim();
    };

    const dtstartStr = getField('DTSTART');
    const dtendStr = getField('DTEND');
    const summary = getField('SUMMARY');
    const location = getField('LOCATION');
    const description = getField('DESCRIPTION');
    const uid = getField('UID');

    const startDate = parseIcalDate(dtstartStr);
    if (!startDate) continue;

    const endDate = parseIcalDate(dtendStr);

    const dateKey = formatDateLondon(startDate);
    const startTimeStr = formatTimeLondon(startDate);
    const endTimeStr = endDate ? formatTimeLondon(endDate) : '';
    const timeDisplay = endTimeStr ? `${startTimeStr} - ${endTimeStr}` : startTimeStr;

    // Analyse de la description pour extraire les informations clés Hyperplanning / Pronote
    const memoMatch = description.match(/Mémo\s*:\s*([^\r\n]+)/i);
    const matiereMatch = description.match(/Matière\s*:\s*([^\r\n]+)/i);
    const enseignantMatch = description.match(/Enseignant(?:s)?\s*:\s*([^\r\n]+)/i);
    const salleMatch = description.match(/Salle(?:s)?\s*:\s*([^\r\n]+)/i);
    const typeMatch = description.match(/Type\s*:\s*([^\r\n]+)/i);
    const optionMatch = description.match(/Option\s*:\s*([^\r\n]+)/i);

    const memo = memoMatch ? memoMatch[1].trim() : '';
    const matiere = matiereMatch ? matiereMatch[1].trim() : '';
    const teacher = enseignantMatch ? enseignantMatch[1].trim() : '';
    const room = location || (salleMatch ? salleMatch[1].trim() : '');
    const courseType = typeMatch ? typeMatch[1].trim() : '';
    const option = optionMatch ? optionMatch[1].trim() : '';

    // Détection automatique des séances non-obligatoires / facultatives
    let isOptional = false;
    let optionalReason: string | undefined = undefined;

    const upperMatiere = matiere.toUpperCase();
    const upperOption = option.toUpperCase();
    const lowerMemo = memo.toLowerCase();

    if (upperMatiere === 'OFFICE HOURS' || upperOption.includes('OFFICE HOURS')) {
      isOptional = true;
      optionalReason = 'Permanence libre';
    } else if (upperMatiere === 'ACTIVITY' || lowerMemo.includes('register here')) {
      isOptional = true;
      optionalReason = 'Activité libre';
    } else if (upperMatiere === 'DRAMA CLUB') {
      isOptional = true;
      optionalReason = 'Club';
    } else if (upperMatiere === 'ENGLISH & STUDY SKILLS') {
      isOptional = true;
      optionalReason = 'Soutien';
    } else if (upperMatiere === 'VISIT' || upperMatiere === 'EVENT') {
      isOptional = true;
      optionalReason = 'Événement';
    } else if (lowerMemo.includes('for external students only')) {
      isOptional = true;
      optionalReason = 'Non concerné (externe)';
    } else if (upperOption.includes('OPTIONS')) {
      isOptional = true;
      optionalReason = 'Optionnel';
    }

    // Déterminer le nom de cours le plus pertinent et lisible
    let courseName = '';
    const genericTypes = ['WORKSHOP', 'INFO SESSION', 'CRS', 'TD', 'TP', 'CONFÉRENCE', 'CONFERENCE'];
    
    if (memo && matiere) {
      if (genericTypes.includes(matiere.toUpperCase())) {
        courseName = memo;
      } else if (memo.toLowerCase() !== matiere.toLowerCase()) {
        courseName = `${matiere} (${memo})`;
      } else {
        courseName = matiere;
      }
    } else if (matiere) {
      courseName = matiere;
    } else if (memo) {
      courseName = memo;
    } else if (summary) {
      // Extraire la première partie avant les tirets
      courseName = summary.split(' - ')[0].trim();
    } else {
      courseName = 'Cours sans titre';
    }

    const event: Event = {
      id: uid || `${dateKey}-${startTimeStr}-${courseName}`,
      name: courseName,
      time: timeDisplay,
      location: room,
      teacher: teacher,
      type: courseType || (matiere && genericTypes.includes(matiere.toUpperCase()) ? matiere : undefined),
      source: 'pronote',
      isOptional,
      optionalReason,
      rawDescription: description,
    };

    if (!result[dateKey]) {
      result[dateKey] = [];
    }
    result[dateKey].push(event);
  }

  // Trier les cours de chaque journée par heure de début
  for (const dateKey of Object.keys(result)) {
    result[dateKey].sort((a, b) => a.time.localeCompare(b.time));
  }

  return result;
}

/**
 * Télécharge le contenu d'une URL iCal en gérant les protocoles webcal:// et proxies CORS si nécessaire
 */
export async function fetchIcalFeed(url: string): Promise<string> {
  let targetUrl = url.trim();
  if (targetUrl.startsWith('webcal://')) {
    targetUrl = 'https://' + targetUrl.slice(9);
  } else if (targetUrl.startsWith('http://')) {
    targetUrl = 'https://' + targetUrl.slice(7);
  }

  // Sur plateforme Web, le navigateur bloque les requêtes cross-origin si le serveur Pronote n'autorise pas CORS.
  // Sur mobile natif (iOS / Android), fetch() n'a pas de restriction CORS.
  if (Platform.OS === 'web') {
    try {
      const res = await fetch(targetUrl);
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // Fallback avec proxy CORS pour l'environnement Web
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      const proxyRes = await fetch(proxyUrl);
      if (!proxyRes.ok) {
        throw new Error(`Impossible de récupérer le calendrier (statut ${proxyRes.status})`);
      }
      return await proxyRes.text();
    }
  }

  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Erreur lors du téléchargement de l'emploi du temps (statut ${response.status})`);
  }
  return await response.text();
}
