const fs = require("fs");
const path = require("path");
const Pathfinder = require("./pathfinding.js");

const season = "s8";

const townStats = require(`./data/stats_${season}.json`);
const AREAS_DIR = `./areas_${season}`;
const FERRIES_FILE = `./data/ferries_${season}.json`;
const OUTPUT_FILE = `./data/ferries_${season}.json`;

// ---------------------------------------------------------
// Load ferries
// ---------------------------------------------------------

const ferries = require(FERRIES_FILE);

// ---------------------------------------------------------
// Find all area files
// ---------------------------------------------------------

const files = fs
  .readdirSync(AREAS_DIR)
  .filter((file) => file.endsWith(".json"));

console.log(`Found ${files.length} area files.`);

// ---------------------------------------------------------
// Build a map (coordinate -> area) and create grid for pathfinding
// ---------------------------------------------------------
const cellArea = new Map();
const grid = [];

for (const file of files) {
  const filePath = path.join(AREAS_DIR, file);

  console.log(`Loading ${file}...`);

  const cells = require(`./${filePath}`);

  for (const cell of cells) {
    if (!cell || cell.x === undefined || cell.y === undefined) {
      continue;
    }

    grid.push(cell);

    const key = `${cell.x},${cell.y}`;
    const area = cell.data?.area;

    if (area === undefined) {
      continue;
    }

    cellArea.set(key, area);
  }
}

console.log(`Indexed ${cellArea.size} cells.`);

// ---------------------------------------------------------
// Find area and path for each ferry
// ---------------------------------------------------------

var found = 0;
var notFound = 0;
var updated = 0;
var updatedLandings = 0;
var updatedFerries = [];
var ferryCount = 0;

for (const ferry of ferries) {
  ferry.ferryId = ferryCount;
  ferryCount++;
  const key = `${ferry.location.x},${ferry.location.y}`;

  const area = cellArea.get(key);

  if (area !== undefined) {
    if (
      !ferry.area ||
      ferry.area !== area ||
      ferry.landings?.some((landing) => landing.area !== area)
    ) {
      updated++;
      updatedFerries.push(ferry.name);
    }

    ferry.landings?.forEach((landing) => {
      landing.area =
        cellArea.get(`${landing.location.x},${landing.location.y}`) || null;
      if (landing.area !== null) {
        updatedLandings++;
      }
    });

    ferry.area = area;
    found++;
  } else {
    if (
      !ferry.area ||
      ferry.area !== area ||
      ferry.landings?.some((landing) => landing.area !== area)
    ) {
      updated++;
      updatedFerries.push(ferry.name);
    }

    ferry.area = null;
    notFound++;
    console.warn(
      `Could not find area for ferry "${ferry.name}" at ${ferry.location.x},${ferry.location.y}`,
    );
  }

  if (
    !townStats[ferry.name].landlocked &&
    ferry.landings &&
    ferry.landings.length > 0
  ) {
    // find nearest adjacent water cell next to ferry starting location
    const startWaterTile = grid.find((cell) => {
      return (
        cell.data.type != undefined &&
        Math.abs(cell.x - ferry.location.x) <= 1 &&
        Math.abs(cell.y - ferry.location.y) <= 1 &&
        Math.abs(cell.x - ferry.location.x) !=
          Math.abs(cell.y - ferry.location.y)
      );
    });

    const start = {
      x: startWaterTile.x,
      y: startWaterTile.y,
    };

    var landingCount = 0;

    for (const landing of ferry.landings) {
      // find nearest adjacent water cell next to landing location
      const goalWaterTile = grid.find((cell) => {
        return (
          cell.data.type != undefined &&
          Math.abs(cell.x - landing.location.x) <= 1 &&
          Math.abs(cell.y - landing.location.y) <= 1 &&
          Math.abs(cell.x - landing.location.x) !=
            Math.abs(cell.y - landing.location.y)
        );
      });

      const goal = {
        x: goalWaterTile.x,
        y: goalWaterTile.y,
      };

      const pathfinder = new Pathfinder(grid);
      const ferryPath = pathfinder.findPath(start, goal);

      ferryPath.path.forEach((step) => {
        delete step.totalMovementCost;
        delete step.totalMoneyCost;
        delete step.details;
        delete step.data;
        delete step.area;
        delete step.moneyCost;
        if (step.type == "water" || step.type == "land") delete step.type;
      });

      ferryPath.path = ferryPath.path.map((step) => {
        return [step.x, step.y];
      });

      if (landing.path != ferryPath?.path) {
        updatedLandings++;
      }

      landing.path = ferryPath?.path || [];
      landing.id = landingCount;
      landingCount++;
    }
  } else {
    delete ferry.landings;
  }
}

// ---------------------------------------------------------
// Save updated ferries
// ---------------------------------------------------------

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(ferries, null, 2));

console.log("");
console.log(`Done.`);
console.log(`Found:     ${found}`);
console.log(`Not found: ${notFound}`);
console.log(`Updated amount:   ${updated}`);
console.log(`Updated landings: ${updatedLandings}`);
console.log(`Updated ferries: ${updatedFerries.join(", ") || "None"}`);
console.log(`Saved to:  ${OUTPUT_FILE}`);
