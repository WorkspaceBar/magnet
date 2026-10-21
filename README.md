Magnet:
* A local AI extension for VSCode designed to accelerate your development workflow.

Features:
* Chat and suggest code.

How To Use:
* Switch `Ollama` model:
	- Inside the `Chat Panel`, click the `Settings icon` at the top right;
		+ In the `Chat` section, click the model name (example: `qwen2.5-coder:7b`) and choose a different model.
		+ In the `Autocomplete` section, click the model name (example: `qwen2.5-coder:3b`) and choose a different model.

* To `Disable` the `Chat` or `Autocomplete` feature:
	- Inside the `Chat Panel`, click the `Settings icon` at the top right;
		+ To `disable` chat mode, click `Chat` and select `Disabled - (turn off chat feature)`.
		+ To `disable` autocomplete mode, click `Autocomplete` and select `Disabled - (turn off autocomplete feature)`.

VSCode Configuration Required:
* Ensure that `ollama` was downloaded:
	- MacOS && Linux: `curl -fsSL https://ollama.com/install.sh | sh`
	- Window: `irm https://ollama.com/install.ps1 | iex`

* To pull the corresponding `ollama model` for focusing on coding task only, I recommend using the `qwen2.5-coder` model;
	- Depending on your device's hardware and performance capabilities, choose from the following models:
		+ `qwen2.5-coder:0.5b` Pull Command (`ollama pull qwen2.5-coder:0.5b`)
		+ `qwen2.5-coder:1.5b` Pull Command (`ollama pull qwen2.5-coder:1.5b`)
		+ `qwen2.5-coder:3b` Pull Command (`ollama pull qwen2.5-coder:3b`)
		+ `qwen2.5-coder:7b` Pull Command (`ollama pull qwen2.5-coder:7b`) (Recommend)
		+ `qwen2.5-coder:14b` Pull Command (`ollama pull qwen2.5-coder:14b`)
		+ `qwen2.5-coder:32b` Pull Command (`ollama pull qwen2.5-coder:32b`)

* Ensure `CodeLens` is enabled in `settings.json` and make sure: `"editor.codeLens": true`
* Ensure `inLineSuggest` is enabled in `settings.json` and make sure: `"editor.inlineSuggest.enabled":true`

License:
* Distributed under MIT license.