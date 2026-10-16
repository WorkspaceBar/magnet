import * as vscode from "vscode"; // Talk to the editor

import type { FromWebview, ToWebview } from "./types.js"; // Get weview protocol
import { buildWebviewHtml, getLocalResourceRoots } from "./webviewHtml.js"; // Create html for vscode chat panel

// What the panel calls when the webview does something
export interface ChatPanelHandlers {
	onReady(): void | Promise<void>;
	onUserMessage(text: string): Promise<void>;
	onClear(): void | Promise<void>;
	onLoadMore(): void;
	onViewDisposed(): void;
};

// The view layer: owns the webview, routes its messages to the handlers, and sends messages back
// It knows nothing about memory, ollama, prompts
export class ChatPanel implements vscode.WebviewViewProvider {
	private view?: vscode.WebviewView;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly handlers: ChatPanelHandlers
	) {

	};

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;

		view.webview.options = {
			enableScripts: true,
			localResourceRoots: getLocalResourceRoots(this.extensionUri)
		};

		view.webview.html = buildWebviewHtml(view.webview, this.extensionUri);

		const messageListener: vscode.Disposable = view.webview.onDidReceiveMessage((message: FromWebview) => {
			this.route(message).catch(err => {
				const text: string = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Chat error: ${ text }`);
			});
		});

		view.onDidDispose(() => {
			messageListener.dispose();

			if (this.view === view) {
				delete this.view;
			};

			this.handlers.onViewDisposed();
		});
	};

	// Sends a message to the webview. Does nothing while no webview is open
	post(message: ToWebview): void {
		void this.view?.webview.postMessage(message);
	};

	// Handles incoming messages from the webview
	// This method processes user messages, clears the display, loads more messages, handles the mic button and webview readiness
	private async route(message: FromWebview): Promise<void> {
		switch (message.type) {
			case "userMessage":
				if (typeof message.text === "string") {
					await this.handlers.onUserMessage(message.text);
				};
				break;

			case "clearMessage":
				await this.handlers.onClear();
				break;

			case "loadMoreMessage":
				this.handlers.onLoadMore();
				break;

			case "webviewReady":
				await this.handlers.onReady();
				break;
		};
	};
};