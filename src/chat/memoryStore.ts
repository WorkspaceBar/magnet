import * as fs from "fs"; // Read and write memory json file
import * as path from "path"; // Get path file memory
import * as vscode from "vscode"; // Talk to the editor

import { BATCH_SIZE, INITIAL_VISIBLE, MAX_MEMORY, MEMORY_FILE_NAME } from "./constants.js"; // Get configuration
import type { Memory } from "./types"; // Get memory

// Owns the chat history: the in-memory array, the JSON file on disk, and the "how much is currently shown in the webview" pagination state
// Knows nothing about the webview, Ollama, or prompts
export class MemoryStore {
	private readonly file: string;
	private readonly messages: Memory[]; // single source of truth (no duplicate copies)

	private shown = 0; // how many messages, counted from the end, the webview currently displays

	constructor(storageUri: vscode.Uri) {
		this.file = path.join(storageUri.fsPath, MEMORY_FILE_NAME);
		this.messages = this.loadMessage();
	};

	// Previous messages to send as context. So the current message is not included twice
	// Leaves room for the current message so the model never receives more than "MAX_MEMORY" messages in total
	recentMessage(): Memory[] {
		const startIndex: number = Math.max(0, this.messages.length - MAX_MEMORY); // Calculate the starting index for slicing
		return this.messages.slice(startIndex); // Return the sliced array
	};

	// Messages to replay when the webview (re)opens
	initialMessage(): Memory[] {
		this.shown = Math.min(INITIAL_VISIBLE, this.messages.length);
		return this.messages.slice(this.messages.length - this.shown, this.messages.length);
	};

	// The next batch of older messages
	loadMoreMessage(): { messages: Memory[]; hasMore: boolean } {
		const end: number = Math.max(0, this.messages.length - this.shown);
		const start: number = Math.max(0, end - BATCH_SIZE);

		this.shown += end - start;

		return {
			messages: this.messages.slice(start, end),
			hasMore: start > 0
		};
	};

	// Append message with role and content as parameter
	addMessage(role: Memory["role"], content: string): void {
		this.messages.push({ role, content });
		this.shown += 1; // New messages are displayed live in the webview
		this.saveMessage();
	};

	// Clear all the chat history
	clearMessage(): void {
		this.messages.length = 0;
		this.shown = 0;

		try {
			if (fs.existsSync(this.file)) {
				fs.unlinkSync(this.file);
				vscode.window.showWarningMessage("Deleted chat memory");
			};
		} catch (err) {
			const errMessage: string = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`Failed to delete chat memory: ${ errMessage }`);
		};
	};

	// Load chat history
	loadMessage(): Memory[] {
		try {
			if (!fs.existsSync(this.file)) {
				return [];
			};

			// Load the content of the file using "fs.readFileSync"
			const parsed: string = JSON.parse(fs.readFileSync(this.file, "utf-8"));
			if (!Array.isArray(parsed)) {
				return [];
			};

			// Filter the parsed array to include only items that meet the following conditions
			return parsed.filter((item): item is Memory =>
				!!item &&
				typeof item.content === "string" &&
				(item.role === "user" || item.role === "assistant" || item.role === "system")
			);
		} catch (err) {
			const errMessage: string = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`Failed to load chat from memory: ${ errMessage }`);
			return [];
		};
	};

	// Store message inside history
	saveMessage(): void {
		try {
			fs.mkdirSync(path.dirname(this.file), { recursive: true }); // no-op when it already exists
			fs.writeFileSync(this.file, JSON.stringify(this.messages, null, 2), "utf-8");
		} catch (err) {
			const errMessage: string = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`Failed to store chat to memory: ${ errMessage }`);
		};
	};
};