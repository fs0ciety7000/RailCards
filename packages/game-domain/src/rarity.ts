export const RARITY_CODES = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
] as const;

export type RarityCode = (typeof RARITY_CODES)[number];

export interface RarityDefinition {
  code: RarityCode;
  label: string;
  order: number;
  colorHex: string;
  /** Default draw weight out of 1000, used to seed BoosterPoolEntry rows. */
  defaultWeight: number;
}

export const RARITY_DEFINITIONS: RarityDefinition[] = [
  { code: "COMMON", label: "Commune", order: 1, colorHex: "#9AA5B1", defaultWeight: 550 },
  { code: "UNCOMMON", label: "Peu commune", order: 2, colorHex: "#3FB27F", defaultWeight: 250 },
  { code: "RARE", label: "Rare", order: 3, colorHex: "#2E7DD1", defaultWeight: 120 },
  { code: "EPIC", label: "Épique", order: 4, colorHex: "#9B4FE0", defaultWeight: 50 },
  { code: "LEGENDARY", label: "Légendaire", order: 5, colorHex: "#F0A93A", defaultWeight: 25 },
  { code: "MYTHIC", label: "Mythique", order: 6, colorHex: "#E0473B", defaultWeight: 5 },
];
