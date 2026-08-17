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

  for (const file of files) {
    const filePath = pathsystem.join(pathsDir, file);
    const paths = require(filePath);
    for (const p of paths) {
      // Check if the path already exists in mergedPaths (two way)
      const exists = mergedPaths.some(
        (mp) =>
          (mp.from.id === p.from.id && mp.to.id === p.to.id) ||
          (mp.from.id === p.to.id && mp.to.id === p.from.id),
      );
      if (!exists) {
        mergedPaths.push(p);
      }
    }
  }
  return mergedPaths;
}

const mergedPaths = mergePaths();
const outputFilePath = pathsystem.join(
  __dirname,
  `merged_paths_${season}.json`,
);

console.log(mergedPaths.length + " unique paths merged.");
fs.writeFileSync(outputFilePath, JSON.stringify(mergedPaths, null, 2));
console.log(`Merged paths written to ${outputFilePath}`);
