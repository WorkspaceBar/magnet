import * as vscode from "vscode"; // Talk to the editor

import { ChatPanel } from "./chatPanel.js"; // Register new chat panel
import { CodeFixManager, extractCode, matchIndent } from "./codeFixManager.js"; // Fix code, extract orignal code block, and space indent
import { COMMAND_APPLY_FIX, COMMAND_CANCEL_FIX, WEBVIEW_ID } from "./constants.js"; // Talk with package.json
import { MemoryStore } from "./memoryStore.js"; // Get memory
import { OllamaClient, isAbortError } from "./ollamaClient.js"; // Get model response
import { PromptBuilder } from "./promptBuilder.js"; // Get user's prompt
import { Telemetry } from "./telemetry.js"; // Get model stats
import type { FixTarget } from "./types.js"; // Get user's selected code block that needed to be fix

// Convert any leading pairs of spaces in a given string into tabs
const tabIndent: (text: string) => string = (text: string): string => text.replace(/^(?: {2})+/gm, spaces => "\t".repeat(spaces.length / 2));

// The entry point of chat mode and runs the "user sends a message" flow
export class Chat implements vscode.Disposable {
	private readonly memory: MemoryStore;
	private readonly ollama = new OllamaClient();
	private readonly prompts = new PromptBuilder();
	private readonly telemetry = new Telemetry(this.ollama);
	private readonly codeFix = new CodeFixManager();
	private readonly panel: ChatPanel;

	private statsPoll: vscode.Disposable | null = null; // Hold a disposable object
	private inFlight: AbortController | null = null; // Set while a request is running

	private chain: Promise<void> = Promise.resolve(); // Runs messages one at a time
	private generation = 0; // Incremented every time a new conversation is initiated or when the conversation is cleared

	constructor(context: vscode.ExtensionContext) {

		// Initialize the memory store based on the provided storage Uri
		// If no storage Uri is provided, use the global storage Uri
		this.memory = new MemoryStore(context.storageUri ?? context.globalStorageUri);

		// Create a new "ChatPanel" instance with the specified extension Uri and event handlers
		this.panel = new ChatPanel(context.extensionUri, {
			onReady: () => this.handleReady(),
			onUserMessage: text => this.handleUserMessage(text),
			onClear: () => this.handleClear(),
			onLoadMore: () => this.handleLoadMore(),
			onViewDisposed: () => this.stopTelemetry()
		});
	};

	// Registers the webview, CodeLens provider and Apply or Cancel commands
	register(): vscode.Disposable[] {
		return [
			vscode.window.registerWebviewViewProvider(WEBVIEW_ID, this.panel),
			vscode.languages.registerCodeLensProvider({ scheme: "file" }, this.codeFix),

			vscode.commands.registerCommand(COMMAND_APPLY_FIX, () => this.codeFix.apply()),
			vscode.commands.registerCommand(COMMAND_CANCEL_FIX, () => this.codeFix.cancel()),
		];
	};

	// Cleans up resources associated with the editor and stops telemetry collection
	// Ensures that all pending requests are aborted, telemetry is stopped, the microphone is released and any code fix resources are disposed
	dispose(): void {
		this.inFlight?.abort();
		this.stopTelemetry();
		this.codeFix.dispose();
	};

	// Webview events
	private handleReady(): void {
		for (const message of this.memory.initialMessage()) {
			this.panel.post({ type: "aiMessage", role: message.role, text: message.content });
		};

		this.stopTelemetry(); // The webview can become ready more than once
		this.statsPoll = this.telemetry.pollStats(text => this.panel.post({ type: "memoryStats", text }));
	};

	// Handle clear chat history
	private handleClear(): void {
		this.inFlight?.abort();
		this.inFlight = null;
		this.generation++;
		this.memory.clearMessage();
		this.panel.post({ type: "clearChat" });
	};

