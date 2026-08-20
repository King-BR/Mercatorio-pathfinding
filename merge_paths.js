const fs = require("fs");
const pathsystem = require("path");

// merge paths from "paths_${season}" while excluding duplicate paths (two-ways)
const season = "s7";

function mergePaths() {
  const mergedPaths = [];

  const pathsDir = pathsystem.join(__dirname, `paths_${season}`);

  if (!fs.existsSync(pathsDir)) {
    console.error(`Error: Directory ${pathsDir} does not exist.`);
    return;
  }

  const files = fs
    .readdirSync(pathsDir)
    .filter((file) => file.endsWith(".json"));

  if (!files || files.length === 0) {
    console.error(`Error: No JSON files found in ${pathsDir}.`);
    return;
  }

  var pathsCount = 0;

  for (const file of files) {
    const filePath = pathsystem.join(pathsDir, file);
    const paths = require(filePath);

    if (process.argv.includes("--debug"))
      console.log(
        `--------------- Loaded ${paths.length} paths from ${file} ------------------------`,
      );

    for (const p of paths) {
      pathsCount++;

      if (process.argv.includes("--debug"))
        console.log(
          `Checking path from ${p.from.id} to ${p.to.id} (isWaterPath: ${p.isWaterPath ? true : false})`,
        );

      // remove excess data to save in the merged file
      p.from = p.from.id;
      p.to = p.to.id;

      if (!p.isWaterPath) delete p.isWaterPath;
      if (p.totalMoneyCost == 0) delete p.totalMoneyCost;

      p.path.forEach((step) => {
        delete step.totalMovementCost;
        delete step.totalMoneyCost;
        delete step.details;
        delete step.data;
        delete step.area;
        delete step.moneyCost;
        delete step.moveCost;
        if (step.type == "water") delete step.type;
      });

      if (process.argv.includes("--simplify")) {
        if (process.argv.includes("--debug"))
          console.log(
            `Simplifying path from ${p.from} to ${p.to}. Original length: ${p.path.length}`,
          );
        p.path = simplifyPath(p.path);
        if (process.argv.includes("--debug"))
          console.log(`New length: ${p.path.length}`);
      }

      mergedPaths.push(p);

      if (process.argv.includes("--debug"))
        console.log(`Added path from ${p.from} to ${p.to}`);
    }
  }

  if (process.argv.includes("--debug"))
    console.log(`Total paths: ${pathsCount}`);

  return mergedPaths;
}

function simplifyPath(path) {
  if (path.length <= 2) {
    return path;
  }

  var firstStep = [path[0].x, path[0].y];

  if (path[0].type) firstStep.push(path[0].type);

  const result = [firstStep];

  let previousDirection = null;

  for (let i = 1; i < path.length; i++) {
    const previous = path[i - 1];
    const current = path[i];

    const dx = Math.sign(current.x - previous.x);
    const dy = Math.sign(current.y - previous.y);

    const direction = `${dx},${dy}`;

    // Type changed
    const typeChanged = current.type !== previous.type;

    // Direction changed (not the first step)
    const directionChanged =
      previousDirection !== null && direction !== previousDirection;

    if (typeChanged || directionChanged) {
      result.push(
        [previous.x, previous.y].concat(previous.type ? [previous.type] : []),
      );
    }

    previousDirection = direction;
  }

  // Always include the last step
  const lastStep = path[path.length - 1];
  result.push(
    [lastStep.x, lastStep.y].concat(lastStep.type ? [lastStep.type] : []),
  );

  return result;
}

const mergedPaths = mergePaths();
const outputFilePath = pathsystem.join(
  __dirname,
  `merged_${process.argv.includes("--simplify") ? "simplified_" : ""}paths_${season}.json`,
);

fs.writeFileSync(outputFilePath, JSON.stringify(mergedPaths));

console.log(`Merged paths written to ${outputFilePath}`);

if (process.argv.includes("--debug")) {
  var debugPaths = [];
  var debugOutputFilePath = pathsystem.join(
    __dirname,
    `debug_merged_${process.argv.includes("--simplify") ? "simplified_" : ""}paths_${season}.json`,
  );

  debugPaths.push(mergedPaths.find((p) => p.isWaterPath));
  debugPaths.push(mergedPaths.find((p) => !p.isWaterPath));
  debugPaths.push(mergedPaths.find((p) => p.totalMoneyCost > 0));

  fs.writeFileSync(debugOutputFilePath, JSON.stringify(debugPaths, null, 2));

  console.log(`Debug paths written to ${debugOutputFilePath}`);
}
