import { MissionCard } from '../services/gemini';

export interface Creation {
  id:             string;
  name:           string;
  mission?:       MissionCard;
  originalImage?: string;      // Base64 data URL (zdjęcia / PDF preview)
  localVideoPath?: string;     // Absolutna ścieżka do lokalnego pliku wideo (np. C:/...)
  timestamp:      Date;
}
