import * as os from "os"; // Get os informations
import * as si from "systeminformation"; // Get cpu, gpu, ram usage
import * as vscode from "vscode"; // Talk to the editor

import { STATS_INTERVAL } from "./constants.js"; // Get stats response time
import type { OllamaClient, RunningModel } from "./ollamaClient.js"; // Get user ollama message chunk

// Format with corresponding type of data
function formatBytes(bytes: number): string {
	if (bytes <= 0) {
		return "0B";
	};

	const units: string[] = ["B", "KB", "MB", "GB", "TB", "PB"]; // Array of units for byte conversion
	const index: number = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); // Calculate index of the bytes

	// Format and return the result with the appropriate unit
	return `${ parseFloat((bytes / Math.pow(1024, index)).toFixed(1)) }${ units[index] }`;
};

// Get gpu usage percentage
function gpuPercent(model: RunningModel): number {
	return model.size > 0 ? (model.size_vram / model.size) * 100 : 0;
};

// Gpu: 100% | Cpu: 4% | Ram: 15.9GB | Proc: 2.1GB"
export class Telemetry {
	constructor(private readonly ollama: OllamaClient) {};

	async snapshot(): Promise<string> {
		try {
			const [cpuLoad, models] = await Promise.all([
				si.currentLoad().then(load => load.currentLoad).catch(() => 0),
				this.ollama.runningModels()
			]);

			const cpu: string = `${ cpuLoad.toFixed(0) }%`; // Get cpu usage percentage
			const ram: string = formatBytes(os.totalmem() - os.freemem()); // Used by the whole system
			const proc: string = formatBytes(process.memoryUsage().rss); // Used by the extension host

			let status: string;
			let usage: string = `Cpu: ${ cpu }`;

			if (models === null) {
				status = "Offline | ";
			} else if (models.length === 0) {
				status = "Idle | ";
			} else {
				status = "";

				const gpu: number = gpuPercent(models[0]!);
				if (gpu > 0) {
					usage = `Gpu: ${ gpu.toFixed(0) }% | Cpu: ${ cpu }`;
				};
			};

			return `${ status }${ usage } | Ram: ${ ram } | Proc: ${ proc }`;
		} catch {
			return "Telemetry error";
		};
	};

	// Calls "callback" immediately and then every "intervalMs"
	pollStats(callback: (stats: string) => void, intervalMs: number = STATS_INTERVAL): vscode.Disposable {
		let running: boolean = false;
		let disposed: boolean = false;

		// Polls the stats every "intervalMs" milliseconds
		const tick: () => Promise<void> = async (): Promise<void> => {
			if (running || disposed) {
				return;
			};

			running = true;

			try {
				const stats: string = await this.snapshot();
				if (!disposed) {
					callback(stats);
				};
			} finally {
				running = false;
			};
		};

		void tick();

		const timer = setInterval(() => void tick(), intervalMs);
		return new vscode.Disposable(() => {
			disposed = true;
			clearInterval(timer);
		});
	};
};