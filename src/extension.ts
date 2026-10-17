import * as vscode from "vscode"; // Talk to the editor

import { Chat } from "./chat/chat"; // Register chat panel
import { AutoComplete } from "./autocomplete/autocomplete.js"; // Register autocomplete model
import { Settings } from "./settings/settings.js"; // Register settings section inside chat panel

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	context.subscriptions.push(...new Chat(context).register()); // Create new chat panel
	context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, new AutoComplete())); // Register a command to start autocomplete mode
	context.subscriptions.push(vscode.commands.registerCommand("magnet.openSettings", () => Settings.openSettings())); // Register a command to start settings
};