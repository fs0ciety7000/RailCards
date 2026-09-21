/**
 * Fictional RailCards catalog seed data.
 *
 * All names, characters and anecdotes below are original and fictional.
 * No real logos, liveries, employee likenesses or protected assets are
 * referenced. Card art uses elegant placeholder illustrations
 * (see /public/card-placeholders) until real artwork is commissioned —
 * see docs/product/known-limitations.md.
 */

export type SeedRarityCode = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
export type SeedCategory =
  | "ROLLING_STOCK"
  | "STATION_PLACE"
  | "PROFESSION"
  | "DAILY_LIFE_HUMOR"
  | "SPECIAL_EDITION";

export interface SeedCard {
  slug: string;
  name: string;
  description: string;
  flavorText?: string;
  rarity: SeedRarityCode;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  combatStatsEnabled?: boolean;
  combatStats?: { power: number; reliability: number; charm: number };
}

export interface SeedSeries {
  slug: string;
  name: string;
  description: string;
  category: SeedCategory;
  cards: SeedCard[];
}

export const SEED_SERIES: SeedSeries[] = [
  {
    slug: "locomotives-et-materiel",
    name: "Locomotives & Matériel",
    description:
      "Le matériel roulant qui fait (ou ne fait pas) rouler le réseau, des increvables aux prototypes oubliés.",
    category: "ROLLING_STOCK",
    cards: [
      { slug: "type-13-tractrice-inlassable", name: "Type 13 — La Tractrice Inlassable", description: "Une locomotive polyvalente qui tracte tout, du fret au régional, sans jamais se plaindre.", rarity: "COMMON" },
      { slug: "voiture-m6-duplex-ponctuel", name: "Voiture M6 — Le Duplex Ponctuel", description: "Deux étages, une seule ambition : arriver à l'heure, ou presque.", rarity: "COMMON" },
      { slug: "type-77-manoeuvrier-increvable", name: "Type 77 — Le Manœuvrier Increvable", description: "On l'a vue pousser des wagons dans tous les dépôts du pays depuis 40 ans.", rarity: "COMMON" },
      { slug: "am96-navette-grise", name: "AM96 — La Navette Grise", description: "Discrète, efficace, un peu froide en hiver. Le pilier du trafic régional.", rarity: "COMMON" },
      { slug: "wagon-frein-veteran-rouille", name: "Wagon-frein — Le Vétéran Rouillé", description: "Personne ne sait exactement depuis quand il roule. Lui non plus.", rarity: "COMMON" },
      { slug: "draisine-entretien-cafard-des-voies", name: "Draisine d'Entretien — Le Cafard des Voies", description: "Elle sort la nuit, répare ce qui doit l'être, et disparaît avant le premier train.", rarity: "COMMON" },
      { slug: "desiro-ml-etoile-filante", name: "Desiro ML — L'Étoile Filante", description: "Rapide, silencieuse, et fière de sa clim qui marche (la plupart du temps).", rarity: "UNCOMMON" },
      { slug: "hle18-bourrasque-electrique", name: "HLE 18 — La Bourrasque Électrique", description: "Une locomotive puissante capable de tracter les trains les plus lourds à travers les Ardennes.", rarity: "UNCOMMON" },
      { slug: "tgv-thalys-pba-fleche-rouge", name: "PBA — La Flèche Rouge", description: "Elle relie les capitales en un clin d'œil et ne connaît que la vitesse de croisière.", rarity: "RARE" },
      { slug: "autorail-41-fantome-des-ardennes", name: "Autorail 41 — Le Fantôme des Ardennes", description: "Retiré du service depuis longtemps, on jure encore l'apercevoir certains brouillards d'automne.", rarity: "RARE" },
      { slug: "loco-vapeur-type1-doyenne", name: "Type 1 Vapeur — La Doyenne à Vapeur", description: "La plus ancienne locomotive du patrimoine, encore sortie lors des grandes occasions.", rarity: "EPIC" },
      { slug: "prototype-hyperloop-wallon-mirage-2050", name: "Prototype H-2050 — Le Mirage Wallon", description: "Un prototype expérimental qui promet de relier Mons à Liège en douze minutes. Un jour.", rarity: "LEGENDARY" },
    ],
  },
  {
    slug: "gares-et-lieux",
    name: "Gares & Lieux",
    description: "De la cathédrale de verre au petit arrêt perdu, chaque gare a son caractère.",
    category: "STATION_PLACE",
    cards: [
      { slug: "petit-arret-trois-fontaines", name: "Petit Arrêt de Trois-Fontaines — Le Bout du Monde", description: "Deux trains par jour, un abri, et un silence que rien ne trouble.", rarity: "COMMON" },
      { slug: "buvette-de-gare-comptoir-du-cheminot", name: "Buvette de Gare — Le Comptoir du Cheminot", description: "Café tiède, blagues éculées, et la meilleure source d'informations non officielles du réseau.", rarity: "COMMON" },
      { slug: "passage-souterrain-labyrinthe-humide", name: "Passage Souterrain — Le Labyrinthe Humide", description: "Personne ne sait vraiment où mènent tous ses escaliers.", rarity: "COMMON" },
      { slug: "gare-de-namur-carrefour-wallon", name: "Gare de Namur — Le Carrefour Wallon", description: "Un nœud ferroviaire animé où toutes les correspondances se croisent (parfois).", rarity: "COMMON" },
      { slug: "gare-bruxelles-centrale-coeur-de-fer", name: "Bruxelles-Central — Le Cœur de Fer", description: "Le point de passage obligé, où tous les horaires se rejoignent et parfois se perdent.", rarity: "UNCOMMON" },
      { slug: "tunnel-du-soleil-trou-noir-bruxellois", name: "Tunnel du Soleil — Le Trou Noir Bruxellois", description: "Aucun signal téléphonique n'y a jamais survécu.", rarity: "UNCOMMON" },
      { slug: "terminus-oostende-bout-des-rails", name: "Oostende — Le Bout des Rails, Début des Vagues", description: "Là où la ligne s'arrête et où la mer du Nord commence.", rarity: "UNCOMMON" },
      { slug: "gare-anvers-central-cathedrale-des-rails", name: "Anvers-Central — La Cathédrale des Rails", description: "Un dôme monumental qui fait lever les yeux à chaque voyageur, même les plus pressés.", rarity: "RARE" },
      { slug: "quai-13-bruges-quai-fantome", name: "Quai 13, Bruges — Le Quai Fantôme", description: "Il n'apparaît sur aucun plan officiel. Et pourtant, des trains y passent.", rarity: "RARE" },
      { slug: "gare-liege-guillemins-envol-de-calatrava", name: "Liège-Guillemins — L'Envol de Calatrava", description: "Une verrière spectaculaire qui donne l'impression que la gare va s'envoler.", rarity: "EPIC" },
      { slug: "gare-abandonnee-fer-vert-ruine-verdoyante", name: "Gare Abandonnée de Fer-Vert — La Ruine Verdoyante", description: "La nature a repris ses droits sur les quais depuis la fermeture de la ligne, il y a un demi-siècle.", rarity: "MYTHIC" },
    ],
  },
  {
    slug: "metiers-du-rail",
    name: "Métiers du Rail",
    description: "Les visages (fictifs) qui font tourner le réseau, jour et nuit.",
    category: "PROFESSION",
    cards: [
      { slug: "le-conducteur-ponctuel", name: "Le Conducteur Ponctuel", description: "Il connaît chaque courbe de sa ligne par cœur, et n'a jamais raté un signal.", rarity: "COMMON" },
      { slug: "la-controleuse-implacable", name: "La Contrôleuse Implacable", description: "Aucun ticket périmé ne lui échappe, aucune excuse ne la surprend plus.", rarity: "COMMON" },
      { slug: "le-mecanicien-grognon", name: "Le Mécanicien Grognon", description: "Râle sur tout, répare tout, et refuse qu'on le remercie.", rarity: "COMMON" },
      { slug: "lagent-de-quai-matinal", name: "L'Agent de Quai Matinal", description: "Premier arrivé, dernier reparti, toujours de bonne humeur avant 6h.", rarity: "COMMON" },
      { slug: "le-nettoyeur-de-nuit", name: "Le Nettoyeur de Nuit", description: "Il redonne chaque nuit un semblant de dignité aux rames les plus éprouvées.", rarity: "COMMON" },
      { slug: "le-stagiaire-perdu", name: "Le Stagiaire Perdu", description: "Troisième semaine de stage, toujours pas trouvé le local du matériel.", rarity: "COMMON" },
      { slug: "laiguilleur-zen", name: "L'Aiguilleur Zen", description: "Rien ne le déstabilise, pas même trois retards simultanés sur son secteur.", rarity: "UNCOMMON" },
      { slug: "lingenieure-signalisation", name: "L'Ingénieure Signalisation", description: "Elle seule comprend vraiment pourquoi ce signal clignote comme ça depuis 2019.", rarity: "UNCOMMON" },
      { slug: "la-chef-de-gare-autoritaire", name: "La Chef de Gare Autoritaire", description: "Son sifflet est entendu, et obéi, jusqu'au bout du quai.", rarity: "RARE" },
      { slug: "le-syndicaliste-legendaire", name: "Le Syndicaliste Légendaire", description: "On raconte qu'il a négocié une pause café supplémentaire à lui seul, en 1987.", rarity: "LEGENDARY" },
      { slug: "la-directrice-generale-insaisissable", name: "La Directrice Générale Insaisissable", description: "Personne ne l'a jamais vue en réunion et pourtant tout le monde applique ses décisions.", rarity: "MYTHIC" },
    ],
  },
  {
    slug: "vie-de-quai",
    name: "Vie de Quai",
    description: "Les petits (més)aventures universelles de tout voyageur ferroviaire.",
    category: "DAILY_LIFE_HUMOR",
    cards: [
      { slug: "le-retard-de-3-minutes", name: "Le Retard de 3 Minutes", description: "Annoncé comme catastrophique dans l'appli, à peine remarqué sur le quai.", rarity: "COMMON" },
      { slug: "le-sandwich-triangle-eternel", name: "Le Sandwich Triangle Éternel", description: "Il est dans le distributeur depuis des mois. Peut-être des années.", rarity: "COMMON" },
      { slug: "lannonce-inaudible", name: "L'Annonce Inaudible", description: "Un mélange de grésillement et de bonne volonté qui ne dit rien à personne.", rarity: "COMMON" },
      { slug: "le-voyageur-sans-ticket", name: "Le Voyageur Sans Ticket", description: "Il a \"une appli qui bug\" à chaque contrôle, dans chaque train, depuis toujours.", rarity: "COMMON" },
      { slug: "le-wifi-fantome", name: "Le Wifi Fantôme", description: "Visible dans les paramètres, injoignable dans la réalité.", rarity: "COMMON" },
      { slug: "le-cafe-de-distributeur-suspect", name: "Le Café de Distributeur Suspect", description: "Sa couleur ne correspond à aucun café connu de la science.", rarity: "COMMON" },
      { slug: "la-correspondance-ratee", name: "La Correspondance Ratée", description: "Deux minutes d'écart, un quai à l'autre bout de la gare. Classique.", rarity: "UNCOMMON" },
      { slug: "la-place-reservee-occupee", name: "La Place Réservée Occupée", description: "Le voyageur qui l'occupe est certain, absolument certain, d'avoir raison.", rarity: "UNCOMMON" },
      { slug: "la-greve-surprise", name: "La Grève Surprise", description: "Annoncée la veille au soir, elle rebat tous les plans du lendemain.", rarity: "RARE" },
      { slug: "la-neige-qui-bloque-tout", name: "La Neige qui Bloque Tout", description: "Trois centimètres suffisent à ralentir tout un réseau, chaque année, comme une surprise totale.", rarity: "RARE" },
      { slug: "lhoraire-dete-mystique", name: "L'Horaire d'Été Mystique", description: "Personne ne sait qui le décide, ni pourquoi il change tout, chaque juin.", rarity: "EPIC" },
    ],
  },
  {
    slug: "editions-speciales",
    name: "Éditions Spéciales",
    description: "Cartes commémoratives et exclusives, hors du tirage classique.",
    category: "SPECIAL_EDITION",
    cards: [
      { slug: "fete-du-rail", name: "Fête du Rail", description: "Une carte souvenir de la grande fête annuelle du réseau, portes ouvertes sur tous les dépôts.", rarity: "UNCOMMON" },
      { slug: "nocturne-dhiver", name: "Nocturne d'Hiver", description: "Un dernier train qui glisse dans la nuit froide, silencieux, presque solennel.", rarity: "RARE" },
      { slug: "carte-anniversaire", name: "Carte Anniversaire", description: "Éditée chaque année pour célébrer un nouvel anniversaire du réseau fictif RailCards.", rarity: "RARE" },
      { slug: "edition-beta-testeur", name: "Édition Bêta Testeur", description: "Réservée aux tout premiers joueurs qui ont exploré RailCards avant tout le monde.", rarity: "EPIC" },
      { slug: "edition-limitee-aquarelle", name: "Édition Limitée Aquarelle", description: "Une réinterprétation du réseau à l'aquarelle, tirée à un nombre volontairement restreint d'exemplaires.", rarity: "EPIC" },
      { slug: "carte-fondateurs-railcards", name: "Carte Fondateurs RailCards", description: "Remise aux membres de la toute première bêta privée. Une pièce de l'histoire du jeu.", rarity: "LEGENDARY" },
      { slug: "100-ans-reseau-fictif", name: "100 Ans du Réseau Fictif", description: "Une carte commémorative marquant un siècle imaginaire de rails, de gares et d'anecdotes.", rarity: "MYTHIC" },
      { slug: "le-dernier-voyage-a-vapeur", name: "Le Dernier Voyage à Vapeur", description: "La toute dernière sortie officielle d'une locomotive à vapeur du patrimoine, avant sa retraite définitive.", rarity: "MYTHIC" },
    ],
  },
];

export const TOTAL_SEED_CARD_COUNT = SEED_SERIES.reduce((sum, s) => sum + s.cards.length, 0);
