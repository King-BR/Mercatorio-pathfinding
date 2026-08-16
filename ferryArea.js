const fs = require("fs");
const path = require("path");

const AREAS_DIR = "./areas_s7";
const FERRIES_FILE = "./ferries_s7.json";
const OUTPUT_FILE = "./ferries_s7.json";

// ---------------------------------------------------------
// Load ferries
// ---------------------------------------------------------

const ferries = require(FERRIES_FILE);

// ---------------------------------------------------------
// Find all area files
// ---------------------------------------------------------

const files = fs
  .readdirSync(AREAS_DIR)
  .filter(file => file.endsWith(".json"));

console.log(`Found ${files.length} area files.`);

// ---------------------------------------------------------
// Build a map:
// coordinate -> area
//
// ---------------------------------------------------------

const cellArea = new Map();

for (const file of files) {
  const filePath = path.join(AREAS_DIR, file);

  console.log(`Loading ${file}...`);

  const cells = require(`./${filePath}`);

  for (const cell of cells) {
    if (!cell || cell.x === undefined || cell.y === undefined) {
      continue;
    }

    const key = `${cell.x},${cell.y}`;

    // Assuming the area ID is stored here
    const area = cell.data?.area;

    if (area === undefined) {
      continue;
    }

    cellArea.set(key, area);
  }
}

console.log(`Indexed ${cellArea.size} cells.`);

// ---------------------------------------------------------
// Find area for each town
// ---------------------------------------------------------

let found = 0;
let notFound = 0;
let updated = 0;
let updatedLandings = 0;
let updatedFerries = [];

for (const ferry of ferries) {
  const key = `${ferry.location.x},${ferry.location.y}`;

  const area = cellArea.get(key);

  if (area !== undefined) {
    if (!ferry.area || ferry.area !== area || ferry.landings?.some(landing => landing.area !== area)) {
      updated++;
      updatedFerries.push(ferry.name);
    }

    ferry.landings?.forEach(landing => {
      landing.area = cellArea.get(`${landing.location.x},${landing.location.y}`) || null;
      if (landing.area !== null) {
        updatedLandings++;
      }
    });

    ferry.area = area;
    found++;

  } else {
    if (!ferry.area || ferry.area !== area || ferry.landings?.some(landing => landing.area !== area)) {
      updated++;
      updatedFerries.push(ferry.name);
    }

    ferry.area = null;
    notFound++;
    console.warn(
      `Could not find area for ferry "${ferry.name}" at ${ferry.location.x},${ferry.location.y}`
    );
  }
}

// ---------------------------------------------------------
// Save updated ferries
// ---------------------------------------------------------

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(ferries, null, 2)
);

console.log("");
console.log(`Done.`);
console.log(`Found:     ${found}`);
console.log(`Not found: ${notFound}`);
console.log(`Updated amount:   ${updated}`);
console.log(`Updated landings: ${updatedLandings}`);
console.log(`Updated ferries: ${updatedFerries.join(", ") || "None"}`);
console.log(`Saved to:  ${OUTPUT_FILE}`);