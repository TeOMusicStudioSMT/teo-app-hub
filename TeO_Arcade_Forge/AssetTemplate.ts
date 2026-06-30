// KATEDRA OTAKOS — WYMIAR 0.00G — APARAT KREACJI PROCEDURALNEJ
// [FILAR II — TE_ARCADE_FORGE — ASSET_TEMPLATE]
//
// 🔌 RUROCIĄG (Klaudiusz): ZlotyTostPortal jest MATERIALIZOWANY z kodu w UE przez
// `ue_scripts/story_compiler.py` → build_aether: kromka (box dims x200/y50/z250 = template) z materiałem
// M_Toast_Bread (#D2691E) + galaktyczny rdzeń (dysk emisyjny cyjan, M_Galaxy_Core HDR). Zero pobierania.
// Niagara NE_Galaxy_Vortex_Core (vfx) = etap 2 (Content Examples). Geometria liczona LOKALNIE (0.00G).

export interface TextureChannel {
  type: 'Albedo' | 'Normal' | 'Roughness' | 'Metallic' | 'Emissive';
  proceduralFormula?: string; // Formuła dla generatora szumu lokalnego (0.00G)
  baseColorHEX?: string;
}

export interface UnrealVFX {
  systemType: 'Niagara' | 'Cascade';
  emitterName: string;
  particleCount: number;
  colorSpectrum: string[]; // np. ['#8A2BE2', '#00FFFF'] (fiolet/cyjan)
}

export interface KatedralnyAsset {
  id: string;
  name: string;
  tier: 'Basic' | 'Full'; // Optymalizacja pod 16GB RAM Suwerena
  geometry: {
    primitiveShape: 'Box' | 'Cylinder' | 'Sphere' | 'CustomWoxel';
    dimensions: { x: number; y: number; z: number };
    vertexCountPlaceholder: number;
  };
  textures: TextureChannel[];
  vfx?: UnrealVFX;
  compliance: {
    requiresEpicLicense: boolean;
    openSourceAlternativeAvailable: boolean;
    maxMarketplaceCostGRV: number;
  };
}

// =========================================================================
// 🚀 INSTANCJA GENERATORA: ZŁOTY TOST Z GALAKTYCZNYM WIREM (BRAMA AETHER)
// =========================================================================

export const ZlotyTostPortal: KatedralnyAsset = {
  id: "asset_tost_portal_v0",
  name: "Zloty_TOST_Brama_Aether",
  tier: "Basic", // Lekki, optymalny kod geometryczny, który nie wysadzi 16GB RAM-u
  geometry: {
    primitiveShape: "CustomWoxel", // Kształt przypalonej kromki chleba o strukturze 3D
    dimensions: { x: 200, y: 50, z: 250 }, // Obniżony do wysokości wzroku Konstruktora
    vertexCountPlaceholder: 496 // Splątany numerycznie z Twoją bazą 496 obiektów-zdjęć
  },
  textures: [
    { type: "Albedo", baseColorHEX: "#D2691E" }, // Ciepły, chlebowy brąz, przypalone boki
    { type: "Metallic", proceduralFormula: "Math.sqrt(noise) * 0.2" },
    { type: "Emissive", baseColorHEX: "#00FFFF" } // Cyjanowy blask wiru galaktycznego w środku
  ],
  vfx: {
    systemType: "Niagara",
    emitterName: "NE_Galaxy_Vortex_Core",
    particleCount: 1500,
    colorSpectrum: ["#8A2BE2", "#00FFFF", "#FF69B4"] // Kosmiczny wir: fiolet, cyjan, magenta
  },
  compliance: {
    requiresEpicLicense: false, // W 100% nasz autorski, lokalny kod
    openSourceAlternativeAvailable: true,
    maxMarketplaceCostGRV: 0 // Darmowy punkt startowy dla każdego Teonauty
  }
};