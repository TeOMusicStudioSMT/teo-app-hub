import { MissionCard } from '../services/gemini';

export interface Creation {
  id: string;
  name: string;
  mission?: MissionCard;
  originalImage?: string; // Base64 data URL
  timestamp: Date;
}