	// Handle load more previous messages
	private handleLoadMore(): void {
		const { messages, hasMore } = this.memory.loadMoreMessage();
		this.panel.post({ type: "appendOldMessage", messages, hasMore });
	};

	// Handle user send message
	private async processMessage(text: string): Promise<void> {
		const fixSelectedCode: FixTarget | null = this.readSelection();
		if (fixSelectedCode && this.codeFix.hasPending) {

			// Checked before calling the model so no tokens are spent on a result that cannot be shown
			this.panel.post({
				type: "aiStreamEnd",
				text: "Please apply or cancel the current code fix before requesting another one."
			});

			return;
		};

		const controller: AbortController = new AbortController();
		this.inFlight = controller;

		try {
			const history = this.memory.recentMessage(); // Must be read before adding the current message
			let userPrompt: string = text;

			if (fixSelectedCode) {
				userPrompt = await this.prompts.codeFix({
					request: text,
					code: fixSelectedCode.code,
					language: fixSelectedCode.language,
					sourceUri: fixSelectedCode.editor.document.uri
				});
			} else {
				// Send message
				this.memory.addMessage("user", text);
			};

			this.panel.post({ type: "aiThinkingStart", isCodeFix: !!fixSelectedCode });

			let thinking: string = "AI Thinking Process:\n";
			let isStreaming: boolean = false;

			const reply: string = await this.ollama.chat([...history, { role: "user", content: userPrompt }], {
				signal: controller.signal,

				onThinking: delta => {
					thinking += delta;
					this.panel.post({ type: "aiThinkingChunk", text: thinking });
				},

				onContent: delta => {

					// Fix code shown in the editor only
					if (fixSelectedCode) {
						return;
					};

					if (!isStreaming) {
						isStreaming = true;
						this.panel.post({ type: "aiStreamStart" });
					};

					this.panel.post({ type: "aiStreamChunk", text: delta });
				}
			});

			if (fixSelectedCode) {
				await this.codeFix.preview(
					fixSelectedCode.editor,
					fixSelectedCode.selection,
					fixSelectedCode.code,
					matchIndent(extractCode(reply), fixSelectedCode.code, fixSelectedCode.editor.options.insertSpaces === false)
				);

				this.panel.post({ type: "aiCodeFixed" }); // Always sent so the webview unlocks its input
			} else {
				const display: string = tabIndent(reply);
				this.panel.post({ type: "aiStreamEnd", text: display });
				this.memory.addMessage("assistant", display);
			}
		} catch (err) {
			if (isAbortError(err)) {
				return; // The chat was cleared while the model was answering
			};

			const message: string = err instanceof Error ? err.message : String(err);
			this.panel.post({ type: "aiStreamEnd", text: `Error: ${ message || "Something went wrong" }` });
		} finally {
			if (this.inFlight === controller) {
				this.inFlight = null;
			};
		};
	};

	// Handle user send message (waits for any earlier message to finish first)
	private handleUserMessage(text: string): Promise<void> {
		const generation: number = this.generation;

		const runChain: Promise<void | undefined> = this.chain.then(() => (generation === this.generation ? this.processMessage(text) : undefined));
		this.chain = runChain.catch(() => undefined); // Keeps the chain alive if one message fails

		return runChain;
	};

	// The current non empty selection in the active editor, or null (plain chat)
	private readSelection(): FixTarget | null {
		const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
		if (!editor || editor.selection.isEmpty) {
			return null;
		};

		const { start, end } = editor.selection;

		// Work on whole lines so the first line keeps its indentation
		const lastLine: number = end.character === 0 && end.line > start.line ? end.line - 1 : end.line;
		const selectionRange: vscode.Range = new vscode.Range(start.line, 0, lastLine, editor.document.lineAt(lastLine).text.length);

		return {
			editor,
			selection: selectionRange,
			code: editor.document.getText(selectionRange),
			language: editor.document.languageId
		};
	};

	// Stop model stats
	private stopTelemetry(): void {
		this.statsPoll?.dispose();
		this.statsPoll = null;
	};
};