/**
 * 
 * @param {Array<Array<number|string>>} path
 * @returns {Array<Array<number|string>>}
 */
function simplifyPath(path) {
  if (path.length <= 2) {
    return path;
  }

  var firstStep = [path[0][0], path[0][1]];

  if (path[0][3]) firstStep.push(path[0][3]);

  const result = [firstStep];

  let previousDirection = null;

  for (let i = 1; i < path.length; i++) {
    const previous = path[i - 1];
    const current = path[i];

    const dx = Math.sign(current[0] - previous[0]);
    const dy = Math.sign(current[1] - previous[1]);

    const direction = `${dx},${dy}`;

    // Type changed
    const typeChanged = current[3] !== previous[3];

    // Direction changed (not the first step)
    const directionChanged =
      previousDirection !== null && direction !== previousDirection;

    if (typeChanged || directionChanged) {
      result.push(
        [previous[0], previous[1]].concat(previous[3] ? [previous[3]] : []),
      );
    }

    previousDirection = direction;
  }

  // Always include the last step
  const lastStep = path[path.length - 1];
  result.push(
    [lastStep[0], lastStep[1]].concat(lastStep[3] ? [lastStep[3]] : []),
  );

  return result;
}

module.exports = {
  simplifyPath,
}