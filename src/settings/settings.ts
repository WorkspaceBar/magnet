import * as vscode from "vscode"; // Talk to the editor
import { OLLAMA_SERVER_URL } from "../chat/constants.js"; // Get ollama server url

export let OLLAMA_MODEL_CHAT: string | undefined = "qwen2.5-coder:3b"; // Default model (global variable)
export let OLLAMA_MODEL_AUTOCOMPLETE: string | undefined = "qwen2.5-coder:3b"; // Default model (global variable)

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

		// Build the model list, prepending a "Disabled" option
		const modelItems = [
			{ 
				label: "$(circle-slash) Disabled", 
				description: `(turn off ${ targetConfig.key } feature)`, 
				modelName: "disabled" 
			},
			...models.map(name => ({
				label: name,
				description: name === Settings.getConfigType(targetConfig.key) ? " <- in use" : "",
				modelName: name
			}))
		];

		// If models check passed, show all the models that was installed
		const pickedConfigType: { label: string; description: string; modelName: string; } | undefined = await vscode.window.showQuickPick(
			modelItems, {
				title: targetConfig.label,
				placeHolder: "Select a model or disable"
			}
		);

		if (!pickedConfigType) {
			return; // Guard check
		};

		const selectedValue: string = pickedConfigType.modelName;
		if (targetConfig.key === "chat") {
			OLLAMA_MODEL_CHAT = selectedValue ? selectedValue : undefined; // Assign new string value to ollama chat
		} else {
			OLLAMA_MODEL_AUTOCOMPLETE = selectedValue ? selectedValue : undefined; // Assign new string value to ollama autocomplete
		};

		// Wait for update response of settings
		await vscode.workspace.getConfiguration("magnet").update(targetConfig.key, selectedValue, vscode.ConfigurationTarget.Global);
		const displayMessage: string = selectedValue === "" ? "disabled" : selectedValue;
		vscode.window.showInformationMessage(`${ targetConfig.label } set to ${ displayMessage }`);
	};
};