// Identifiers
export const WEBVIEW_ID: string = "chatPanel"; // Must match inside package.json webview
export const CONFIG_SECTION: string = "magnet"; // "customJsPath" and "customCssPath" live under this section
export const COMMAND_APPLY_FIX: string = "aiCodeFix.apply"; // Command to apply code fix
export const COMMAND_CANCEL_FIX: string = "aiCodeFix.cancel"; // Command to cancel code fix

// Model
export const OLLAMA_SERVER_URL: string = "http://localhost:11434"; // Ollama api server
export const KEEP_ALIVE: string = "15m"; // Keep ollama model alive for 15 minutes
export const STATS_INTERVAL: number = 1000; // Send model stats each 1000ms

// Memory
export const MEMORY_FILE_NAME: string = "chat-history.json"; // Store all of chat history
export const PROJECT_CONTEXT_FILE_NAME: string = "project-context.json"; // Store all of the context of user's project
export const MAX_MEMORY: number = 10; // Messages sent to the model per request, including the current one
export const INITIAL_VISIBLE: number = 10; // Messages replayed into the webview when it opens
export const BATCH_SIZE: number = 1; // Extra messages loaded per "load more"

// Code fix prompts
export const CODE_GLOB: string = "**/*.{js,ts,jsx,tsx,py,java,cpp,php,go,java,swift,cs,kt,ml,bash,sh,kotlin,scala,rust,perl,vbnet,csharp,html,css,json,xml,less,scss,stylus}";
export const EXCLUDE_GLOB: string = "**/{node_modules,out,dist,build,.git,.next,coverage,vendor,.venv,venv,__pycache__}/**"; // Do not include inside context files
export const MAX_CONTEXT_FILES: number = 200; // Maximum number of files used for code fix prompts
export const MAX_CONTEXT_CHARS: number = 800000; // Maximum total context characters (200,000 tokens)