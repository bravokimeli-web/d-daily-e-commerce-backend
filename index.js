// Render or other Node hosts may invoke `node index.js` by default.
// This shim ensures the built TypeScript output is loaded when the app is deployed.
try {
  require("./dist/index.js");
} catch (error) {
  console.error("Failed to load built backend entrypoint:", error);
  process.exit(1);
}
