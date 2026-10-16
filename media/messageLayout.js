// Short language names the model may use, mapped to Prism grammar names
const LANGUAGE_ALIASES = {
	ts: "typescript",
	js: "javascript",
	sh: "bash",
	shell: "bash",
	zsh: "bash",
	"c++": "cpp",
	html: "markup",
	xml: "markup",
	py: "python",
	yml: "yaml",
	md: "markdown",
	jsonc: "json",
	java: "java"
};

// Renders one message bubble (plain text and fenced code blocks)
export class MessageLayout {
	constructor(role, text) {
		this.role = role;
		this.text = text;
	};

	render() {
		const element = document.createElement("div");
		element.className = "message-bubble " + this.role;

		// Split into text parts and ```code``` parts
		const parts = this.text.split(/(```[\s\S]*?```)/g);
		parts.forEach(part => {
			if (!part) {
				return;
			};

			const codeMatch = part.match(/^```([a-zA-Z0-9+#.-]*)\r?\n([\s\S]*?)\r?\n?```$/);
			if (codeMatch) {
				const rawLanguage = (codeMatch[1] || "").toLowerCase();
				let language = LANGUAGE_ALIASES[rawLanguage] || rawLanguage;
				const code = codeMatch[2];

				// Fall back to a generic grammar when the tag is missing or not bundled
				if (typeof Prism !== "undefined" && (!language || !Prism.languages[language])) {
					language = Prism.languages.clike ? "clike" : "";
				};

				const preElement = document.createElement("pre");
				const codeElement = document.createElement("code");

				if (language) {
					preElement.className = "language-" + language;
					codeElement.className = "language-" + language;
				};

				codeElement.textContent = code;

				if (typeof Prism !== "undefined") {
					Prism.highlightElement(codeElement);
				};

				preElement.appendChild(codeElement);

				// Create a wrapper for the code block and copy button
				const wrapper = document.createElement("div");
				wrapper.className = "code-block-wrapper";

				wrapper.appendChild(preElement);

				// Create the copy button
				const copyButton = document.createElement("button");
				copyButton.className = "copy-code-button";
				copyButton.textContent = "Copy";

				copyButton.addEventListener("click", async () => {
					try {
						await navigator.clipboard.writeText(codeElement.textContent);
						copyButton.textContent = "Copied!";
						setTimeout(() => {
							copyButton.textContent = "Copy";
						}, 1000);
					} catch (error) {
						console.error("Failed to copy code:", error);
						copyButton.textContent = "Failed";
					};
				});

				wrapper.appendChild(copyButton);
				element.appendChild(wrapper);
			} else {
				const trimmed = part.trim();
				if (!trimmed) {
					return;
				};

				const textElement = document.createElement("div");

				textElement.style.whiteSpace = "pre-wrap";
				textElement.textContent = trimmed;

				element.appendChild(textElement);
			};
		});

		return element;
	};
};