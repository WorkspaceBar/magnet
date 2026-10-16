import * as vscode from "vscode"; // Talk to the editor
import { CODE_GLOB, EXCLUDE_GLOB, MAX_CONTEXT_CHARS, MAX_CONTEXT_FILES } from "./constants.js"; // Get configuration

// Input required for code fixing operations
export type CodeFixInput = {
	request: string; // What the user typed
	code: string; // User selected code
	language: string; // Coding language id of the active document
	sourceUri?: vscode.Uri; // File the selection came from (listed first in the context)
};

// For normal type only
export type NormalChat = {
	request: string; // Get user request
};

// How comments are written in each language, keyed by the VSCode language id
type CommentStyle = { line: string | null; blockOpen: string | null; blockClose: string | null };

const SLASH: CommentStyle = { line: "//", blockOpen: "/*", blockClose: "*/" };
const HASH: CommentStyle = { line: "#", blockOpen: null, blockClose: null };
const DASH: CommentStyle = { line: "--", blockOpen: "/*", blockClose: "*/" };
const CSS: CommentStyle = { line: null, blockOpen: "/*", blockClose: "*/" };
const MARKUP: CommentStyle = { line: null, blockOpen: "<!--", blockClose: "-->" };

const COMMENT_STYLES: Record<string, CommentStyle> = {
	javascript: SLASH,
	javascriptreact: SLASH,
	typescript: SLASH,
	typescriptreact: SLASH,
	java: SLASH,
	c: SLASH,
	cpp: SLASH,
	csharp: SLASH,
	go: SLASH,
	rust: SLASH,
	swift: SLASH,
	kotlin: SLASH,
	php: SLASH,
	dart: SLASH,
	json: SLASH,
	jsonc: SLASH,
	python: HASH,
	ruby: HASH,
	shellscript: HASH,
	powershell: HASH,
	yaml: HASH,
	dockerfile: HASH,
	perl: HASH,
	sql: DASH,
	lua: { line: "--", blockOpen: "--[[", blockClose: "]]" },
	css: CSS,
	scss: SLASH,
	less: SLASH,
	html: MARKUP,
	xml: MARKUP
};

// Main prompt instruction
const instructions = (language: string): string[] => [
	"Analyze the user's request and identify the required fix.",
	"Modify only the code inside <SELECTED_CODE>.",
	"Use <PROJECT_CONTEXT> only to understand imports, functions, variables, types, APIs, and relationships needed to make the fix correctly.",
	"Do not modify, reproduce, or replace unrelated project files.",
	`The selected code is ${ language }. Every line of the output must be valid ${ language }.`,
	`Never write syntax, keywords, libraries, or comment styles from any language other than ${ language }, even if the project context contains other languages.`,
	"Keep the same language as the selected code. Do not translate or port the code to another language.",
	"Keep 1 tab (or 2 spaces) for each identation!!!. Do not use 4 spaces as default",
	"The indentation width must be exactly 2 spaces per indentation level.",
	"Convert all indentation to 2 spaces per indentation level.",
	"Preserve the code structure and relative indentation, but use 2 spaces for every indentation level.",
	"Do not add unnecessary features, refactoring, helper functions, comments, or improvements that were not requested.",
	"If the selected code is already correct, return it unchanged.",
	"Do not invent APIs, variables, functions, libraries, or project behavior that are not supported by the selected code or project context.",
	"If the user said \"add comment\" or \"add top comment\" or something else related like that, remember to return comment with the code that the user selected, don't just return the only comment. And make sure between comment and user selected code block has no blank line or gap."
];

// The comment rule is written for the exact language, so the model never has to guess the syntax
const commentRule = (language: string): string => {
	const style: CommentStyle | undefined = COMMENT_STYLES[language];
	if (!style) {
		return `Write every comment with the native comment syntax of ${ language } and no other syntax.`;
	};

	const { line, blockOpen, blockClose } = style;
	if (line && blockOpen) {
		return `Comments must use ${ language } syntax only. A short comment that fits on one line uses \`${ line }\`. A long comment that needs a detailed explanation uses \`${ blockOpen } comment ${ blockClose }\` with no extra "*" characters and tabs for indentation in multi-line comments. Never use any other comment syntax.`;
	};

	if (line) {
		return `Comments must use ${ language } syntax only. Every comment uses \`${ line }\` at the start of each comment line. Never use any other comment syntax.`;
	};

	return `Comments must use ${ language } syntax only. Every comment uses \`${ blockOpen } comment ${ blockClose }\`. Never use any other comment syntax.`;
};

