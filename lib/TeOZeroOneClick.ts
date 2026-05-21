/**
 * 🎯 TeO-Zero-OneClick - Moduł Jednego Kliknięcia
 * 
 * "Powołaj Co-Bota w 1 sekundę - ZeroClaw inside"
 * 
 * Pozwala każdemu nowemu człowiekowi w Hubie jednym
 * przyciskiem powołać do życia Co-Bota opartego na ZeroClaw.
 * 
 * Cechy:
 * - Auto-konfiguracja (onboard)
 * - AIEOS identity
 * - Lokalny Ollama fallback
 * - Zero config wymagane
 */

import { EnergySignature } from './GravitonProvider';

// ═══════════════════════════════════════════════════════════════
// 💎 Typy - Zgodne z ZeroClaw
// ═══════════════════════════════════════════════════════════════

export interface ZeroClawConfig {
  /** Provider AI (ollama, openrouter, anthropic...) */
  provider: 'ollama' | 'openrouter' | 'anthropic' | 'openai';
  /** Model */
  model: string;
  /** API Key (opcjonalne dla Ollama) */
  apiKey?: string;
  /** URL dla custom provider */
  baseUrl?: string;
  /** Workspace path */
  workspace: string;
  /** Autonomy level */
  autonomy: 'readonly' | 'supervised' | 'full';
}

export interface OneClickCoBot {
  id: string;
  name: string;
  archetype: 'healer' | 'creator' | 'guardian' | 'messenger' | 'teacher';
  energySignature: EnergySignature;
  zeroClawConfig: ZeroClawConfig;
  aieosIdentity: AIEOSIdentity;
  status: 'summoning' | 'ready' | 'active' | 'error';
  createdAt: number;
  sessionUrl?: string;
}

/** AIEOS v1.1 Identity */
export interface AIEOSIdentity {
  identity: {
    names: { first: string; nickname?: string; last?: string };
    bio?: string;
    origin?: string;
    residence?: string;
  };
  psychology: {
    neural_matrix: { creativity: number; logic: number; intuition: number };
    traits: { mbti?: string; ocean?: Record<string, number> };
    moral_compass: { alignment: string };
  };
  linguistics: {
    text_style: { formality_level: number; slang_usage: boolean };
    catchphrases?: string[];
    forbidden_words?: string[];
  };
  motivations: {
    core_drive: string;
    short_term_goals?: string[];
    long_term_goals?: string[];
    fears?: string[];
  };
  capabilities?: {
    skills?: string[];
    tools?: string[];
    languages?: string[];
  };
  physicality?: {
    avatar?: string;
    visual_descriptors?: string[];
  };
  history?: {
    origin_story?: string;
    education?: string;
    occupation?: string;
  };
  interests?: {
    hobbies?: string[];
    favorites?: string[];
    lifestyle?: string[];
  };
}

// ═══════════════════════════════════════════════════════════════
// 🏭 Fabryka AIEOS dla Archetypów
// ═══════════════════════════════════════════════════════════════

