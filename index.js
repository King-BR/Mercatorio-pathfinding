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
function getTownPaths(town, oldReachableTowns, oldUniqueTowns) {
  const paths = [];
  const { reachableTowns, uniqueTowns } = getReachableTowns(town);

  console.log(
    `Found ${uniqueTowns.size} reachable towns (${reachableTowns.size} paths) for ${town.name} (${town.id}).`,
  );

  if (
    oldReachableTowns &&
    oldUniqueTowns &&
    oldReachableTowns.size > 0 &&
    oldUniqueTowns.size > 0
  ) {
    const reachableChanges = compareReachableTowns(
      oldReachableTowns,
      reachableTowns,
    );

    const uniqueChanges = compareUniqueTowns(oldUniqueTowns, uniqueTowns);

    if (!reachableChanges.changed && !uniqueChanges.changed) {
      console.log(
        `No changes in reachable towns and unique towns for ${town.name} (${town.id}).`,
      );

      const paths = JSON.parse(
        fs.readFileSync(
          `./paths_${season}/${town.name}_${town.id}.json`,
          "utf-8",
        ),
      );

      return {
        paths,
        reachableTowns,
        uniqueTowns,
      };
    }

    // --------------------------------
    // REACHABLE TOWNS
    // --------------------------------

    if (reachableChanges.changed) {
      console.log(
        `Changes detected in reachable towns for ${town.name} (${town.id}).`,
      );

      if (debug) {
        if (!fs.existsSync(`data/changes`)) {
          fs.mkdirSync(`data/changes`, { recursive: true });
        }

        fs.writeFileSync(
          `data/changes/${town.name}_${town.id}_reachable.json`,
          JSON.stringify(reachableChanges, null, 2),
        );

        if (reachableChanges.added.length > 0) {
          console.log("Added reachable towns:", reachableChanges.added);
        }

        if (reachableChanges.removed.length > 0) {
          console.log("Removed reachable towns:", reachableChanges.removed);
        }

        if (reachableChanges.modified.length > 0) {
          console.log("Modified reachable towns:", reachableChanges.modified);
        }
      }
    }

    // --------------------------------
    // UNIQUE TOWNS
    // --------------------------------

    if (uniqueChanges.changed) {
      console.log(
        `Changes detected in unique towns for ${town.name} (${town.id}).`,
      );

      if (debug) {
        if (!fs.existsSync(`data/changes`)) {
          fs.mkdirSync(`data/changes`, { recursive: true });
        }

        fs.writeFileSync(
          `data/changes/${town.name}_${town.id}_unique.json`,
          JSON.stringify(uniqueChanges, null, 2),
        );

        if (uniqueChanges.added.length > 0) {
          console.log("Added unique towns:", uniqueChanges.added);
        }

        if (uniqueChanges.removed.length > 0) {
          console.log("Removed unique towns:", uniqueChanges.removed);
        }
      }
    }
  } else {
    console.log(
      `No old data for ${town.name} (${town.id}). Calculating from scratch.`,
    );
  }

  reachableTowns.forEach((otherTown) => {
    if (town.id === otherTown.id) return;

    const path = pf.findPath(otherTown.start, otherTown.goal);

    if (path) {
      path.isWaterPath = otherTown.isWaterPath;
      path.from = {
        id: town.id,
        name: town.name,
        altname: town.altname,
        location: town.location,
        area: town.area,
        region: town.region,
      };

      path.to = {
        id: otherTown.id,
        name: otherTown.name,
        altname: otherTown.altname,
        location: otherTown.location,
        area: otherTown.area,
        region: otherTown.region,
      };

      paths.push(path);
    }
  });

  return { paths, reachableTowns, uniqueTowns };
}

function getReachableTowns(town) {
  var reachableTowns = new Set();
  var uniqueTowns = new Set();

  for (const otherTown of towns) {
    if (town.id === otherTown.id) continue;

    const start = {
      x: town.location.x,
      y: town.location.y,
    };

    const goal = {
      x: otherTown.location.x,
      y: otherTown.location.y,
    };

    var areaPath = pf.reachable(start, goal, true) || [];

    if (areaPath.length > 0) {
      uniqueTowns.add(otherTown.id);
      reachableTowns.add({
        id: otherTown.id,
        name: otherTown.name,
        isWaterPath: false,
        location: otherTown.location,
        area: otherTown.area,
        region: otherTown.region,
        start,
        goal,
        areaPath,
      });
    }

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
       */
      if (
        startWaterTile &&
        goalWaterTile &&
        startWaterTile.data.area === goalWaterTile.data.area
      ) {
        const startWater = {
          x: startWaterTile.x,
          y: startWaterTile.y,
        };

        const goalWater = {
          x: goalWaterTile.x,
          y: goalWaterTile.y,
        };

        uniqueTowns.add(otherTown.id);
        reachableTowns.add({
          id: otherTown.id,
          name: otherTown.name,
          isWaterPath: true,
          location: otherTown.location,
          area: otherTown.area,
          region: otherTown.region,
          start: startWater,
          goal: goalWater,
          areaPath: [startWaterTile.data.area],
        });
      }
    }
  }

  return { reachableTowns, uniqueTowns };
}