// For output of the fixed code block
const outputRules = (language: string): string[] => [
	commentRule(language),
	"IMPORTANT: You MUST Add 2 blank line (NOT 1) immediately before the opening code fence and language identifier.",
	"IMPORTANT: You MUST Add 2 blank line (NOT 1) immediately after the closing triple backticks.",
	`Return exactly one standard markdown code block that starts with \`\`\`${ language } and contains only the corrected selected code.`,
	"Do not include explanations, greetings, analysis, or notes.",
	"Do not include multiple code blocks.",
	"Do not include any text before or after the code block.",
	"Keep the response clean: no \"*\" or \"**\" characters outside the code block, use numbers or \"a, b, c\" for lists."
];

// Convert each index of string array into main bullets
const bullets = (items: string[]): string => items.map(item => `* ${ item }`).join("\n");

// Reads the workspace for context but never talks to the model, the webview, or the editor selection
export class PromptBuilder {
	async codeFix(input: CodeFixInput): Promise<string> {
		const projectContext: string = await this.workspaceContextForDebugging(input.sourceUri);
		return [
			`ROLE: You are a ${ input.language } code debugging and code fixing assistant. Your job is to modify only the user's selected code.`,
			`CODING_LANGUAGE: ${ input.language }`,
			`<PROJECT_CONTEXT>\n${ projectContext }\n</PROJECT_CONTEXT>`, // Context first, so the code to fix is the last thing the model reads
			`<SELECTED_CODE>\n${ input.code }\n</SELECTED_CODE>`,
			`INSTRUCTIONS:\n${ bullets(instructions(input.language)) }`,
			`OUTPUT_RULES:\n${ bullets(outputRules(input.language)) }`,
			`TASK (Carry this out on the selected code): ${ input.request }`,
			`REMINDER: The answer is one ${ input.language } code block. Code and comments in ${ input.language } only.`,
			`THIS IS PRIVATE DATA OF USER'S PROJECT, DO NOT SHOW AGAIN INSIDE RESPONSE, JUST PROVIDE THE INFORMATION ABOUT THE PROJUST CONTEXT, DO NOT REWRITE EVERYTHING OR SHOW THE PROJECT_CONTEXT UNDER MESSAGE MODE. ONE MORE TIME THIS STRUCTURE IS FOR PRIVATE COMPANY`
		].join("\n\n");
	};

	// Source files of the first workspace folder, capped so the prompt fits the model's context
	private async workspaceContextForDebugging(sourceUri?: vscode.Uri): Promise<string> {
		const folders: readonly vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return "";
		};

		const results: vscode.Uri[][] = await Promise.all(
			folders.map(folder =>
				vscode.workspace.findFiles(
					new vscode.RelativePattern(folder, CODE_GLOB),
					EXCLUDE_GLOB,
					MAX_CONTEXT_FILES
				)
			)
		);

		const uris: vscode.Uri[] = results.flat();

		// The file being edited is the most relevant one, so it gets first claim on the size budget
		const activeKey: string | undefined = sourceUri?.toString();
		uris.sort((a, b) => Number(b.toString() === activeKey) - Number(a.toString() === activeKey));

		const blocks: string[] = [];
		let cumulativeLength: number = 0;

		for (const uri of uris) {
			try {
				const document: vscode.TextDocument = await vscode.workspace.openTextDocument(uri);
				const relativePath: string = vscode.workspace.asRelativePath(uri, false);
				const block: string = `<FILE path="${ relativePath }">\n<CODE_INSIDE>\n${ document.getText() }\n</CODE_INSIDE>\n</FILE>\n\n`;

				// Safe limit check
				if (cumulativeLength + block.length > MAX_CONTEXT_CHARS) {
					continue; // Too big for what is left
				};

				blocks.push(block);
				cumulativeLength += block.length;
			} catch (err) {
				console.warn(`Chat: failed to read ${ uri.fsPath }`, err);
			};
		};

		return blocks.join("\n");
	};
};