import type { TagCategoryDefinition } from './tagCategoryTypes.ts'

export const STATIC_TAG_CATEGORIES: TagCategoryDefinition[] = [
  {
    id: 'people',
    label: 'Menschen',
    iconId: 'smile',
    keywords: [
      'mensch', 'person', 'people', 'portrait', 'porträt', 'gesicht', 'face', 'mann', 'frau',
      'kind', 'junge', 'mädchen', 'familie', 'gruppe', 'baby', 'hand', 'hände', 'haare', 'figur',
    ],
  },
  {
    id: 'animals',
    label: 'Tiere',
    iconId: 'paw',
    keywords: [
      'tier', 'animal', 'tierportrait', 'tierporträt', 'animalportrait', 'wildtier', 'wildlife',
      'hund', 'dog', 'katze', 'cat', 'vogel', 'bird',
      'schwan', 'schwäne', 'swan', 'ente', 'duck', 'gans', 'goose', 'adler', 'eagle', 'eule', 'owl',
      'pferd', 'horse', 'kuh', 'cow', 'schaf', 'sheep', 'ziege', 'goat', 'fisch', 'fish',
      'wal', 'whale', 'delfin', 'dolphin', 'hai', 'shark', 'biene', 'bee', 'insekt', 'insect',
      'schmetterling', 'butterfly', 'löwe', 'lion', 'tiger', 'bär', 'bear', 'affe', 'monkey',
      'fuchs', 'fox', 'wolf', 'reh', 'deer', 'eichhörnchen', 'squirrel', 'hase', 'rabbit', 'zoo',
    ],
  },
  {
    id: 'plants',
    label: 'Pflanzen & Blumen',
    iconId: 'sprout',
    keywords: [
      'pflanze', 'plant', 'blume', 'flower', 'rose', 'tulpe', 'tulip', 'lavendel', 'lavender',
      'blatt', 'leaf', 'kaktus', 'cactus', 'pilz', 'mushroom', 'garten', 'garden', 'frühling', 'spring',
    ],
  },
  {
    id: 'nature',
    label: 'Natur & Landschaft',
    iconId: 'tree',
    keywords: [
      'natur', 'landschaft', 'landscape', 'baum', 'bäume', 'tree', 'wald', 'forest', 'berg',
      'mountain', 'see', 'lake', 'fluss', 'river', 'meer', 'ocean', 'strand', 'beach', 'wiese',
      'wasser', 'water', 'teich', 'fjord', 'wüste', 'desert', 'insel', 'island', 'wasserfall',
      'waterfall', 'höhle', 'cave', 'outdoor', 'imfreien',
    ],
  },
  {
    id: 'weatherLight',
    label: 'Wetter & Licht',
    iconId: 'sun',
    keywords: [
      'himmel', 'sky', 'wolke', 'cloud', 'sonne', 'sun', 'licht', 'light', 'schatten', 'shadow',
      'nacht', 'night', 'winter', 'schnee', 'snow', 'eis', 'ice', 'regen', 'rain', 'sturm', 'storm',
      'nebel', 'fog', 'wetter', 'weather', 'sonnenuntergang', 'sunset', 'sonnenaufgang', 'sunrise',
    ],
  },
  {
    id: 'places',
    label: 'Orte & Architektur',
    iconId: 'building',
    keywords: [
      'architektur', 'architecture', 'gebäude', 'building', 'haus', 'home', 'stadt', 'city',
      'straße', 'street', 'brücke', 'bridge', 'turm', 'tower', 'kirche', 'church', 'museum',
      'innenraum', 'interior', 'fenster', 'window', 'tür', 'door', 'park', 'dorf', 'village',
      'fabrik', 'factory', 'festung', 'burg', 'castle', 'platz', 'place', 'tempel', 'temple',
    ],
  },
  {
    id: 'art',
    label: 'Kunst & Illustration',
    iconId: 'brush',
    keywords: [
      'kunst', 'art', 'gemälde', 'painting', 'malen', 'illustration', 'zeichnung', 'drawing',
      'skulptur', 'sculpture', 'grafik', 'graphic', 'comic', 'streetart', 'graffiti',
    ],
  },
  {
    id: 'composition',
    label: 'Aufnahme & Komposition',
    iconId: 'camera',
    keywords: [
      'aufnahme', 'foto', 'photo', 'fotografie', 'photography', 'nahaufnahme', 'closeup',
      'makro', 'macro', 'symmetrie', 'symmetry', 'perspektive', 'perspective', 'detail',
      'hintergrund', 'background', 'minimalistisch', 'minimalist',
    ],
  },
  {
    id: 'food',
    label: 'Essen & Trinken',
    iconId: 'utensils',
    keywords: [
      'essen', 'food', 'getränk', 'drink', 'obst', 'fruit', 'gemüse', 'vegetable', 'kaffee',
      'coffee', 'tee', 'tea', 'kuchen', 'cake', 'brot', 'bread', 'restaurant', 'küche', 'kitchen',
    ],
  },
  {
    id: 'colorMood',
    label: 'Farbe & Stimmung',
    iconId: 'palette',
    keywords: [
      'farbe', 'color', 'bunt', 'colorful', 'dunkel', 'dark', 'hell', 'bright', 'rot', 'red',
      'blau', 'blue', 'grün', 'green', 'gelb', 'yellow', 'schwarz', 'black', 'weiß', 'white',
      'ruhig', 'calm', 'dramatisch', 'dramatic', 'fröhlich', 'joyful', 'düster', 'moody',
    ],
  },
  {
    id: 'technologyMedia',
    label: 'Technik & Medien',
    iconId: 'cpu',
    keywords: [
      'technik', 'technology', 'computer', 'monitor', 'kamera', 'camera', 'telefon', 'phone',
      'smartphone', 'roboter', 'robot', 'maschine', 'machine', 'digital', 'virtualreality',
      'videospiel', 'gaming', 'elektronik', 'electronic',
    ],
  },
  {
    id: 'scienceSpace',
    label: 'Wissenschaft & Weltraum',
    iconId: 'rocket',
    keywords: [
      'wissenschaft', 'science', 'weltraum', 'space', 'planet', 'mond', 'moon', 'stern', 'star',
      'galaxie', 'galaxy', 'astronaut', 'raumstation', 'spacecraft', 'rakete', 'rocket', 'labor',
    ],
  },
  {
    id: 'transportTravel',
    label: 'Verkehr & Reisen',
    iconId: 'car',
    keywords: [
      'auto', 'car', 'fahrzeug', 'vehicle', 'zug', 'train', 'flugzeug', 'plane', 'schiff', 'ship',
      'boot', 'boat', 'fahrrad', 'bicycle', 'motorrad', 'motorcycle', 'reise', 'travel', 'urlaub',
    ],
  },
  {
    id: 'activities',
    label: 'Aktivitäten & Sport',
    iconId: 'activity',
    keywords: [
      'aktivität', 'activity', 'sport', 'spiel', 'game', 'laufen', 'running', 'schwimmen',
      'swimming', 'wandern', 'hiking', 'tanzen', 'dancing', 'fussball', 'football', 'musik', 'music',
    ],
  },
  {
    id: 'fashion',
    label: 'Mode & Kleidung',
    iconId: 'shirt',
    keywords: [
      'mode', 'fashion', 'kleidung', 'clothing', 'shirt', 'tshirt', 'jacke', 'jacket', 'kleid',
      'dress', 'schuh', 'shoe', 'hut', 'hat', 'jumpsuit', 'lederjacke',
    ],
  },
  {
    id: 'textSigns',
    label: 'Text & Zeichen',
    iconId: 'type',
    keywords: [
      'text', 'schrift', 'typografie', 'typography', 'schild', 'sign', 'verkehrsschild',
      'buchstabe', 'letter', 'zahl', 'number', 'logo', 'symbol',
    ],
  },
  {
    id: 'materials',
    label: 'Materialien & Oberflächen',
    iconId: 'shapes',
    keywords: [
      'material', 'holz', 'wood', 'metall', 'metal', 'glas', 'glass', 'stein', 'stone', 'stoff',
      'fabric', 'leder', 'leather', 'beton', 'concrete', 'textur', 'texture',
    ],
  },
  {
    id: 'objects',
    label: 'Objekte',
    iconId: 'shapes',
    keywords: [
      'objekt', 'object', 'möbel', 'furniture', 'stuhl', 'chair', 'tisch', 'table', 'lampe',
      'lamp', 'uhr', 'clock', 'werkzeug', 'tool', 'buch', 'book', 'spielzeug', 'toy',
    ],
  },
  {
    id: 'themes',
    label: 'Themen & Motive',
    iconId: 'tags',
    keywords: [
      'thema', 'theme', 'motiv', 'abstrakt', 'abstract', 'fantasie', 'fantasy', 'cyberpunk',
      'retro', 'vintage', 'futuristisch', 'futuristic',
    ],
  },
]
