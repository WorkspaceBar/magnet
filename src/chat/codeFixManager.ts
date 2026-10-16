import * as vscode from "vscode"; // Talk to the editor
import type { PendingFix } from "./types.js"; // Pending type

const countLines: (text: string) => number = (text: string): number => text.split(/\r?\n/).length;
const normalizeEol: (text: string) => string = (text: string): string => text.replace(/\r\n/g, "\n");

// Pulls the code out of the model's reply: takes the first fenced block if there
// is one (otherwise the whole reply) and normalizes leading tabs to 2 spaces
export function extractCode(text: string): string {
	const trimmed: string = text.trim();
	const fenced: RegExpMatchArray | null = trimmed.match(/```[a-zA-Z0-9+#._-]*\r?\n([\s\S]*?)\r?\n?```/);
	const responseCode: string = fenced?.[1] ?? trimmed;

	return responseCode
		.split(/\r?\n/)
		.map(line => line.replace(/^\t+/, tabs => "  ".repeat(tabs.length)))
		.join("\n")
		.replace(/\n+$/, "");
};

// Re applies the original block's indentation to the model's output
export function matchIndent(
	code: string,
	original: string,
	useTabs: boolean
): string {
	const baseIndent: string = original.split(/\r?\n/).find(line => line.trim() !== "")?.match(/^[\t ]*/)?.[0] ?? "";

	const lines: string[] = code.split("\n");
	const indents: number[] = lines.filter(line => line.trim() !== "").map(line => line.match(/^[\t ]*/)![0].length);
	const common: number = indents.length ? Math.min(...indents) : 0; // Model's own base indent

	return lines.map(line => {
		if (line.trim() === "") {
			return "";
		};

		// The model indents with spaces (2 per level), so convert them to tabs when the editor uses tabs
		const relative: string = line.slice(common).replace(/^(?: {2})+/, spaces => useTabs ? "\t".repeat(spaces.length / 2) : spaces);
		return baseIndent + relative;
	}).join("\n");
};

// Everything about the preview, then Apply or Cancel flow
// with the original highlighted red, the fix highlighted green, and an Apply or Cancel CodeLens above the first line of the fix
export class CodeFixManager implements vscode.CodeLensProvider, vscode.Disposable {
	private readonly changeEmitter = new vscode.EventEmitter<void>();
	readonly onDidChangeCodeLenses = this.changeEmitter.event; // Let VSCode refresh the lenses

	private readonly bugDecoration = vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(255, 0, 0, 0.15)", isWholeLine: true });
	private readonly fixDecoration = vscode.window.createTextEditorDecorationType({ backgroundColor: "rgba(42, 86, 58, 0.5)", isWholeLine: true });

	private pending: PendingFix | null = null;

	get hasPending(): boolean {
		return this.pending !== null;
	};

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const pendingFix: PendingFix | null = this.pending;
		if (!pendingFix || document.uri.toString() !== pendingFix.textEditor.document.uri.toString()) {
			return [];
		};

