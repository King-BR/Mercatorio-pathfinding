const fs = require("fs");
const path = require("path");

const AREAS_DIR = "./areas_s8";
const TOWNS_FILE = "./data/towns_s8.json";
const OUTPUT_FILE = "./data/towns_s8.json";

// ---------------------------------------------------------
// Load towns
// ---------------------------------------------------------

const towns = require(TOWNS_FILE);

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
// This handles:
//   1.json
//   2_part0.json
//   2_part1.json
//   2_part2.json
//   3.json
//   etc.
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
let updatedTowns = [];

for (const town of towns) {
  const key = `${town.location.x},${town.location.y}`;

  const area = cellArea.get(key);

  if (area !== undefined) {
    if (!town.area || town.area !== area) {
      updated++;
      updatedTowns.push(town);
    }

    town.area = area;
    found++;

  } else {
    if (!town.area || town.area !== area) {
      updated++;
      updatedTowns.push(town);
    }

    town.area = null;
    notFound++;
    console.warn(
      `Could not find area for town "${town.name}" at ${town.location.x},${town.location.y}`
    );
  }
}

// ---------------------------------------------------------
// Save updated towns
// ---------------------------------------------------------

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(towns, null, 2)
);

console.log("");
console.log(`Done.`);
console.log(`Found:     ${found}`);
console.log(`Not found: ${notFound}`);
console.log(`Updated amount:   ${updated}`);
console.log(`Updated towns: ${updatedTowns.map(t => t.name).join(", ") || "None"}`);
console.log(`Saved to:  ${OUTPUT_FILE}`);