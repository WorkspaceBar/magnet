import { UserInputLayout } from "./userInputLayout.js"; // Render voice status line, text box, mic button, and send button
import { MessageLayout } from "./messageLayout.js"; // Render 1 message bubble
import { vscode } from "./acquireVSCodeAPI.js"; // Interacting with VSCode APIs

// Owns the banner, the message list and the input
export class ChatPanelContainer {
	constructor() {
		this.activeStreamElement = null;
		this.acmStreamText = "";

		this.isUserScrollUp = false;

		// Paging state for "load older messages"
		this.hasMore = true; // assume there is older history until the extension says otherwise
		this.isLoadingMore = false;
		this.fillTimer = null;

		// Messages sent while the AI is still answering wait here and are sent one at a time
		this.busy = false;
		this.queue = []; // { text, element }

		const layout = document.getElementById("layout-container");

		this.bannerElement = document.createElement("div");
		this.bannerElement.id = "memory-container";
		this.bannerElement.textContent = "Connecting To OS...";
		layout.appendChild(this.bannerElement);

		this.messageElement = document.createElement("div");
		this.messageElement.className = "message-container";

		layout.appendChild(this.messageElement);

		this.messageElement.addEventListener("scroll", () => {
			const box = this.messageElement;
			const threshold = 5; // Allow a small threshold for rounding errors

			this.isUserScrollUp = (box.scrollHeight - box.scrollTop - box.clientHeight) > threshold;

			if (box.scrollTop <= 0) {
				this.requestMore();
			};
		});

		this.inputLayout = new UserInputLayout(
			text => this.sendUserMessage(text),
			() => vscode.postMessage({ type: "toggleVoice" })
		);
	};

	// Update the memory statistics displayed in the banner
	updateMemStats(stats) {
		this.bannerElement.textContent = `${ stats }`;
	};

	// Send a user message, or queue it when the AI is still answering the previous one
	sendUserMessage(text) {
		if (this.busy) {
			const element = new MessageLayout("user", text).render();
			element.classList.add("queued");
			element.style.opacity = "0.55"; // dimmed until it is actually sent

			this.messageElement.appendChild(element); // queued bubbles always stay last
			this.queue.push({ text, element });
			this.scrollToBottom(true);
			return;
		};

		this.appendMessage("user", text);
		this.scrollToBottom(true);
		this.dispatch(text);
	};

	dispatch(text) {
		this.busy = true;
		vscode.postMessage({ type: "userMessage", text: text });
	};

	// The extension finished a response (or an error), so send the next queued message
	finishResponse() {
		this.busy = false;

		const next = this.queue.shift();
		if (!next) {
			return;
		};

		next.element.classList.remove("queued");
		next.element.style.opacity = "";
		this.scrollToBottom(true);
		this.dispatch(next.text);
	};

	appendMessage(role, text) {
		this.addElement(new MessageLayout(role, text).render());
		this.scrollToBottom();
	};

	// Inserts above any queued bubbles, so queued messages always stay at the very bottom
	addElement(element) {
		const firstQueued = this.messageElement.querySelector(".queued");
		this.messageElement.insertBefore(element, firstQueued); // null means append
	};

	// Ask the extension for the next batch of older messages (one request at a time)
	requestMore() {
		if (!this.hasMore || this.isLoadingMore) {
			return;
		};

		this.isLoadingMore = true;
		vscode.postMessage({ type: "loadMoreMessage" });
	};

	// Put a batch of older messages (oldest first) above the current ones without moving the view
	prependMessages(messages, hasMore) {
		const box = this.messageElement;
		const oldHeight = box.scrollHeight;
		const oldTop = box.scrollTop;

		const fragment = document.createDocumentFragment();
		messages.forEach(item => {
			fragment.appendChild(new MessageLayout(item.role, item.content).render()); // keeps the original order
		});

		box.insertBefore(fragment, box.firstChild);
		box.scrollTop = box.scrollHeight - oldHeight + oldTop;

		this.hasMore = hasMore;
		this.isLoadingMore = false;

		this.scheduleFillCheck();
	};

