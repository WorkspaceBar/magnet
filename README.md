Magnet:
A local AI extension for VSCode designed to accelerate your development workflow

Features:
* Switch `ollama` model:
	- Inside `Chat Panel`, navigate to the `settings icon` text at the top-right of it and select
		+ For `Chat` section, select the `qwen2.5-coder:3b` text next to it and choose other models
		+ For `Autocomplete` section, select the `qwen2.5-coder:3b` text next to it and choose other models

VSCode Configuration Required:
* Ensure that `ollama` was downloaded:
	- MacOS && Linux: `curl -fsSL https://ollama.com/install.sh | sh`
	- Window: `irm https://ollama.com/install.ps1 | iex`

* To pull the corresponding `ollama model` for focusing on coding task only, I recommend to use `qwen2.5-coder`:
	- Depends on your device and performance, here are the models that focus on coding tasks:
		`qwen2.5-coder:0.5b` - Command(`ollama pull qwen2.5-coder:0.5b`)
		`qwen2.5-coder:1.5b`- Command(`ollama pull qwen2.5-coder:1.5b`)
		`qwen2.5-coder:3b` - Command(`ollama pull qwen2.5-coder:3b`)
		`qwen2.5-coder:7b` - Command(`ollama pull qwen2.5-coder:7b`) (Recommend)
		`qwen2.5-coder:14b` - Command(`ollama pull qwen2.5-coder:14b`)
		`qwen2.5-coder:32b` - Command(`ollama pull qwen2.5-coder:32b`)

* Ensure `CodeLens` is enabled in `settings.json` and make sure: `"editor.codeLens": true`
* Ensure `inLineSuggest` is enabled in `settings.json` and make sure: `"editor.inlineSuggest.enabled":true`

License:
Distributed under MIT license