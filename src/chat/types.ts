import * as vscode from "vscode"; // Talk to the editor

// Managing the role and conversation history
export type Role = "user" | "assistant" | "system";
export type Memory = { role: Role; content: string };

// User's current selection type
export type FixTarget = {
	editor: vscode.TextEditor;
	selection: vscode.Range;
	code: string;
	language: string;
};

// A fix that is previewed in the editor and waiting for "Apply" or "Cancel"
export type PendingFix = {
	textEditor: vscode.TextEditor; // Detect active window text editor
	previewRange: vscode.Range; // Range covering "original + blank line + fixed" in the document
	previewText: string; // Exact text that was inserted, used to detect edits made during the preview
	originalCode: string; // Get user's selected code block to be fixed
	fixedCode: string; // Get model's fixed code block
	fixedStartLine: number; // First line of the fixed block
};

// Messages the webview sends to the extension
export type FromWebview =
	| { type: "userMessage"; text: string } // User typed a message
	| { type: "clearMessage" } // User clicked "Clear" button - Not added yet
	| { type: "loadMoreMessage" } // User scrolled up to load more message
	| { type: "webviewReady" } // Webview is ready to receive messages

// Messages the extension sends to the webview
export type ToWebview =
	| { type: "memoryStats"; text: string } // Show memory usage
	| { type: "aiMessage"; role: Role; text: string } // AI generated a message
	| { type: "appendOldMessage"; messages: Memory[]; hasMore: boolean } // Append old messages to the chat
	| { type: "aiThinkingStart"; isCodeFix: boolean } // AI is thinking -> show a loading text
	| { type: "aiThinkingChunk"; text: string } // AI is thinking -> show the text chunk
	| { type: "aiStreamStart" } // AI is started streaming a code fix
	| { type: "aiStreamChunk"; text: string } // AI streaming a code fix chunk
	| { type: "aiStreamEnd"; text: string } // AI finished streaming a code fix
	| { type: "aiCodeFixed" } // AI finished fixing code -> hide loading text
	| { type: "clearChat" } // Clear the chat history