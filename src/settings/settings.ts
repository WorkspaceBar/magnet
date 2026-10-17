import * as vscode from "vscode"; // Talk to the editor
import { OLLAMA_SERVER_URL } from "../chat/constants.js"; // Get ollama server url

export let OLLAMA_MODEL: string | undefined = "qwen2.5-coder:3b"; // Default model (global variable)

// Chat panel settings section for model configurations
export class Settings {

	// Retrieves a configuration value for a given key from the VSCode settings
	static getConfigType(key: "chat" | "autocomplete"): string {
		return vscode.workspace.getConfiguration("magnet").get<string>(key)!;
	};

	// Ask ollama which models are installed
	static async listModels(): Promise<string[]> {
		try {
			const response: Response = await fetch(`${ OLLAMA_SERVER_URL }/api/tags`);
			const data: { models: { name: string; }[] } = await response.json() as { models: { name: string }[] };
			return data.models.map(model => model.name);
		} catch {
			return []; // No models found
		};
	};

	// Open settings
	static async openSettings(): Promise<void> {
		const targetConfig:
		{ label: string, description: string, key: "chat" } |
		{ label: string, description: string, key: "autocomplete" } |
		undefined = await vscode.window.showQuickPick([
			{ label: "Chat:", description: Settings.getConfigType("chat"), key: "chat" as const },
			{ label: "Autocomplete:", description: Settings.getConfigType("autocomplete"), key: "autocomplete" as const }],
			{ title: "Magnet Settings", placeHolder: "Select the configuration" }
		);

		if (!targetConfig) {
			return; // Guard check
		};

		// Get models
		const models: string[] = await Settings.listModels();
		if (models.length === 0) {
			vscode.window.showErrorMessage("No models installed");
			return;
		};

		// If models check passed, show all the models that was installed
		const currentConfigType: string = Settings.getConfigType(targetConfig.key);
		const pickedConfigType: { label: string, description: string } | undefined = await vscode.window.showQuickPick(
			models.map(name => ({
				label: name,
				description: name === currentConfigType ? " <- in use" : ""
			})), {
				title: targetConfig.label,
				placeHolder: "Select a model"
			}
		);

		let currentPickedModel: string | undefined = OLLAMA_MODEL;

		if (!pickedConfigType) {
			return; // Guard check
		};

		if (currentConfigType !== pickedConfigType.label) {
			currentPickedModel = pickedConfigType.label;
		};

		// Update settings
		if (currentPickedModel !== OLLAMA_MODEL) {
			OLLAMA_MODEL = currentPickedModel;
		};

		// Wait for update response of settings
		await vscode.workspace.getConfiguration("magnet").update(targetConfig.key, pickedConfigType.label, vscode.ConfigurationTarget.Global);
		vscode.window.showInformationMessage(`${ targetConfig.label } set to ${ pickedConfigType.label }`);
	};
};