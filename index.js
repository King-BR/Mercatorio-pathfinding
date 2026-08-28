const fs = require("fs");
const pathsystem = require("path");
const Pathfinder = require("./pathfinding.js");

const season = "s8";

// ---------------------------------------------------------
// Carrega todos os arquivos da pasta areas/
// ---------------------------------------------------------

const areasDir = pathsystem.join(__dirname, `areas_${season}`);

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
  const filePath = pathsystem.join(areasDir, file);

  try {
    const cells = require(filePath);

    if (debug) console.log(`Loading ${file}: ${cells.length} cells`);

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

const ferries = require(`./data/ferries_${season}.json`);

var ferryCount = 0;

for (const ferry of ferries) {
  if (ferry.landings && ferry.landings.length > 0) {
    ferryCount += ferry.landings.length;
  }
}

console.log(`Loaded ${ferryCount} ferry landings.`);

// ---------------------------------------------------------
// Cria Pathfinder com o mapa inteiro
// ---------------------------------------------------------

const pf = new Pathfinder(grid, ferries);

// ---------------------------------------------------------
// Carrega cidades
// ---------------------------------------------------------

const towns = require(`./data/towns_${season}.json`);
const townsStats = require(`./data/stats_${season}.json`);

console.log(`Loaded ${towns.length} towns.`);

if (!towns || towns.length === 0) {
  console.error(`Error loading data/towns_${season}.json: No towns found.`);

  process.exit(1);
}

// ---------------------------------------------------------
// Pathfinding
// ---------------------------------------------------------
/**
 *
 * @param {{id: number, name: string, altname: string, area: string, region: string, location: {x: number, y: number}}} town
 * @returns {Array<{from: {id: number, name: string, altname: string, area: string, region: string}, to: {id: number, name: string, altname: string, area: string, region: string}, isWaterPath: boolean, path: { totalMovementCost: number;totalMoneyCost: number;path: {type: string;x: number;y: number;area: number;data: any;totalMovementCost: number;totalMoneyCost: number;moveCost: number;moneyCost: number;details: any;}[];}}>} paths
 */
function getTownPaths(town) {
  const paths = [];

  // Se já existe um arquivo de paths para essa cidade, carrega ele e retorna
  if (
    fs.existsSync(
      pathsystem.join(
        __dirname,
        `paths_${season}/${town.name}_${town.id}.json`,
      ),
    )
  ) {
    const existingPaths = require(
      pathsystem.join(
        __dirname,
        `paths_${season}/${town.name}_${town.id}.json`,
      ),
    );
    console.log(
      `Loaded ${existingPaths.length} existing paths for town ${town.name} (${town.id})`,
    );
    return existingPaths;
  }

  for (const otherTown of towns) {
    // Pula se for a mesma cidade
    if (town.id === otherTown.id) continue;

    // Pula se já existe um caminho entre as duas cidades
    var alreadyExists = paths.some((path) => {
      return (
        (path.from.id === town.id && path.to.id === otherTown.id) ||
        (path.from.id === otherTown.id && path.to.id === town.id)
      );
    });

    if (alreadyExists) continue;

    const start = {
      x: town.location.x,
      y: town.location.y,
    };

    const goal = {
      x: otherTown.location.x,
      y: otherTown.location.y,
    };

    /*
     * checa se existe um caminho high-level (somente os nós de areas/ferries, sem calcular o caminho detalhado)
     * possivel entre as duas cidades
     */
    if (pf.reachable(start, goal)) {
      const path = pf.findPath(start, goal);

      if (path) {
        path.isWaterPath = false;
        path.from = {
          id: town.id,
          name: town.name,
          altname: town.altname,
          area: town.area,
          region: town.region,
        };

        path.to = {
          id: otherTown.id,
          name: otherTown.name,
          altname: otherTown.altname,
          area: otherTown.area,
          region: otherTown.region,
        };

        paths.push(path);
      }
    }

    // checa se ambas as cidades tem acesso a um oceano/rio/lago navegavel (não são landlocked)
    if (
      !townsStats[town.name].landlocked &&
      !townsStats[otherTown.name].landlocked
    ) {
      // pega a célula de água que age como o "porto" de cada cidade
      const startWaterTile = grid.find((cell) => {
        return (
          cell.data.type != null &&
          Math.abs(cell.x - town.location.x) <= 1 &&
          Math.abs(cell.y - town.location.y) <= 1
        );
      });

      const goalWaterTile = grid.find((cell) => {
        return (
          cell.data.type != null &&
          Math.abs(cell.x - otherTown.location.x) <= 1 &&
          Math.abs(cell.y - otherTown.location.y) <= 1
        );
      });

      /*
       * Checa se ambas as cidades tem acesso ao mesmo oceano (mesma area navegavel de água)
       * e se exist um caminho high-level (somente os nós de areas/ferries, sem calcular o caminho detalhado)
       * possivel entre as duas cidades
       */
      if (
        startWaterTile &&
        goalWaterTile &&
        pf.reachable(startWaterTile, goalWaterTile)
      ) {
        const waterPath = pf.findPath(startWaterTile, goalWaterTile);

        if (waterPath) {
          waterPath.isWaterPath = true;
          waterPath.from = {
            id: town.id,
            name: town.name,
            altname: town.altname,
            area: town.area,
            region: town.region,
          };
          waterPath.to = {
            id: otherTown.id,
            name: otherTown.name,
            altname: otherTown.altname,
            area: otherTown.area,
            region: otherTown.region,
          };

          paths.push(waterPath);
        }
      }
    }
  }

  return paths;
}

towns.forEach((town, index) => {
  console.log(
    `Finding paths for town ${index + 1}/${towns.length}: ${town.name} (${town.id})`,
  );

  var paths = getTownPaths(town);

  paths = paths.filter((path) => path && path.path.length > 0);

  if (!fs.existsSync(pathsystem.join(__dirname, `paths_${season}`)))
    fs.mkdirSync(pathsystem.join(__dirname, `paths_${season}`));

  const outputFile = pathsystem.join(
    __dirname,
    `paths_${season}/${town.name}_${town.id}.json`,
  );
  fs.writeFileSync(outputFile, JSON.stringify(paths, null, 2));
  console.log(`Saved paths to ${outputFile}`);
});
