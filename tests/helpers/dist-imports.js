const path = require("node:path");

function requireDist(modulePath) {
  const normalizedPath = modulePath.replace(/^\/+/, "");
  const distPath = path.resolve(process.cwd(), "dist", normalizedPath);
  return require(distPath);
}

module.exports = {
  requireDist,
};
