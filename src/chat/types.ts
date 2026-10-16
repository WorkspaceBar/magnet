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
	| { type: "userMessage"; text: string }
	| { type: "clearMessage" }
	| { type: "loadMoreMessage" }
	| { type: "webviewReady" }

// Messages the extension sends to the webview
export type ToWebview =
	| { type: "memoryStats"; text: string }
	| { type: "aiMessage"; role: Role; text: string }
	| { type: "appendOldMessage"; messages: Memory[]; hasMore: boolean }
	| { type: "aiThinkingStart"; isCodeFix: boolean }
	| { type: "aiThinkingChunk"; text: string }
	| { type: "aiStreamStart" }
	| { type: "aiStreamChunk"; text: string }
	| { type: "aiStreamEnd"; text: string }
	| { type: "aiCodeFixed" }
	| { type: "clearChat" }