	// A scroll event only fires when the list overflows, so a short list can never load older messages
	// This keeps loading batches until the list is scrollable or the history is exhausted
	scheduleFillCheck() {
		clearTimeout(this.fillTimer);
		this.fillTimer = setTimeout(() => this.fillIfNotScrollable(), 150);
	};

	fillIfNotScrollable() {
		const box = this.messageElement;
		if (box.clientHeight === 0) {
			return; // panel is hidden, there is nothing to measure
		};

		if (box.scrollHeight <= box.clientHeight) {
			this.requestMore();
		};
	};

	// Thinking and streaming
	startThinking(isCodeFix = false) {
		if (!this.activeStreamElement) {
			const element = document.createElement("div");
			element.className = "message-bubble assistant assistant-thinking";
			element.textContent = isCodeFix ? "Debugging Code..." : "Processing AI Thought...";
			element.style.color = "#95a1a1";

			this.activeStreamElement = element;
			this.acmStreamText = "";

			this.addElement(this.activeStreamElement);
			this.scrollToBottom();
		};
	};

	updateThinkingChunk(text) {
		if (!this.activeStreamElement) {
			this.startThinking();
		};

		this.activeStreamElement.className = "message-bubble assistant assistant-thinking";
		this.activeStreamElement.textContent = text;
		this.activeStreamElement.style.color = "#95a1a1";

		this.scrollToBottom();
	};

	startStreamContent() {
		if (this.activeStreamElement) {
			if (this.activeStreamElement.classList.contains("assistant-thinking")) {
				this.activeStreamElement.classList.remove("assistant-thinking");
				this.activeStreamElement.classList.add("assistant-streaming");
				this.activeStreamElement.style.color = "#a29e9e";
				this.activeStreamElement.textContent = "";
				this.acmStreamText = "";

				return;
			};

			this.activeStreamElement.remove();
		};

		const element = document.createElement("div");
		element.className = "message-bubble assistant assistant-streaming";
		element.style.color = "#a29e9e";

		this.activeStreamElement = element;
		this.acmStreamText = "";

		this.addElement(this.activeStreamElement);
		this.scrollToBottom();
	};

	updateStreamChunk(text) {
		if (!this.activeStreamElement || this.activeStreamElement.classList.contains("assistant-thinking")) {
			this.startStreamContent();
		};

		this.acmStreamText += text;
		this.activeStreamElement.textContent = this.acmStreamText;

		this.scrollToBottom();
	};

	// Replace the live stream with the final rendered message (also used to show errors)
	endStream(finalText) {
		const element = new MessageLayout("assistant", finalText).render(); // Render first, even a failure keeps the streamed text
		this.acmStreamText = "";

		if (this.activeStreamElement) {
			this.activeStreamElement.remove();
			this.activeStreamElement = null;
		};

		this.addElement(element);
		this.scrollToBottom();
	};

	// Code fix finished: the result is shown in the editor, so only mark the indicator as done
	codeFixed() {
		if (this.activeStreamElement) {
			this.activeStreamElement.textContent = "Code Debugged";
			this.activeStreamElement.style.color = "#d6cb61";
			this.activeStreamElement = null;

			this.acmStreamText = "";
		};
	};

	// Delete all the messages
	clearChat() {
		this.messageElement.innerHTML = "";
		this.activeStreamElement = null;
		this.acmStreamText = "";
		this.isUserScrollUp = false;

		clearTimeout(this.fillTimer);
		this.hasMore = false; // history was deleted, so there is nothing older to load
		this.isLoadingMore = false;
		this.busy = false;
		this.queue = [];
	};

	// If "true" always scrolls to the bottom
	// If "false" only scrolls when the user has not scrolled up
	scrollToBottom(force = false) {
		if (!this.isUserScrollUp || force) {
			this.messageElement.scrollTop = this.messageElement.scrollHeight;
		};
	};
};