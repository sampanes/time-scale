// All times are in Ma (millions of years ago).
// Positive values are in the past, zero is now, and negative values are future events.
export const TIMELINE_ITEMS = [
  // Cosmological
  { id: "big-bang", name: "Big Bang", type: "event", start_ma: 13800, end_ma: 13800, aliases: ["big bang", "universe begins", "origin"] },
  { id: "first-stars", name: "First Stars", type: "event", start_ma: 13600, end_ma: 13600, aliases: ["first stars", "population iii stars"] },
  { id: "milky-way-forms", name: "Milky Way Forms", type: "event", start_ma: 13200, end_ma: 13200, aliases: ["milky way", "galaxy forms"] },
  { id: "solar-system", name: "Solar System Forms", type: "event", start_ma: 4600, end_ma: 4600, aliases: ["solar system", "sun forms", "solar nebula"] },

  // Eons
  { id: "hadean", name: "Hadean", type: "eon", start_ma: 4600, end_ma: 4031, aliases: ["hadean eon", "hadean"] },
  { id: "archean", name: "Archean", type: "eon", start_ma: 4031, end_ma: 2500, aliases: ["archean", "archaean"] },
  { id: "proterozoic", name: "Proterozoic", type: "eon", start_ma: 2500, end_ma: 538.8, aliases: ["proterozoic"] },
  { id: "phanerozoic", name: "Phanerozoic", type: "eon", start_ma: 538.8, end_ma: 0, aliases: ["phanerozoic"] },

  // Eras
  { id: "paleozoic", name: "Paleozoic", type: "era", start_ma: 538.8, end_ma: 251.9, aliases: ["paleozoic", "palaeozoic"] },
  { id: "mesozoic", name: "Mesozoic", type: "era", start_ma: 251.9, end_ma: 66, aliases: ["mesozoic", "age of dinosaurs", "age of reptiles"] },
  { id: "cenozoic", name: "Cenozoic", type: "era", start_ma: 66, end_ma: 0, aliases: ["cenozoic", "caenozoic", "age of mammals"] },

  // Periods - Paleozoic
  { id: "cambrian", name: "Cambrian", type: "period", start_ma: 538.8, end_ma: 485.4, aliases: ["cambrian", "cambrian explosion"] },
  { id: "ordovician", name: "Ordovician", type: "period", start_ma: 485.4, end_ma: 443.8, aliases: ["ordovician"] },
  { id: "silurian", name: "Silurian", type: "period", start_ma: 443.8, end_ma: 419.2, aliases: ["silurian"] },
  { id: "devonian", name: "Devonian", type: "period", start_ma: 419.2, end_ma: 358.9, aliases: ["devonian", "age of fishes"] },
  { id: "carboniferous", name: "Carboniferous", type: "period", start_ma: 358.9, end_ma: 298.9, aliases: ["carboniferous", "mississippian", "pennsylvanian", "coal age"] },
  { id: "permian", name: "Permian", type: "period", start_ma: 298.9, end_ma: 251.9, aliases: ["permian"] },

  // Periods - Mesozoic
  { id: "triassic", name: "Triassic", type: "period", start_ma: 251.9, end_ma: 201.4, aliases: ["triassic", "triassic period"] },
  { id: "jurassic", name: "Jurassic", type: "period", start_ma: 201.4, end_ma: 145, aliases: ["jurassic", "jurassic period"] },
  { id: "cretaceous", name: "Cretaceous", type: "period", start_ma: 145, end_ma: 66, aliases: ["cretaceous", "cretaceous period"] },

  // Periods - Cenozoic
  { id: "paleogene", name: "Paleogene", type: "period", start_ma: 66, end_ma: 23.03, aliases: ["paleogene", "palaeogene"] },
  { id: "neogene", name: "Neogene", type: "period", start_ma: 23.03, end_ma: 2.58, aliases: ["neogene"] },
  { id: "quaternary", name: "Quaternary", type: "period", start_ma: 2.58, end_ma: 0, aliases: ["quaternary"] },

  // Epochs - Paleogene
  { id: "paleocene", name: "Paleocene", type: "epoch", start_ma: 66, end_ma: 56, aliases: ["paleocene"] },
  { id: "eocene", name: "Eocene", type: "epoch", start_ma: 56, end_ma: 33.9, aliases: ["eocene"] },
  { id: "oligocene", name: "Oligocene", type: "epoch", start_ma: 33.9, end_ma: 23.03, aliases: ["oligocene"] },

  // Epochs - Neogene
  { id: "miocene", name: "Miocene", type: "epoch", start_ma: 23.03, end_ma: 5.33, aliases: ["miocene"] },
  { id: "pliocene", name: "Pliocene", type: "epoch", start_ma: 5.33, end_ma: 2.58, aliases: ["pliocene"] },

  // Epochs - Quaternary
  { id: "pleistocene", name: "Pleistocene", type: "epoch", start_ma: 2.58, end_ma: 0.0117, aliases: ["pleistocene", "ice age"] },
  { id: "holocene", name: "Holocene", type: "epoch", start_ma: 0.0117, end_ma: 0, aliases: ["holocene", "modern epoch"] },

  // Life events
  { id: "first-life", name: "First Life", type: "event", start_ma: 3800, end_ma: 3800, aliases: ["first life", "earliest life", "abiogenesis", "prokaryotes"] },
  { id: "first-eukaryotes", name: "First Eukaryotes", type: "event", start_ma: 2100, end_ma: 2100, aliases: ["eukaryotes", "first eukaryotes", "complex cells"] },
  { id: "great-oxidation", name: "Great Oxidation Event", type: "event", start_ma: 2400, end_ma: 2400, aliases: ["great oxidation", "oxygen crisis", "oxygen catastrophe"] },
  { id: "first-multicellular", name: "First Multicellular Life", type: "event", start_ma: 1200, end_ma: 1200, aliases: ["multicellular", "first multicellular"] },
  { id: "cambrian-explosion", name: "Cambrian Explosion", type: "event", start_ma: 538.8, end_ma: 515, aliases: ["cambrian explosion", "animal diversification"] },
  { id: "first-fish", name: "First Fish", type: "event", start_ma: 530, end_ma: 530, aliases: ["first fish", "fish", "vertebrates", "jawless fish"] },
  { id: "first-sharks", name: "First Sharks", type: "event", start_ma: 450, end_ma: 450, aliases: ["sharks", "first sharks", "chondrichthyes"] },
  { id: "first-land-plants", name: "First Land Plants", type: "event", start_ma: 470, end_ma: 470, aliases: ["land plants", "first plants", "plants on land"] },
  { id: "first-insects", name: "First Insects", type: "event", start_ma: 385, end_ma: 385, aliases: ["insects", "first insects"] },
  { id: "first-amphibians", name: "First Amphibians", type: "event", start_ma: 375, end_ma: 375, aliases: ["amphibians", "first amphibians", "tetrapods", "tiktaalik"] },
  { id: "first-reptiles", name: "First Reptiles", type: "event", start_ma: 312, end_ma: 312, aliases: ["reptiles", "first reptiles", "amniotes"] },
  { id: "permian-extinction", name: "Permian Mass Extinction", type: "event", start_ma: 251.9, end_ma: 251.9, aliases: ["permian extinction", "great dying", "p-t extinction", "end permian"] },
  { id: "first-dinosaurs", name: "First Dinosaurs", type: "event", start_ma: 245, end_ma: 245, aliases: ["dinosaurs", "first dinosaurs"] },
  { id: "first-mammals", name: "First Mammals", type: "event", start_ma: 225, end_ma: 225, aliases: ["mammals", "first mammals"] },
  { id: "first-birds", name: "First Birds", type: "event", start_ma: 150, end_ma: 150, aliases: ["birds", "first birds", "archaeopteryx"] },
  { id: "first-flowers", name: "First Flowering Plants", type: "event", start_ma: 130, end_ma: 130, aliases: ["flowers", "flowering plants", "angiosperms"] },
  { id: "mass-extinction-kpg", name: "K-Pg Mass Extinction", type: "event", start_ma: 66, end_ma: 66, aliases: ["k-pg", "kpg", "cretaceous extinction", "asteroid", "chicxulub", "dinosaur extinction", "end cretaceous"] },
  { id: "first-primates", name: "First Primates", type: "event", start_ma: 55, end_ma: 55, aliases: ["primates", "first primates"] },
  { id: "first-grasses", name: "First Grasses", type: "event", start_ma: 55, end_ma: 55, aliases: ["grass", "grasses", "grasslands"] },
  { id: "first-whales", name: "First Whales", type: "event", start_ma: 50, end_ma: 50, aliases: ["whales", "first whales", "cetaceans"] },
  { id: "himalayas", name: "Himalayas Begin Forming", type: "event", start_ma: 50, end_ma: 50, aliases: ["himalayas", "himalaya", "india collision"] },
  { id: "first-horses", name: "First Horses", type: "event", start_ma: 55, end_ma: 55, aliases: ["horses", "first horses", "equus", "eohippus"] },
  { id: "first-hominids", name: "First Great Apes", type: "event", start_ma: 15, end_ma: 15, aliases: ["great apes", "hominids", "hominidae", "apes"] },
  { id: "first-hominins", name: "First Hominins", type: "event", start_ma: 7, end_ma: 7, aliases: ["hominins", "bipedal", "australopithecus", "early humans"] },
  { id: "homo-erectus", name: "Homo Erectus", type: "event", start_ma: 1.9, end_ma: 1.9, aliases: ["homo erectus", "erectus"] },
  { id: "first-humans", name: "Homo Sapiens", type: "event", start_ma: 0.3, end_ma: 0.3, aliases: ["homo sapiens", "humans", "first humans", "modern humans", "people"] },
  { id: "first-agriculture", name: "First Agriculture", type: "event", start_ma: 0.012, end_ma: 0.012, aliases: ["agriculture", "farming", "neolithic", "civilization begins"] },
  { id: "now", name: "Now", type: "event", start_ma: 0, end_ma: 0, aliases: ["now", "today", "present", "current"] },

  // Future
  { id: "sun-expands", name: "Sun Leaves Main Sequence", type: "future", start_ma: -5000, end_ma: -5000, aliases: ["sun expands", "sun red giant", "main sequence", "sun dies"] },
  { id: "earth-sterilized", name: "Earth Surface Sterilized", type: "future", start_ma: -5400, end_ma: -5400, aliases: ["earth sterilized", "life ends", "earth consumed", "sun consumes earth"] },
  { id: "sun-white-dwarf", name: "Sun Becomes White Dwarf", type: "future", start_ma: -7500, end_ma: -7500, aliases: ["white dwarf", "sun white dwarf"] },
  { id: "last-stars", name: "Last Stars Burn Out", type: "future", start_ma: -100000000, end_ma: -100000000, aliases: ["last stars", "stellar era ends", "no more stars"] },
  { id: "heat-death", name: "Heat Death of Universe", type: "future", start_ma: -1e32, end_ma: -1e32, aliases: ["heat death", "end of universe", "maximum entropy", "big freeze"] },
];