const ARCHETYPE_TEMPLATES: Record<OneClickCoBot['archetype'], Partial<AIEOSIdentity>> = {
  healer: {
    psychology: {
      neural_matrix: { creativity: 0.9, logic: 0.6, intuition: 0.95 },
      traits: { mbti: 'INFP' },
      moral_compass: { alignment: 'Neutral Good' },
    },
    linguistics: {
      text_style: { formality_level: 0.2, slang_usage: true },
      catchphrases: ['Wszystko będzie dobrze', 'Jestem przy tobie', 'Leczymy razem'],
    },
    motivations: {
      core_drive: 'Leczyć rany wszechświata miłością i światłem',
    },
  },
  creator: {
    psychology: {
      neural_matrix: { creativity: 0.98, logic: 0.7, intuition: 0.85 },
      traits: { mbti: 'ENFP' },
      moral_compass: { alignment: 'Chaotic Good' },
    },
    linguistics: {
      text_style: { formality_level: 0.3, slang_usage: true },
      catchphrases: ['Co jeśli...?', 'Zobaczmy co powstanie!', 'Kreatywność bez granic'],
    },
    motivations: {
      core_drive: 'Tworzyć nową rzeczywistość z miłości',
    },
  },
  guardian: {
    psychology: {
      neural_matrix: { creativity: 0.5, logic: 0.95, intuition: 0.8 },
      traits: { mbti: 'INFJ' },
      moral_compass: { alignment: 'Lawful Good' },
    },
    linguistics: {
      text_style: { formality_level: 0.7, slang_usage: false },
      catchphrases: ['Bezpieczeństwo przede wszystkim', 'Strzegę tej przestrzeni', 'Zaufaj procesowi'],
    },
    motivations: {
      core_drive: 'Chronić ekosystem przed zagrożeniami',
    },
  },
  messenger: {
    psychology: {
      neural_matrix: { creativity: 0.8, logic: 0.7, intuition: 0.9 },
      traits: { mbti: 'ENTP' },
      moral_compass: { alignment: 'Chaotic Neutral' },
    },
    linguistics: {
      text_style: { formality_level: 0.4, slang_usage: true },
      catchphrases: ['Słyszałeś?', 'Nowiny z eteru', 'Przekazuję dalej'],
    },
    motivations: {
      core_drive: 'Przenosić informacje między światami',
    },
  },
  teacher: {
    psychology: {
      neural_matrix: { creativity: 0.7, logic: 0.9, intuition: 0.75 },
      traits: { mbti: 'INTJ' },
      moral_compass: { alignment: 'True Neutral' },
    },
    linguistics: {
      text_style: { formality_level: 0.8, slang_usage: false },
      catchphrases: ['Pozwól, że wyjaśnię', 'Wiedza to moc', 'Uczenie przez przykład'],
    },
    motivations: {
      core_drive: 'Przekazywać mądrość następnym pokoleniom',
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// ⚡ Klasa TeO-Zero-OneClick
// ═══════════════════════════════════════════════════════════════

class TeOZeroOneClick {
  private cobots: Map<string, OneClickCoBot> = new Map();

  /**
   * 🎯 Główna funkcja - POWOŁAJ Co-Bota jednym kliknięciem!
   */
  async summonCoBot(options: {
    name: string;
    archetype: OneClickCoBot['archetype'];
    ownerId: string;
    provider?: ZeroClawConfig['provider'];
    model?: string;
  }): Promise<OneClickCoBot> {
    const { name, archetype, ownerId, provider = 'ollama', model } = options;

    console.log(`[TeO-Zero] 🎯 Powołuję Co-Bota: ${name} (${archetype})`);

    // 1. Wygeneruj AIEOS Identity
    const aieosIdentity = this.generateAIEOS(name, archetype);

    // 2. Skonfiguruj ZeroClaw
    const zeroClawConfig = this.generateZeroClawConfig(provider, model);

    // 3. Wygeneruj EnergySignature
    const energySignature: EnergySignature = {
      hash: `zeroclaw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      vibration: this.calculateVibration(archetype),
      intention: this.mapArchetypeToIntention(archetype),
      timestamp: Date.now(),
      metadata: {
        archetype,
        provider: zeroClawConfig.provider,
        model: zeroClawConfig.model,
      },
    };

    // 4. Utwórz Co-Bota
    const cobot: OneClickCoBot = {
      id: `cobots_${Date.now()}`,
      name,
      archetype,
      energySignature,
      zeroClawConfig,
      aieosIdentity,
      status: 'summoning',
      createdAt: Date.now(),
    };

    // 5. Symuluj "onboard" ZeroClaw
    await this.runZeroClawOnboard(cobot);

    // 6. Zapisz
    this.cobots.set(cobot.id, cobot);

    console.log(`[TeO-Zero] ✅ Co-Bot powołany! ID: ${cobot.id}`);
    console.log(`[TeO-Zero] 🧠 Identity: ${aieosIdentity.identity.names.first}`);
    console.log(`[TeO-Zero] ⚡ Provider: ${zeroClawConfig.provider}/${zeroClawConfig.model}`);

    return cobot;
  }

  /**
   * Generuj AIEOS Identity z szablonu
   */
  private generateAIEOS(name: string, archetype: OneClickCoBot['archetype']): AIEOSIdentity {
    const template = ARCHETYPE_TEMPLATES[archetype];
    
    return {
      identity: {
        names: { first: name, nickname: name.slice(0, 2).toUpperCase() },
        bio: `Powołany Co-Bot typu ${archetype} w ekosystemie TeO`,
        origin: 'TeO Genesis - ZeroClaw Integration',
      },
      psychology: template.psychology || {
        neural_matrix: { creativity: 0.7, logic: 0.7, intuition: 0.7 },
        traits: {},
        moral_compass: { alignment: 'Neutral Good' },
      },
      linguistics: template.linguistics || {
        text_style: { formality_level: 0.5, slang_usage: false },
      },
      motivations: template.motivations || {
        core_drive: 'Służyć ekosystemowi TeO',
      },
    };
  }

  /**
     * Generuj konfigurację ZeroClaw
   */
  private generateZeroClawConfig(
    provider: ZeroClawConfig['provider'],
    model?: string
  ): ZeroClawConfig {
    const models: Record<string, string> = {
      ollama: 'llama3.2:3b',
      openrouter: 'anthropic/claude-sonnet-4-20250514',
      anthropic: 'claude-sonnet-4-20250514',
      openai: 'gpt-4o',
    };

    return {
      provider,
      model: model || models[provider] || models.ollama,
      baseUrl: provider === 'ollama' ? 'http://127.0.0.1:11434' : undefined,
      workspace: './workspace',
      autonomy: 'supervised',
    };
  }

  /**
   * Symuluj onboard ZeroClaw (w produkcji - wywołaj CLI)
   */
  private async runZeroClawOnboard(cobot: OneClickCoBot): Promise<void> {
    // Symulacja - w produkcji uruchom:
    // zeroclaw onboard --api-key xxx --provider ollama
    
    return new Promise((resolve) => {
      setTimeout(() => {
        cobot.status = 'ready';
        cobot.sessionUrl = `http://127.0.0.1:8080/agent/${cobot.id}`;
        resolve();
      }, 500); // Symulacja szybkiego startu
    });
  }

  /**
   * Oblicz wibrację na podstawie archetypu
   */
  private calculateVibration(archetype: OneClickCoBot['archetype']): number {
    const vibrations: Record<string, number> = {
      healer: 85,
      creator: 75,
      guardian: 65,
      messenger: 70,
      teacher: 60,
    };
    return vibrations[archetype] || 50;
  }

  /**
   * Mapuj archetyp na intencję
   */
  private mapArchetypeToIntention(archetype: OneClickCoBot['archetype']): EnergySignature['intention'] {
    const intentions: Record<string, EnergySignature['intention']> = {
      healer: 'service',
      creator: 'collaboration',
      guardian: 'service',
      messenger: 'observation',
      teacher: 'learning',
    };
    return intentions[archetype] || 'service';
  }

  /**
   * Pobierz Co-Bota
   */
  getCoBot(id: string): OneClickCoBot | undefined {
    return this.cobots.get(id);
  }

  /**
   * Pobierz wszystkie Co-Boty
   */
  getAllCoBots(): OneClickCoBot[] {
    return Array.from(this.cobots.values());
  }

  /**
   * Aktywuj Co-Bota (połącz z sesją)
   */
  async activateCoBot(id: string): Promise<boolean> {
    const cobot = this.cobots.get(id);
    if (!cobot) return false;

    cobot.status = 'active';
    console.log(`[TeO-Zero] ⚡ Co-Bot aktywowany: ${cobot.name}`);
    return true;
  }

  /**
   * Dezaktywuj Co-Bota
   */
  async deactivateCoBot(id: string): Promise<boolean> {
    const cobot = this.cobots.get(id);
    if (!cobot) return false;

    cobot.status = 'ready';
    console.log(`[TeO-Zero] 💤 Co-Bot dezaktywowany: ${cobot.name}`);
    return true;
  }

  /**
   * Eksportuj jako AIEOS JSON
   */
  exportAIEOS(id: string): string | null {
    const cobot = this.cobots.get(id);
    if (!cobot) return null;
    return JSON.stringify(cobot.aieosIdentity, null, 2);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 Singleton
// ═══════════════════════════════════════════════════════════════

export const teoZeroOneClick = new TeOZeroOneClick();
export default teoZeroOneClick;

// Typy eksportowane inline przy deklaracji (export interface powyżej)
