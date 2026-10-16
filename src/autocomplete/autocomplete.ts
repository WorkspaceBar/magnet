import * as vscode from "vscode"; // Talk to the editor
import { OLLAMA_SERVER_URL } from "../chat/constants.js"; // Get ollama server url

// Autocomplete mode
export class AutoComplete implements vscode.InlineCompletionItemProvider {
	private static readonly DEBOUNCE = 450; // Time of silence before suggesting
	private static readonly CONTEXT_LINES = 40; // Number of lines to consider for context

	buildPrompt(
		languageId: string,
		prefix: string,
		suffix: string,
		linePrefix: string
	): {
		prompt: string;
		isComment: boolean;
		isCommentAtCursor: boolean;
		shouldPrependSpace: boolean;
	} {
		const commentToken: string = ["python", "shellscript", "yaml", "ruby"].includes(languageId) ? "#" : "//";
		const isComment: boolean = new RegExp(`^\\s*${ commentToken === "#" ? "#" : "\\/\\/" }\\s*$`).test(linePrefix);
		const isCommentAtCursor = linePrefix.trimEnd().endsWith(commentToken);

		// Determine if a space should be prepended to the comment
		let shouldPrependSpace = false;
		if (isComment && !isCommentAtCursor) {
			// Check if there's a space before the comment token
			if (linePrefix.trim().includes(commentToken) && linePrefix.trim().lastIndexOf(commentToken) === linePrefix.trim().length - commentToken.length) {
				shouldPrependSpace = false; // No space needed
			} else {
				shouldPrependSpace = true; // Space needed
			}
		} else if (isCommentAtCursor) {
			// If the comment is at the cursor, ensure a space is added
			shouldPrependSpace = true;
		}

		if (isComment) {
			const target: string = suffix.trim()
				? suffix.split(/\r?\n/).slice(0, 15).join("\n")
				: prefix.split(/\r?\n/).slice(-15).join("\n");

			return {
				isComment,
				isCommentAtCursor,
				shouldPrependSpace,
				prompt: `
					Write one short ${ languageId } code comment (max 20 words) explaining what this code does.
					Output only the comment text. No ${ commentToken }, no code, no quotes, no markdown.
					CODE: ${ target }
					COMMENT:
				`
			};
		};

		return {
			isComment,
			isCommentAtCursor,
			shouldPrependSpace,
			prompt: `
				* You are a code autocomplete engine for ${ languageId }.
				* Complete the code at <CURSOR>. Return only the text to correct insert at the cursor.
				* No explanations, no markdown fences, no repeating existing code.
				* The indentation width must be exactly 2 spaces per indentation level.
				* Convert all indentation to 2 spaces per indentation level.
				* Preserve the code structure and relative indentation, but use 2 spaces for every indentation level.
				* The format of the response must be clean, no extra stars, just numbers for list or "a,b,c.."
				* The format must be clean, no "**" or "*", clean and focus on user's request.

				<BEFORE>
				${ prefix }<CURSOR>
				</BEFORE>
				<AFTER>
				${ suffix }
				</AFTER>
			`
		};
	};

	async provideInlineCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_context: vscode.InlineCompletionContext,
		token: vscode.CancellationToken
	): Promise<vscode.InlineCompletionItem[] | undefined> {
		await new Promise(debounce => setTimeout(debounce, AutoComplete.DEBOUNCE));
		if (token.isCancellationRequested) {
			return;
		};

		const contextLines = AutoComplete.CONTEXT_LINES;

		const startLine: number = Math.max(0, position.line - contextLines);
		const endLine: number = Math.min(document.lineCount - 1, position.line + contextLines);

		const prefix: string = document.getText(new vscode.Range(startLine, 0, position.line, position.character));
		const suffix: string = document.getText(new vscode.Range(position, document.lineAt(endLine).range.end));

		const linePrefix: string = document.lineAt(position.line).text.slice(0, position.character);
		if (!prefix.trim()) {
			return;
		};

		const { isComment, prompt } = this.buildPrompt(document.languageId, prefix, suffix, linePrefix);
		const controller: AbortController = new AbortController();

		token.onCancellationRequested(() => controller.abort());

		try {
			const response = await fetch(`${ OLLAMA_SERVER_URL}/api/generate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				signal: controller.signal,
				body: JSON.stringify({
					model: "qwen2.5-coder:7b",
					comment: isComment + prompt,
					prompt: `<|fim_prefix|>${ prefix }<|fim_suffix|>${ suffix }<|fim_middle|>`, // Autocomplete mode
					raw: true,
					stream: false,
					options: {
						num_predict: 64,
						temperature: 0.1,
						top_p: 0.9,
						num_ctx: 9000,
						stop: ["<|fim_pad|>", "<|endoftext|>", "<|file_sep|>", "\n\n"]
					}
				})
			});

			if (!response.ok) {
				return;
			};

			const data: { response?: string; } = await response.json() as { response?: string };

			// Strip accidental code fences
			let text = data.response ?? "";
			text = text.replace(/^```[\w+#.-]*\r?\n?/, "").replace(/\r?\n?```\s*$/, "");

			// Clean the comment after the model responds
			if (isComment) {
				text = text.split(/\r?\n/)[0]!.replace(/^\s*(\/\/|#)\s*/, "").trim();
				if (!text || /[{};]$/.test(text)) {
					return; // Looks like code, discard it
				};

				text = text.replace(/ {2}(?!\t)/g, "\t");
			};

			if (!text.trim() || token.isCancellationRequested) {
				return;
			};

			return [new vscode.InlineCompletionItem(text, new vscode.Range(position, position))];
		} catch {
			return; // Model offline
		};
	};
};