export const TYPE_COLORS = {
  eon: ["#8b1a1a", "#a02020", "#b52e2e", "#c73c3c"],
  era: ["#1a4a8b", "#1e5aa0", "#2269b5", "#2878ca"],
  period: ["#1a6b3a", "#207d44", "#268f4e", "#2ca158"],
  epoch: ["#5a4a00", "#6e5c00", "#826e00", "#9a8200"],
  event: ["#4a1a6b", "#5c207d", "#6e268f", "#7a2ea0"],
  future: ["#1a3a5a", "#1e4a70", "#225a86", "#266a9c"],
};

export const PRESETS = [
  { id: "eons", label: "Eons", queries: ["hadean", "archean", "proterozoic", "phanerozoic"] },
  { id: "paleozoic", label: "Paleozoic", queries: ["cambrian", "ordovician", "silurian", "devonian", "carboniferous", "permian"] },
  {
    id: "cosmic",
    label: "Big Bang -> Heat Death",
    queries: ["big bang", "first stars", "first life", "first fish", "first sharks", "dinosaurs", "mass extinction k-pg", "first humans", "now", "sun expands", "heat death"],
  },
  { id: "recent-3", label: "Recent 3", queries: ["paleogene", "neogene", "quaternary"] },
  { id: "mesozoic", label: "Mesozoic", queries: ["triassic", "jurassic", "cretaceous"] },
];
