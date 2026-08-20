const fs = require("fs");
const pathsystem = require("path");

// merge paths from "paths_${season}" while excluding duplicate paths (two-ways)
const season = "s7";

function mergePaths() {
  const mergedPaths = [];
  var existingPaths = new Set();

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

  for (const file of files) {
    const filePath = pathsystem.join(pathsDir, file);
    const paths = require(filePath);
    for (const p of paths) {
      // Check if the path already exists in mergedPaths (two way)
      const exists =
        existingPaths.has(`${p.from.id},${p.to.id}`) ||
        existingPaths.has(`${p.to.id},${p.from.id}`);

      if (!exists) {
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

        if (process.argv.includes("--debug")) console.log(p.path[1]);

        mergedPaths.push(p);
        existingPaths.add(`${p.from},${p.to}`);

        if (process.argv.includes("--debug"))
          console.log(`Added path from ${p.from} to ${p.to}`);
      }
    }
  }

  if (process.argv.includes("--debug"))
    console.log(`Total existing paths: ${existingPaths.size}`);

  return mergedPaths;
}

function simplifyPath(path) {
  if (path.length <= 2) {
    return path;
  }

  const result = [path[0]];

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
      result.push(previous);
    }

    previousDirection = direction;
  }

  // Always include the last step
  result.push(path[path.length - 1]);

  return result;
}

const mergedPaths = mergePaths();
const outputFilePath = pathsystem.join(
  __dirname,
  `merged_${process.argv.includes("--simplify") ? "simplified_" : ""}paths_${season}.json`,
);

console.log(mergedPaths.length + " unique paths merged.");
fs.writeFileSync(outputFilePath, JSON.stringify(mergedPaths, null, 2));
console.log(`Merged paths written to ${outputFilePath}`);
