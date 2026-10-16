const esbuild = require("esbuild");
esbuild.build({
	entryPoints: ["./src/extension.ts"],
	bundle: true,
	platform: "node",
	format: "cjs",
	outfile: "./out/extension.js",
	external: [
		"vscode",
		"systeminformation",
	],
}).catch((error) => {
	console.error(error);
	process.exit(1);
});