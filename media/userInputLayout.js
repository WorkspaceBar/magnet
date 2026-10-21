// Builds the voice status line, the text box, the mic button and the send button
export class UserInputLayout {
	constructor(onSend, onToggleVoice) {
		this.onSend = onSend;
		this.onToggleVoice = onToggleVoice;
		this.voiceTimer = null;
		this.build();
	};

	build() {
		const inputArea = document.createElement("div");
		inputArea.className = "input-area";

		// Textarea gets its own full-width block wrapper
		this.textarea = document.createElement("textarea");
		this.textarea.id = "user-input";
		this.textarea.placeholder = "Ask AI";
		this.textarea.rows = 2; // Increased default rows for a better text box feel

		// Buttons container positioned below the textarea
		const buttonGroup = document.createElement("div");
		buttonGroup.className = "button-group";

		// Create the send message button
		this.sendButton = document.createElement("button");
		this.sendButton.id = "send-button";
		this.sendButton.innerHTML = `<svg xmlns="http://w3.org" width="20" height="20" fill="currentColor" class="bi bi-send-fill" viewBox="0 0 16 16"><path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494z"/></svg>`;

		// Assemble the button block
		buttonGroup.appendChild(this.sendButton);

		// Assemble the main input area container
		inputArea.appendChild(this.textarea); // Textarea sits perfectly on top
		inputArea.appendChild(buttonGroup); // Buttons rest safely underneath

		this.attachEvent();
		document.getElementById("layout-container")?.appendChild(inputArea);
	};

	attachEvent() {

		// "Enter" sends, "Shift + Enter" adds a new line
		this.textarea.addEventListener("keydown", e => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.submitMessage();
			};
		});

		// Grow the textarea with its content, up to 600px
		this.textarea.addEventListener("input", () => {
			this.textarea.style.height = "auto";
			this.textarea.style.height = Math.min(this.textarea.scrollHeight, 600) + "px";

			const counter = document.getElementById("character-count");
			if (counter) {
				counter.textContent = String(this.textarea.value.length);
			};
		});

		this.sendButton.addEventListener("click", () => this.submitMessage());
	};

	// User submit a message
	submitMessage() {
		const text = this.textarea.value.trim();
		if (!text) {
			return;
		};

		this.onSend(text);

		this.textarea.value = "";
		this.textarea.style.height = "auto";

		const counter = document.getElementById("character-count");
		if (counter) {
			counter.textContent = "0";
		};
	};
};