		const range: vscode.Range = new vscode.Range(pendingFix.fixedStartLine, 0, pendingFix.fixedStartLine, 0);
		return [
			new vscode.CodeLens(range, { title: "Apply", command: "aiCodeFix.apply" }),
			new vscode.CodeLens(range, { title: "Cancel", command: "aiCodeFix.cancel" })
		];
	};

	// Inserts the preview below the original selection and starts waiting for Apply or Cancel
	async preview(
		editor: vscode.TextEditor,
		originalRange: vscode.Range,
		originalCode: string,
		fixedCode: string
	): Promise<void> {

		// Handle case when user is not apply or cancel the code fix preview but sending another request
		if (this.pending) {
			vscode.window.showWarningMessage("Please apply or cancel the current code fix before requesting another one.");
			return;
		};

		// Undefined behavior
		if (fixedCode.trim() === "") {
			vscode.window.showWarningMessage("AI returned no code.");
			return;
		};

		// Same original code block
		if (normalizeEol(originalCode).trim() === normalizeEol(fixedCode).trim()) {
			vscode.window.showInformationMessage("AI did not find any changes");
			return;
		};

		const previewText: string = `${ originalCode }\n\n${ fixedCode }`;
		const didEdit: boolean = await editor.edit(builder => builder.replace(originalRange, previewText));
		if (!didEdit) {
			vscode.window.showErrorMessage("Unable to create AI code preview");
			return; // Guard check
		};

		const start: vscode.Position = originalRange.start;
		const originalLines: number = countLines(originalCode);
		const fixedLines: number = countLines(fixedCode);
		const previewLines: string[] = previewText.split(/\r?\n/);
		const fixedStartLine: number = start.line + originalLines + 1; // Skips the blank separator line

		const previewEnd: vscode.Position = new vscode.Position(
			start.line + previewLines.length - 1,
			previewLines[previewLines.length - 1]?.length ?? 0
		);

		this.pending = {
			textEditor: editor,
			previewRange: new vscode.Range(start, previewEnd),
			previewText,
			originalCode,
			fixedCode,
			fixedStartLine
		};

		// Create decoration range
		editor.setDecorations(this.bugDecoration, this.linesToRanges(editor, start.line, originalLines));
		editor.setDecorations(this.fixDecoration, this.linesToRanges(editor, fixedStartLine, fixedLines));

		this.changeEmitter.fire();
	};

	// Keeps the fixed code, removes the original and the preview markers
	async apply(): Promise<void> {
		await this.replacePreview(fix => fix.fixedCode, "Unable to apply AI fix");
	};

	// Keeps the original code, removes the fixed code and the preview markers
	async cancel(): Promise<void> {
		await this.replacePreview(fix => fix.originalCode, "Unable to cancel AI fix");
	};

	dispose(): void {
		this.bugDecoration.dispose();
		this.fixDecoration.dispose();
		this.changeEmitter.dispose();
	};

	private async replacePreview(pick: (fix: PendingFix) => string, failureMessage: string): Promise<void> {
		const pendingFix: PendingFix | null = this.pending;
		if (!pendingFix) {
			return;
		};

		const { textEditor, previewRange, previewText } = pendingFix;
		if (textEditor.document.isClosed) {
			this.clear();
			return;
		};

		// If the user typed inside the preview, previewRange no longer matches the text and a
		// blind replace would corrupt their code, so drop the preview and leave the document alone
		const current: string = textEditor.document.getText(previewRange);
		if (normalizeEol(current) !== normalizeEol(previewText)) {
			vscode.window.showWarningMessage("The AI preview was edited, so it was dismissed. Please resolve it manually.");
			this.clear();
			return;
		};

		try {
			const didEdit: boolean = await textEditor.edit(builder => builder.replace(previewRange, pick(pendingFix)));
			if (!didEdit) {
				vscode.window.showErrorMessage(failureMessage);
				return;
			};
		} catch {
			vscode.window.showErrorMessage(failureMessage);
			this.clear();
			return;
		};

		this.clear();
	};

	// Clear all CodeLens decoration
	private clear(): void {
		const textEditor: vscode.TextEditor | undefined = this.pending?.textEditor ?? vscode.window.activeTextEditor;

		textEditor?.setDecorations(this.bugDecoration, []);
		textEditor?.setDecorations(this.fixDecoration, []);

		this.pending = null;
		this.changeEmitter.fire();
	};

	// Ranges of "count" consecutive lines starting at "startLine", clipped to the document
	private linesToRanges(editor: vscode.TextEditor, startLine: number, count: number): vscode.Range[] {
		const ranges: vscode.Range[] = [];
		for (let line = startLine; line < startLine + count && line < editor.document.lineCount; line++) {
			ranges.push(editor.document.lineAt(line).range);
		};

		return ranges;
	};
};