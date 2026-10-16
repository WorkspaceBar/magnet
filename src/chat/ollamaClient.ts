import { TextDecoder } from "util";
import { KEEP_ALIVE, MODEL, OLLAMA_SERVER_URL, STATS_INTERVAL } from "./constants.js";
import type { Memory } from "./types";

// Entry of ollama's "GET /api/ps" response
export type RunningModel = {
	name: string;
	size: number;
	size_vram: number
};

// Handlers for chat interactions
export type ChatHandlers = {
	onContent: (delta: string) => void; // Receives only the new text, not the accumulated reply
	onThinking?: (delta: string) => void;
	signal?: AbortSignal;
};

// Represents a chunk of text that might contain a response or an error
type ChatChunk = {
	message?: { content?: string; thinking?: string }; // Response for type "response" or "thinking"
	error?: string; // Handle error
};

// Handling aborted network requests
export function isAbortError(err: unknown): boolean {
	return err instanceof Error && err.name === "AbortError";
};

// All http traffic to ollama
export class OllamaClient {

	// Streams a chat completion and returns the full reply
	async chat(messages: Memory[], handlers: ChatHandlers): Promise<string> {
		let response: Response;
		try {
			response = await fetch(`${ OLLAMA_SERVER_URL }/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: MODEL,
					messages,
					stream: true,
					keep_alive: KEEP_ALIVE
				}),
				signal: handlers.signal ?? null
			});
		} catch (err) {
			if (isAbortError(err)) {
				throw err;
			};

			throw new Error(`Cannot reach ollama at ${ OLLAMA_SERVER_URL }`);
		};

		// Handle bad response
		if (!response.ok || !response.body) {
			const detail: string = await response.text().catch(() => "");
			throw new Error(`Model error: ${ response.status } ${ response.statusText }${ detail ? ` - ${ detail }` : "" }`);
		};

		const reader: ReadableStreamDefaultReader<any> = response.body.getReader();
		const decoder: TextDecoder = new TextDecoder();

		let reply: string = ""; // Get model response text
		let buffer: string = ""; // A network chunk can end in the middle of a json line

		const handleLine: (line: string) => void = (line: string): void => {

			// Trim response
			const trimmed: string = line.trim();
			if (!trimmed) {
				return;
			};

			let chunk: ChatChunk;

			try {
				chunk = JSON.parse(trimmed) as ChatChunk;
			} catch {
				return; // Malformed line, skip it
			};

			if (chunk.error) {
				throw new Error(`Model error: ${chunk.error}`);
			};

			// Type "thinking" chunk
			const thinking: string | undefined = chunk.message?.thinking;
			if (thinking) {
				handlers.onThinking?.(thinking);
			};

			// Type "response" chunk
			const content: string | undefined = chunk.message?.content;
			if (content) {
				reply += content;
				handlers.onContent(content);
			};
		};

		// This while loop continuously reads data from an input stream and processes it line by line
		// It handles both complete lines and unfinished lines by maintaining a buffer and processing them appropriately
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			};

			buffer += decoder.decode(value, { stream: true });

			const lines: string[] = buffer.split("\n");
			buffer = lines.pop() ?? ""; // Keep the unfinished last line for the next round

			lines.forEach(handleLine);
		};

		buffer += decoder.decode(); // Flush the decoder
		handleLine(buffer);

		return reply;
	};

	// Returns null when ollama is offline, [] when it is up but "idle"
	async runningModels(): Promise<RunningModel[] | null> {
		try {
			const response: Response = await fetch(`${ OLLAMA_SERVER_URL }/api/ps`, { signal: AbortSignal.timeout(STATS_INTERVAL) });
			if (!response.ok) {
				return null;
			};

			const data: { models?: RunningModel[] } = (await response.json()) as { models?: RunningModel[] };
			return data.models ?? [];
		} catch {
			return null;
		};
	};
};