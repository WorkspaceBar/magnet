import typescriptEslint from 'typescript-eslint';

export default [{ files: ['**/*.ts'] }, {

	// Use the typescript plugin for linting typescript files
	plugins: {
		'@typescript-eslint': typescriptEslint.plugin,
	},

	// Use the typescript parser for .ts files
	languageOptions: {
		parser: typescriptEslint.parser,
		ecmaVersion: 2022,
		sourceType: 'module',
	},

	// Define rules for typescript files
	rules: {
		'@typescript-eslint/naming-convention': ['warn', {
			selector: 'import',
			format: ['camelCase', 'PascalCase'],
		}],

		curly: 'warn',
		eqeqeq: 'warn',
		'no-throw-literal': 'warn',
		semi: 'warn',
	},
}];