function compareReachableTowns(oldTowns, newTowns) {
  const oldMap = new Map();
  const newMap = new Map();

  for (const town of oldTowns) {
    const key = `${town.id}:${town.isWaterPath}`;
    oldMap.set(key, town);
  }

  for (const town of newTowns) {
    const key = `${town.id}:${town.isWaterPath}`;
    newMap.set(key, town);
  }

  const added = [];
  const removed = [];
  const modified = [];

  // Adicionados ou modificados
  for (const [key, newTown] of newMap) {
    const oldTown = oldMap.get(key);

    if (!oldTown) {
      added.push(newTown);
      continue;
    }

    const oldPath = oldTown.areaPath;
    const newPath = newTown.areaPath;

    const pathChanged =
      oldPath.length !== newPath.length ||
      oldPath.some((area, i) => area !== newPath[i]);

    if (pathChanged) {
      modified.push({
        id: newTown.id,
        isWaterPath: newTown.isWaterPath,
        oldAreaPath: oldPath,
        newAreaPath: newPath,
      });
    }
  }

  // Removidos
  for (const [key, oldTown] of oldMap) {
    if (!newMap.has(key)) {
      removed.push(oldTown);
    }
  }

  return {
    changed: added.length > 0 || removed.length > 0 || modified.length > 0,

    added,
    removed,
    modified,
  };
}

function compareUniqueTowns(oldTowns, newTowns) {
  const added = [];
  const removed = [];

  for (const id of newTowns) {
    if (!oldTowns.has(id)) {
      added.push(id);
    }
  }

  for (const id of oldTowns) {
    if (!newTowns.has(id)) {
      removed.push(id);
    }
  }

  return {
    changed: added.length > 0 || removed.length > 0,
    added,
    removed,
  };
}

towns.forEach((town, index) => {
  console.log(
    `\nFinding paths for town ${index + 1}/${towns.length}: ${town.name} (${town.id})`,
  );

  if (!fs.existsSync(pathsystem.join(__dirname, `data/uniqueTowns`)))
    fs.mkdirSync(pathsystem.join(__dirname, `data/uniqueTowns`), {
      recursive: true,
    });

  if (!fs.existsSync(pathsystem.join(__dirname, `data/reachableTowns`)))
    fs.mkdirSync(pathsystem.join(__dirname, `data/reachableTowns`), {
      recursive: true,
    });

  if (!fs.existsSync(pathsystem.join(__dirname, `paths_${season}`)))
    fs.mkdirSync(pathsystem.join(__dirname, `paths_${season}`));

  var oldReachableTowns = new Set();
  var oldUniqueTowns = new Set();

  if (
    fs.existsSync(
      pathsystem.join(
        __dirname,
        `data/reachableTowns/${town.name}_${town.id}.json`,
      ),
    )
  ) {
    const oldReachableTownsFile = pathsystem.join(
      __dirname,
      `data/reachableTowns/${town.name}_${town.id}.json`,
    );

    oldReachableTowns = new Set(
      JSON.parse(fs.readFileSync(oldReachableTownsFile, "utf-8")),
    );
  }

  if (
    fs.existsSync(
      pathsystem.join(
        __dirname,
        `data/uniqueTowns/${town.name}_${town.id}.json`,
      ),
    )
  ) {
    const oldUniqueTownsFile = pathsystem.join(
      __dirname,
      `data/uniqueTowns/${town.name}_${town.id}.json`,
    );

    oldUniqueTowns = new Set(
      JSON.parse(fs.readFileSync(oldUniqueTownsFile, "utf-8")),
    );
  }

  console.log(
    `Found ${oldUniqueTowns.size} old reachable towns (${oldReachableTowns.size} paths) for ${town.name} (${town.id}).`,
  );

  var { paths, reachableTowns, uniqueTowns } = getTownPaths(
    town,
    oldReachableTowns,
    oldUniqueTowns,
  );

  const uniqueTownsFile = pathsystem.join(
    __dirname,
    `data/uniqueTowns/${town.name}_${town.id}.json`,
  );

  fs.writeFileSync(
    uniqueTownsFile,
    JSON.stringify(Array.from(uniqueTowns), null, 2),
  );

  console.log(`Saved unique towns to ${uniqueTownsFile}`);

  const reachableTownsFile = pathsystem.join(
    __dirname,
    `data/reachableTowns/${town.name}_${town.id}.json`,
  );

  fs.writeFileSync(
    reachableTownsFile,
    JSON.stringify(Array.from(reachableTowns), null, 2),
  );

  console.log(`Saved reachable towns to ${reachableTownsFile}`);

  const outputFile = pathsystem.join(
    __dirname,
    `paths_${season}/${town.name}_${town.id}.json`,
  );

  fs.writeFileSync(outputFile, JSON.stringify(paths, null, 2));
  console.log(`Saved paths to ${outputFile}\n`);
});
