const fs = require("fs");
const path = require("path");
const Pathfinder = require("./pathfinding.js");

const season = "s7";

// ---------------------------------------------------------
// Carrega todos os arquivos da pasta areas/
// ---------------------------------------------------------

const areasDir = path.join(__dirname, `areas_${season}`);

const areaFiles = fs
  .readdirSync(areasDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

console.log(`Found ${areaFiles.length} area files.`);

const grid = [];

var loadingProgress = 0;
var loadingBarSections = areaFiles.length > 25 ? 25 : areaFiles.length;
var areasPerSection = Math.ceil(areaFiles.length / loadingBarSections);

const debug = process.argv.includes("--debug");

for (const file of areaFiles) {
  const filePath = path.join(areasDir, file);

  try {
    const cells = require(filePath);

    if (debug) console.log(`Loading ${file}: ${cells.length} cells`);

    // Não usar grid.push(...cells)
    // porque arquivos grandes podem estourar o limite
    // de argumentos do JavaScript.
    for (const cell of cells) {
      grid.push(cell);
    }
  } catch (error) {
    console.error(`Error loading ${file}:`, error.message);
    process.exit(1);
  }

  // loading bar
  loadingProgress++;

  if (
    (loadingProgress % areasPerSection === 0 ||
      loadingProgress === areaFiles.length) &&
    !debug
  ) {
    const percent = Math.round((loadingProgress / areaFiles.length) * 100);
    const filledLength = Math.round((percent / 100) * loadingBarSections);
    const bar =
      "█".repeat(filledLength) + "-".repeat(loadingBarSections - filledLength);
    console.log(
      `Loading areas... [${bar}] ${percent}% (${loadingProgress}/${areaFiles.length})`,
    );
  }
}

console.log(`Total cells loaded: ${grid.length}`);

// ---------------------------------------------------------
// Ferries
// ---------------------------------------------------------

const ferries = require(`./ferries_${season}.json`);

var ferryCount = 0;

for (const ferry of ferries) {
  if (ferry.landings && ferry.landings.length > 0) {
    ferryCount += ferry.landings.length;
  }
}

console.log(`Loaded ${ferries.length} towns that can have ferries.`);
console.log(`Loaded ${ferryCount} ferry landings.`);

// ---------------------------------------------------------
// Cria Pathfinder com o mapa inteiro
// ---------------------------------------------------------

const pf = new Pathfinder(grid, ferries);

// ---------------------------------------------------------
// Carrega cidades
// ---------------------------------------------------------

const towns = require(`./towns_${season}.json`);

console.log(`Loaded ${towns.length} towns.`);

if (!towns || towns.length === 0) {
  console.error(`Error loading towns_${season}.json: No towns found.`);
asssss
  process.exit(1);
}

// ---------------------------------------------------------
// Pathfinding
// ---------------------------------------------------------

var town2 = towns.find((town) => town.name === "Dusseldorf");

var town1 = towns.find((town) => town.name === "Amsderlid");

const start = {
  x: town1.location.x,
  y: town1.location.y,
};

const goal = {
  x: town2.location.x,
  y: town2.location.y,
};

const result = pf.findPath(start, goal);

console.log(`\n\nPath from ${town1.name} to ${town2.name}`);
console.log(`Total steps: ${result.path.length}`);
console.log(`Total movement cost: ${result.totalMovementCost}`);
console.log(`Total money cost: ${result.totalMoneyCost}`);

fs.writeFileSync(
  path.join(__dirname, `path.json`),
  JSON.stringify(result, null, 2),
);
