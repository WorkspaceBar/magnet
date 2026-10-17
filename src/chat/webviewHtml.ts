import * as path from "path"; // Get path file location
import * as vscode from "vscode"; // Talk to the editor

import { CONFIG_SECTION } from "./constants.js"; // Get configuration

// Get custom file path
function customPaths(): {
	js?: string | undefined;
	css?: string | undefined
} {
	const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(CONFIG_SECTION);
	return {
		js: config.get<string>("customJsPath") || undefined,
		css: config.get<string>("customCssPath") || undefined
	};
};

// Folders the webview may load files from: the extension's media folder
// Folders of the optional custom js or css files (webviews cannot read other locations)
export function getLocalResourceRoots(extensionUri: vscode.Uri): vscode.Uri[] {
	const { js, css } = customPaths();
	const roots: vscode.Uri[] = [vscode.Uri.joinPath(extensionUri, "media")];

	for (const customPath of [js, css]) {
		if (customPath) {
			roots.push(vscode.Uri.file(path.dirname(customPath)));
		};
	};

	return roots;
};

// Full html document for the chat webview. Pure: everything it needs is passed in
export function buildWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {

	// Helper function to get the webview URI for a file in the extension's media folder
	const getMedia: (fileName: string) => string = (fileName: string): string => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", fileName)).toString();
	const { js, css } = customPaths();

	// Custom js and css files, if provided by the user. They are loaded after the default ones
	const customStyleTag: string = css ? `<link rel="stylesheet" href="${ webview.asWebviewUri(vscode.Uri.file(css)) }">` : "";
	const customScriptTag: string = js ? `<script src="${ webview.asWebviewUri(vscode.Uri.file(js)) }"></script>` : "";

	// Build the html document with the webview URI for the media files and the custom js and css files, if provided by the user
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8"/>
	<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
	<title>Magnet</title>

	<link rel="stylesheet" href="${ getMedia("webStyle.css") }">
	<link rel="stylesheet" href="${ getMedia("prism.css") }">
	${ customStyleTag }
</head>

<body>
	<div id="layout-container"></div>

	<script src="${ getMedia("prism.js") }"></script>
	<script type="module" src="${ getMedia("webScript.js") }"></script>
	${ customScriptTag }
</body>
</html>`;
};