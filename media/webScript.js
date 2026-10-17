import { ChatPanelContainer } from "./chatPanelContainer.js"; // Banner, message list, and user input
import { vscode } from "./acquireVSCodeAPI.js"; // Interacting with VSCode APIs

// Handles chat mode, code fix mode and the voice button acquireVsCodeApi() may only be called once per webview, so keep this the only place that calls it
const chatPanel = new ChatPanelContainer(); // Create new chat panel

// Messages from the extension
window.addEventListener("message", e => {
	const message = e.data;
	switch (message.type) {
		case "aiMessage":
			try {
				chatPanel.appendMessage(message.role, message.text);
			} finally {
				chatPanel.scheduleFillCheck();
			};
			break;

		case "appendOldMessage":
			chatPanel.prependMessages(message.messages, message.hasMore);
			break;

		case "aiThinkingStart":
			chatPanel.startThinking(message.isCodeFix);
			break;

		case "aiThinkingChunk":
			chatPanel.updateThinkingChunk(message.text);
			break;

		case "aiStreamStart":
			chatPanel.startStreamContent();
			break;

		case "aiStreamChunk":
			chatPanel.updateStreamChunk(message.text);
			break;

		case "aiStreamEnd":
			try {
				chatPanel.endStream(message.text);
			} finally {
				chatPanel.finishResponse();
			};
			break;

		case "aiCodeFixed":
			chatPanel.codeFixed();
			chatPanel.finishResponse();
			break;

		case "memoryStats":
			chatPanel.updateMemStats(message.text);
			break;

		case "clearChat":
			chatPanel.clearChat();
			break;
	};
});

vscode.postMessage({ type: "webviewReady" }); // Marked that webview was ready to be created