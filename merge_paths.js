const fs = require("fs");
const pathsystem = require("path");
const { simplifyPath } = require("./utils.js");

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
      // add path ID to use in the interactive map for getting full data from backend
      p.id = pathsCount;
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
        delete step.data;
        delete step.area;
        delete step.moneyCost;
        if (step.type == "water" || step.type == "land") delete step.type;

        if (step.details) {
          if (step.details.ferryId != undefined)
            step.ferryId = step.details.ferryId;

          if (step.details.landingId != undefined) {
            step.landingId = step.details.landingId;
          } else if (step.details.landingIndex != undefined) {
            step.landingId = step.details.landingIndex;
          }
        }

        delete step.details;
      });

      p.path = p.path.map((step) => {
        return [step.x, step.y, step.moveCost].concat(
          step.type
            ? [step.type, step.ferryId, step.landingId]
            : [],
        );
      });

      if (process.argv.includes("--simplify")) {
        if (process.argv.includes("--debug")) {
          console.log(
            `Simplifying path from ${p.from} to ${p.to}. Original length: ${p.path.length}`,
          );
        }

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

const mergedPaths = mergePaths();
const outputFilePath = pathsystem.join(
  __dirname,
  `output/merged_${process.argv.includes("--simplify") ? "simplified_" : ""}paths_${season}.json`,
);

fs.writeFileSync(outputFilePath, JSON.stringify(mergedPaths));

console.log(`Merged paths written to ${outputFilePath}`);

if (process.argv.includes("--debug")) {
  var debugPaths = [];
  var debugOutputFilePath = pathsystem.join(
    __dirname,
    `debug/debug_merged_${process.argv.includes("--simplify") ? "simplified_" : ""}paths_${season}.json`,
  );

  debugPaths.push(mergedPaths.find((p) => p.isWaterPath));
  debugPaths.push(mergedPaths.find((p) => p.isWaterPath == undefined));
  debugPaths.push(mergedPaths.find((p) => p.totalMoneyCost > 0));

  fs.writeFileSync(debugOutputFilePath, JSON.stringify(debugPaths, null, 2));

  console.log(`Debug paths written to ${debugOutputFilePath}`);
}
