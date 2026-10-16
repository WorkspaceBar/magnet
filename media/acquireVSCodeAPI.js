// Disables ESLint's "no-undef" rule for this line to allow the usage of "acquireVsCodeApi()"
// This function is necessary for interacting with VSCode APIs
export const vscode = acquireVsCodeApi();