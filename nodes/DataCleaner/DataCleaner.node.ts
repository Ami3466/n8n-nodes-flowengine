import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	deduplicateFuzzy,
	cleanPhoneNumber,
	toTitleCase,
	normalizeEmail,
	transformObjectKeys,
	isObject,
	getNestedProperty,
	setNestedProperty,
	parseName,
	parseUsername,
	parsePhoneNumber,
	extractFromText,
	formatText,
	parseAddress,
	splitMultiple,
	splitKeyValue,
	toBoolean,
	toNumber,
	toString,
	toSentenceCase,
	toSnakeCase,
	toCamelCase,
	toPascalCase,
} from './utils';

/**
 * Represents a single change made during data transformation
 */
interface ChangeRecord {
	field: string;
	before: unknown;
	after: unknown;
	operation: string;
	status?: 'changed' | 'skipped' | 'error';
	reason?: string;
}

/**
 * Deep clones an object to avoid mutation issues
 */
function deepClone<T>(obj: T): T {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof Date) {
		return new Date(obj.getTime()) as unknown as T;
	}
	if (Array.isArray(obj)) {
		return obj.map(item => deepClone(item)) as unknown as T;
	}
	const cloned: Record<string, unknown> = {};
	for (const key of Object.keys(obj as Record<string, unknown>)) {
		cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
	}
	return cloned as T;
}

/**
 * Finds the actual field name in an object, optionally using case-insensitive matching.
 * Returns the actual key name if found, or undefined if not found.
 */
function findFieldName(obj: IDataObject, fieldName: string, caseInsensitive: boolean): string | undefined {
	// First try exact match
	if (fieldName in obj) {
		return fieldName;
	}

	// If case insensitive, try to find a matching key
	if (caseInsensitive) {
		const lowerFieldName = fieldName.toLowerCase();
		for (const key of Object.keys(obj)) {
			if (key.toLowerCase() === lowerFieldName) {
				return key;
			}
		}
	}

	return undefined;
}

/**
 * Gets a value from an object with optional case-insensitive field matching.
 * Returns { value, actualFieldName } or { value: undefined, actualFieldName: undefined }
 */
function getFieldValue(obj: IDataObject, fieldName: string, caseInsensitive: boolean): { value: unknown; actualFieldName: string | undefined } {
	// Handle nested properties (with dot notation)
	if (fieldName.includes('.')) {
		const parts = fieldName.split('.');
		let current: unknown = obj;
		const actualParts: string[] = [];

		for (const part of parts) {
			if (current === null || typeof current !== 'object') {
				return { value: undefined, actualFieldName: undefined };
			}

			const actualKey = findFieldName(current as IDataObject, part, caseInsensitive);
			if (actualKey === undefined) {
				return { value: undefined, actualFieldName: undefined };
			}

			actualParts.push(actualKey);
			current = (current as IDataObject)[actualKey];
		}

		return { value: current, actualFieldName: actualParts.join('.') };
	}

	// Handle simple field names
	const actualFieldName = findFieldName(obj, fieldName, caseInsensitive);
	if (actualFieldName === undefined) {
		return { value: undefined, actualFieldName: undefined };
	}

	return { value: obj[actualFieldName], actualFieldName };
}

/**
 * DataCleaner Node for n8n
 *
 * A production-ready community node that cleans and transforms data without code.
 * All algorithms are implemented natively in TypeScript without external dependencies
 * to ensure compatibility and verification compliance.
 *
 * Operations:
 * - Deduplicate (Fuzzy): Remove duplicate rows using Jaro-Winkler/Levenshtein algorithms
 * - Clean Phone Numbers: Format phone numbers to E.164 standard
 * - Smart Capitalization: Convert text to proper Title Case
 * - Normalize Email: Standardize email addresses
 * - Clean Object Keys: Transform JSON keys to snake_case or camelCase
 */
export class DataCleaner implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FlowEngine Data Standardize & Clean',
		name: 'dataCleaner',
		icon: 'file:flowengine.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Clean and transform data without code - deduplicate, format phones, normalize emails, and more',
		defaults: {
			name: 'FlowEngine Data Standardize & Clean',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			// ================================================================
			// OPERATION SELECTOR
			// ================================================================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Deduplicate (Fuzzy)',
						value: 'deduplicateFuzzy',
						description: 'Remove duplicate rows using fuzzy string matching',
						action: 'Deduplicate fuzzy',
					},
					{
						name: 'Clean Phone Numbers',
						value: 'cleanPhoneNumbers',
						description: 'Format phone numbers to E.164 standard (+15550001111)',
						action: 'Clean phone numbers',
					},
					{
						name: 'Smart Capitalization',
						value: 'smartCapitalization',
						description: 'Convert text to proper Title Case',
						action: 'Smart capitalization',
					},
					{
						name: 'Normalize Email',
						value: 'normalizeEmail',
						description: 'Trim whitespace and convert emails to lowercase',
						action: 'Normalize email',
					},
					{
						name: 'Clean Object Keys',
						value: 'cleanObjectKeys',
						description: 'Convert all JSON keys to snake_case or camelCase',
						action: 'Clean object keys',
					},
					{
						name: 'Parse Name',
						value: 'parseName',
						description: 'Split a full name into firstName, lastName, middleName, prefix, suffix, and initials',
						action: 'Parse name',
					},
					{
						name: 'Parse Username',
						value: 'parseUsername',
						description: 'Extract name parts from usernames like john_doe, john.doe, or JohnDoe',
						action: 'Parse username',
					},
					{
						name: 'Parse Phone Number',
						value: 'parsePhoneNumber',
						description: 'Parse phone into multiple formats (E.164, national, international) with components',
						action: 'Parse phone number',
					},
					{
						name: 'Parse Address',
						value: 'parseAddress',
						description: 'Split an address into street, city, state, postal code, and country',
						action: 'Parse address',
					},
					{
						name: 'Extract From Text',
						value: 'extractFromText',
						description: 'Extract emails, phones, URLs, dates, amounts, hashtags, and mentions from text',
						action: 'Extract from text',
					},
					{
						name: 'Format Text',
						value: 'formatText',
						description: 'Clean and format text with case conversion, truncation, and character removal',
						action: 'Format text',
					},
					{
						name: 'Split Text',
						value: 'splitText',
						description: 'Split text into array or key-value pairs using delimiters',
						action: 'Split text',
					},
					{
						name: 'Convert Data Type',
						value: 'convertDataType',
						description: 'Convert values between string, number, and boolean types',
						action: 'Convert data type',
					},
				],
				default: 'deduplicateFuzzy',
			},

			// ================================================================
			// DEDUPLICATE (FUZZY) PARAMETERS
			// ================================================================
			{
				displayName: 'Fields to Check',
				name: 'fieldsToCheck',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['deduplicateFuzzy'],
					},
				},
				placeholder: 'name, email, phone',
				description: 'Comma-separated list of field names to compare for duplicates. Example: "firstName, lastName, email"',
			},
			{
				displayName: 'Fuzzy Threshold',
				name: 'fuzzyThreshold',
				type: 'number',
				typeOptions: {
					minValue: 0,
					maxValue: 1,
					numberPrecision: 2,
				},
				default: 0.8,
				displayOptions: {
					show: {
						operation: ['deduplicateFuzzy'],
					},
				},
				description: 'Similarity threshold (0.0-1.0). Records with similarity above this value are considered duplicates. 0.8 = 80% similar.',
			},
			{
				displayName: 'Output Duplicate Info',
				name: 'outputDuplicateInfo',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['deduplicateFuzzy'],
					},
				},
				description: 'Whether to include metadata about removed duplicates in the output',
			},

			// ================================================================
			// CLEAN PHONE NUMBERS PARAMETERS
			// ================================================================
			{
				displayName: 'Phone Field',
				name: 'phoneField',
				type: 'string',
				default: 'phone',
				required: true,
				displayOptions: {
					show: {
						operation: ['cleanPhoneNumbers'],
					},
				},
				placeholder: 'phone',
				description: 'The field name containing the phone number. Supports dot notation for nested fields (e.g., "contact.phone").',
			},
			{
				displayName: 'Default Country Code',
				name: 'defaultCountryCode',
				type: 'string',
				default: '1',
				displayOptions: {
					show: {
						operation: ['cleanPhoneNumbers'],
					},
				},
				placeholder: '1',
				description: 'Default country code to use when none is detected (without +). "1" for US/Canada, "44" for UK, "91" for India, etc.',
			},
			{
				displayName: 'Output Field',
				name: 'phoneOutputField',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['cleanPhoneNumbers'],
					},
				},
				placeholder: 'phoneFormatted',
				description: 'Optional: Save the cleaned phone to a different field. Leave empty to overwrite the original field.',
			},

			// ================================================================
			// SMART CAPITALIZATION PARAMETERS
			// ================================================================
			{
				displayName: 'Fields to Capitalize',
				name: 'capitalizeFields',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['smartCapitalization'],
					},
				},
				placeholder: 'firstName, lastName, city',
				description: 'Comma-separated list of field names to apply title case. Supports dot notation for nested fields.',
			},

			// ================================================================
			// NORMALIZE EMAIL PARAMETERS
			// ================================================================
			{
				displayName: 'Email Field',
				name: 'emailField',
				type: 'string',
				default: 'email',
				required: true,
				displayOptions: {
					show: {
						operation: ['normalizeEmail'],
					},
				},
				placeholder: 'email',
				description: 'The field name containing the email address. Supports dot notation for nested fields.',
			},
			{
				displayName: 'Output Field',
				name: 'emailOutputField',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['normalizeEmail'],
					},
				},
				placeholder: 'emailNormalized',
				description: 'Optional: Save the normalized email to a different field. Leave empty to overwrite the original field.',
			},

			// ================================================================
			// CLEAN OBJECT KEYS PARAMETERS
			// ================================================================
			{
				displayName: 'Key Format',
				name: 'keyFormat',
				type: 'options',
				options: [
					{
						name: 'snake_case',
						value: 'snake_case',
						description: 'Convert keys to snake_case (e.g., "firstName" → "first_name")',
					},
					{
						name: 'camelCase',
						value: 'camelCase',
						description: 'Convert keys to camelCase (e.g., "first_name" → "firstName")',
					},
				],
				default: 'snake_case',
				displayOptions: {
					show: {
						operation: ['cleanObjectKeys'],
					},
				},
				description: 'The case format to apply to all object keys',
			},

			// ================================================================
			// PARSE NAME PARAMETERS
			// ================================================================
			{
				displayName: 'Name Field',
				name: 'nameField',
				type: 'string',
				default: 'name',
				required: true,
				displayOptions: {
					show: {
						operation: ['parseName'],
					},
				},
				placeholder: 'fullName',
				description: 'The field containing the full name to parse (e.g., "Dr. John Smith Jr.")',
			},
			{
				displayName: 'Output Prefix',
				name: 'nameOutputPrefix',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['parseName'],
					},
				},
				placeholder: 'parsed_',
				description: 'Prefix for output fields (e.g., "parsed_" creates parsed_firstName, parsed_lastName). Leave empty for no prefix.',
			},

			// ================================================================
			// PARSE USERNAME PARAMETERS
			// ================================================================
			{
				displayName: 'Username Field',
				name: 'usernameField',
				type: 'string',
				default: 'username',
				required: true,
				displayOptions: {
					show: {
						operation: ['parseUsername'],
					},
				},
				placeholder: 'username',
				description: 'The field containing the username to parse (e.g., "john_doe", "JohnDoe")',
			},
			{
				displayName: 'Output Prefix',
				name: 'usernameOutputPrefix',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['parseUsername'],
					},
				},
				placeholder: 'user_',
				description: 'Prefix for output fields. Leave empty for no prefix.',
			},

			// ================================================================
			// PARSE PHONE NUMBER PARAMETERS
			// ================================================================
			{
				displayName: 'Phone Field',
				name: 'parsePhoneField',
				type: 'string',
				default: 'phone',
				required: true,
				displayOptions: {
					show: {
						operation: ['parsePhoneNumber'],
					},
				},
				placeholder: 'phone',
				description: 'The field containing the phone number to parse',
			},
			{
				displayName: 'Default Country Code',
				name: 'parsePhoneDefaultCountry',
				type: 'string',
				default: '1',
				displayOptions: {
					show: {
						operation: ['parsePhoneNumber'],
					},
				},
				placeholder: '1',
				description: 'Default country code if not detected (1=US/CA, 44=UK, 91=India)',
			},
			{
				displayName: 'Output Prefix',
				name: 'parsePhoneOutputPrefix',
				type: 'string',
				default: 'phone_',
				displayOptions: {
					show: {
						operation: ['parsePhoneNumber'],
					},
				},
				placeholder: 'phone_',
				description: 'Prefix for output fields (e.g., phone_e164, phone_national, phone_areaCode)',
			},

			// ================================================================
			// PARSE ADDRESS PARAMETERS
			// ================================================================
			{
				displayName: 'Address Field',
				name: 'addressField',
				type: 'string',
				default: 'address',
				required: true,
				displayOptions: {
					show: {
						operation: ['parseAddress'],
					},
				},
				placeholder: 'address',
				description: 'The field containing the address to parse',
			},
			{
				displayName: 'Output Prefix',
				name: 'addressOutputPrefix',
				type: 'string',
				default: 'address_',
				displayOptions: {
					show: {
						operation: ['parseAddress'],
					},
				},
				placeholder: 'address_',
				description: 'Prefix for output fields (e.g., address_city, address_state, address_postalCode)',
			},

			// ================================================================
			// EXTRACT FROM TEXT PARAMETERS
			// ================================================================
			{
				displayName: 'Text Field',
				name: 'extractTextField',
				type: 'string',
				default: 'text',
				required: true,
				displayOptions: {
					show: {
						operation: ['extractFromText'],
					},
				},
				placeholder: 'content',
				description: 'The field containing the text to extract data from',
			},
			{
				displayName: 'What to Extract',
				name: 'extractTypes',
				type: 'multiOptions',
				options: [
					{ name: 'Emails', value: 'emails' },
					{ name: 'Phone Numbers', value: 'phones' },
					{ name: 'URLs', value: 'urls' },
					{ name: 'Dates', value: 'dates' },
					{ name: 'Monetary Amounts', value: 'amounts' },
					{ name: 'Hashtags', value: 'hashtags' },
					{ name: 'Mentions (@user)', value: 'mentions' },
					{ name: 'Numbers', value: 'numbers' },
				],
				default: ['emails', 'phones', 'urls'],
				displayOptions: {
					show: {
						operation: ['extractFromText'],
					},
				},
				description: 'Types of data to extract from the text',
			},
			{
				displayName: 'Output Prefix',
				name: 'extractOutputPrefix',
				type: 'string',
				default: 'extracted_',
				displayOptions: {
					show: {
						operation: ['extractFromText'],
					},
				},
				placeholder: 'extracted_',
				description: 'Prefix for output fields (e.g., extracted_emails, extracted_phones)',
			},

			// ================================================================
			// FORMAT TEXT PARAMETERS
			// ================================================================
			{
				displayName: 'Text Field',
				name: 'formatTextField',
				type: 'string',
				default: 'text',
				required: true,
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				placeholder: 'description',
				description: 'The field containing the text to format',
			},
			{
				displayName: 'Output Field',
				name: 'formatTextOutputField',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				placeholder: 'formattedText',
				description: 'Save to a different field. Leave empty to overwrite original.',
			},
			{
				displayName: 'Case Conversion',
				name: 'formatCaseType',
				type: 'options',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'lowercase', value: 'lower' },
					{ name: 'UPPERCASE', value: 'upper' },
					{ name: 'Title Case', value: 'title' },
					{ name: 'Sentence case', value: 'sentence' },
					{ name: 'snake_case', value: 'snake' },
					{ name: 'camelCase', value: 'camel' },
					{ name: 'PascalCase', value: 'pascal' },
				],
				default: 'none',
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				description: 'Convert text to this case format',
			},
			{
				displayName: 'Trim Whitespace',
				name: 'formatTrimWhitespace',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				description: 'Whether to remove extra spaces and trim the text',
			},
			{
				displayName: 'Remove Line Breaks',
				name: 'formatRemoveLineBreaks',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				description: 'Whether to replace line breaks with spaces',
			},
			{
				displayName: 'Remove Special Characters',
				name: 'formatRemoveSpecialChars',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				description: 'Whether to remove all non-alphanumeric characters (except spaces)',
			},
			{
				displayName: 'Remove Numbers',
				name: 'formatRemoveNumbers',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				description: 'Whether to remove all numeric digits',
			},
			{
				displayName: 'Remove Punctuation',
				name: 'formatRemovePunctuation',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				description: 'Whether to remove punctuation marks',
			},
			{
				displayName: 'Max Length',
				name: 'formatMaxLength',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				description: 'Truncate text to this length (0 = no limit)',
			},
			{
				displayName: 'Truncation Indicator',
				name: 'formatTruncationIndicator',
				type: 'string',
				default: '...',
				displayOptions: {
					show: {
						operation: ['formatText'],
					},
				},
				description: 'Text to append when truncating (e.g., "..." or "…")',
			},

			// ================================================================
			// SPLIT TEXT PARAMETERS
			// ================================================================
			{
				displayName: 'Text Field',
				name: 'splitTextField',
				type: 'string',
				default: 'text',
				required: true,
				displayOptions: {
					show: {
						operation: ['splitText'],
					},
				},
				placeholder: 'data',
				description: 'The field containing the text to split',
			},
			{
				displayName: 'Split Mode',
				name: 'splitMode',
				type: 'options',
				options: [
					{
						name: 'To Array',
						value: 'toArray',
						description: 'Split text into an array of values',
					},
					{
						name: 'To Key-Value Pairs',
						value: 'toKeyValue',
						description: 'Parse text into key-value object',
					},
				],
				default: 'toArray',
				displayOptions: {
					show: {
						operation: ['splitText'],
					},
				},
				description: 'How to split the text',
			},
			{
				displayName: 'Delimiters',
				name: 'splitDelimiters',
				type: 'string',
				default: ',;|',
				displayOptions: {
					show: {
						operation: ['splitText'],
						splitMode: ['toArray'],
					},
				},
				placeholder: ',;|\\t\\n',
				description: 'Characters to use as delimiters (each character is a separate delimiter)',
			},
			{
				displayName: 'Pair Delimiter',
				name: 'splitPairDelimiter',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['splitText'],
						splitMode: ['toKeyValue'],
					},
				},
				placeholder: ';',
				description: 'Delimiter between key-value pairs. Leave empty for newline or semicolon.',
			},
			{
				displayName: 'Key-Value Delimiter',
				name: 'splitKvDelimiter',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['splitText'],
						splitMode: ['toKeyValue'],
					},
				},
				placeholder: ':',
				description: 'Delimiter between key and value. Leave empty for colon, equals, or arrow.',
			},
			{
				displayName: 'Output Field',
				name: 'splitOutputField',
				type: 'string',
				default: 'splitResult',
				displayOptions: {
					show: {
						operation: ['splitText'],
					},
				},
				placeholder: 'items',
				description: 'Field name for the split result',
			},

			// ================================================================
			// CONVERT DATA TYPE PARAMETERS
			// ================================================================
			{
				displayName: 'Source Field',
				name: 'convertSourceField',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['convertDataType'],
					},
				},
				placeholder: 'value',
				description: 'The field to convert',
			},
			{
				displayName: 'Target Type',
				name: 'convertTargetType',
				type: 'options',
				options: [
					{
						name: 'String',
						value: 'string',
						description: 'Convert to text string',
					},
					{
						name: 'Number',
						value: 'number',
						description: 'Convert to numeric value (handles $1,234.56 formats)',
					},
					{
						name: 'Boolean',
						value: 'boolean',
						description: 'Convert to true/false (handles "yes", "on", "1", etc.)',
					},
					{
						name: 'Integer',
						value: 'integer',
						description: 'Convert to whole number (rounds if decimal)',
					},
				],
				default: 'string',
				displayOptions: {
					show: {
						operation: ['convertDataType'],
					},
				},
				description: 'The type to convert the value to',
			},
			{
				displayName: 'Output Field',
				name: 'convertOutputField',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['convertDataType'],
					},
				},
				placeholder: 'convertedValue',
				description: 'Save to a different field. Leave empty to overwrite original.',
			},
			{
				displayName: 'Default Value',
				name: 'convertDefaultValue',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						operation: ['convertDataType'],
					},
				},
				placeholder: '0',
				description: 'Value to use if conversion fails. Leave empty to keep original.',
			},

			// ================================================================
			// GLOBAL OPTIONS (for all operations)
			// ================================================================
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Track Changes',
						name: 'trackChanges',
						type: 'boolean',
						default: false,
						description: 'Whether to include a _changes field showing what was modified (before/after values)',
					},
					{
						displayName: 'Continue On Fail',
						name: 'continueOnFail',
						type: 'boolean',
						default: true,
						description: 'Whether to continue processing other items if one item fails',
					},
					{
						displayName: 'Skip Unchanged',
						name: 'skipUnchanged',
						type: 'boolean',
						default: false,
						description: 'Whether to exclude items from output if no changes were made',
					},
					{
						displayName: 'Case Insensitive Fields',
						name: 'caseInsensitiveFields',
						type: 'boolean',
						default: true,
						description: 'Whether to match field names case-insensitively (e.g., "name" matches "Name" or "NAME")',
					},
					{
						displayName: 'Debug Mode',
						name: 'debugMode',
						type: 'boolean',
						default: false,
						description: 'Whether to include detailed debug info in _debug field showing field lookup and transformation steps',
					},
				],
			},
		],
	};

	/**
	 * Main execution method for the DataCleaner node.
	 * Routes to the appropriate operation handler based on user selection.
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const operation = this.getNodeParameter('operation', 0) as string;
		let returnData: INodeExecutionData[] = [];

		try {
			switch (operation) {
				case 'deduplicateFuzzy':
					returnData = await executeDeduplicateFuzzy.call(this, items);
					break;

				case 'cleanPhoneNumbers':
					returnData = await executeCleanPhoneNumbers.call(this, items);
					break;

				case 'smartCapitalization':
					returnData = await executeSmartCapitalization.call(this, items);
					break;

				case 'normalizeEmail':
					returnData = await executeNormalizeEmail.call(this, items);
					break;

				case 'cleanObjectKeys':
					returnData = await executeCleanObjectKeys.call(this, items);
					break;

				case 'parseName':
					returnData = await executeParseName.call(this, items);
					break;

				case 'parseUsername':
					returnData = await executeParseUsername.call(this, items);
					break;

				case 'parsePhoneNumber':
					returnData = await executeParsePhoneNumber.call(this, items);
					break;

				case 'parseAddress':
					returnData = await executeParseAddress.call(this, items);
					break;

				case 'extractFromText':
					returnData = await executeExtractFromText.call(this, items);
					break;

				case 'formatText':
					returnData = await executeFormatText.call(this, items);
					break;

				case 'splitText':
					returnData = await executeSplitText.call(this, items);
					break;

				case 'convertDataType':
					returnData = await executeConvertDataType.call(this, items);
					break;

				default:
					throw new NodeOperationError(
						this.getNode(),
						`Unknown operation: ${operation}`,
					);
			}
		} catch (error) {
			// Re-throw NodeOperationError as-is
			if (error instanceof NodeOperationError) {
				throw error;
			}

			// Wrap other errors in NodeOperationError
			throw new NodeOperationError(
				this.getNode(),
				`Error in Data Cleaner: ${(error as Error).message}`,
			);
		}

		return [returnData];
	}
}

// ============================================================================
// OPERATION HANDLERS
// ============================================================================

/**
 * Fuzzy Deduplication Handler
 *
 * Uses Jaro-Winkler and Levenshtein algorithms (implemented natively in utils.ts)
 * to identify and remove duplicate records based on fuzzy string matching.
 */
async function executeDeduplicateFuzzy(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	// Get parameters
	const fieldsToCheckRaw = this.getNodeParameter('fieldsToCheck', 0) as string;
	const fuzzyThreshold = this.getNodeParameter('fuzzyThreshold', 0) as number;
	const outputDuplicateInfo = this.getNodeParameter('outputDuplicateInfo', 0) as boolean;
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;

	// Parse fields to check
	const fieldsToCheck = fieldsToCheckRaw
		.split(',')
		.map((field) => field.trim())
		.filter((field) => field.length > 0);

	if (fieldsToCheck.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'At least one field must be specified for duplicate checking',
		);
	}

	// Validate threshold
	if (fuzzyThreshold < 0 || fuzzyThreshold > 1) {
		throw new NodeOperationError(
			this.getNode(),
			'Fuzzy threshold must be between 0.0 and 1.0',
		);
	}

	// Extract JSON data from items (deep clone to avoid mutation)
	const records = items.map((item) => deepClone(item.json) as Record<string, unknown>);

	// Perform deduplication using our native algorithm
	const { deduplicated, removedCount, duplicateGroups } = deduplicateFuzzy(
		records,
		fieldsToCheck,
		fuzzyThreshold,
	);

	// Build return data
	const returnData: INodeExecutionData[] = deduplicated.map((json) => ({
		json: json as IDataObject,
	}));

	// Optionally add duplicate metadata to the first item
	if (outputDuplicateInfo && returnData.length > 0) {
		returnData[0].json._deduplicationInfo = {
			originalCount: items.length,
			deduplicatedCount: deduplicated.length,
			removedCount,
			duplicateGroupsFound: duplicateGroups.length,
			fieldsChecked: fieldsToCheck,
			thresholdUsed: fuzzyThreshold,
		} as unknown as IDataObject;
	}

	// Add changes metadata if tracking is enabled
	if (trackChanges && returnData.length > 0) {
		const changes: ChangeRecord[] = [];
		if (removedCount > 0) {
			changes.push({
				field: '_records',
				before: items.length,
				after: deduplicated.length,
				operation: 'deduplicateFuzzy',
			});
		}
		returnData[0].json._changes = changes as unknown as IDataObject;
	}

	return returnData;
}

/**
 * Clean Phone Numbers Handler
 *
 * Formats phone numbers to E.164 standard using regex-only approach.
 * No external phone number libraries are used.
 */
async function executeCleanPhoneNumbers(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const skipUnchanged = options.skipUnchanged as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const phoneField = this.getNodeParameter('phoneField', i) as string;
		const defaultCountryCode = this.getNodeParameter('defaultCountryCode', i) as string;
		const outputField = this.getNodeParameter('phoneOutputField', i) as string;

		// Deep clone the item to avoid mutating the original
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: phoneValue, actualFieldName } = getFieldValue(item.json, phoneField, caseInsensitiveFields);
		const targetField = outputField || actualFieldName || phoneField;

		if (debugMode) {
			debugInfo.requestedField = phoneField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = phoneValue !== undefined && phoneValue !== null;
			debugInfo.valueType = phoneValue === undefined ? 'undefined' : typeof phoneValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
			debugInfo.targetField = targetField;
			debugInfo.defaultCountryCode = defaultCountryCode;
		}

		if (phoneValue === undefined || phoneValue === null || actualFieldName === undefined) {
			// Field not found or null
			if (trackChanges) {
				changes.push({
					field: phoneField,
					before: phoneValue,
					after: phoneValue,
					operation: 'cleanPhoneNumbers',
					status: 'skipped',
					reason: `Field "${phoneField}" not found or is null. Available keys: ${Object.keys(item.json).join(', ')}`,
				});
			}
		} else {
			const originalValue = String(phoneValue);
			const cleanedPhone = cleanPhoneNumber(originalValue, defaultCountryCode);

			// Record change with appropriate status
			if (cleanedPhone !== originalValue) {
				changes.push({
					field: targetField,
					before: originalValue,
					after: cleanedPhone,
					operation: 'cleanPhoneNumbers',
					status: 'changed',
				});
			} else if (trackChanges) {
				changes.push({
					field: targetField,
					before: originalValue,
					after: cleanedPhone,
					operation: 'cleanPhoneNumbers',
					status: 'skipped',
					reason: 'Phone already in correct format',
				});
			}

			// Set the cleaned value
			if (targetField.includes('.')) {
				setNestedProperty(newItem.json as Record<string, unknown>, targetField, cleanedPhone);
			} else {
				newItem.json[targetField] = cleanedPhone;
			}
		}

		// Check if any actual changes were made
		const actualChanges = changes.filter(c => c.status === 'changed');

		// Skip unchanged items if option is enabled
		if (skipUnchanged && actualChanges.length === 0) {
			continue;
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: actualChanges.length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'cleanPhoneNumbers',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Smart Capitalization Handler
 *
 * Converts specified fields to proper Title Case.
 * Handles common exceptions and edge cases.
 */
async function executeSmartCapitalization(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const skipUnchanged = options.skipUnchanged as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const fieldsRaw = this.getNodeParameter('capitalizeFields', i) as string;

		// Parse fields
		const fields = fieldsRaw
			.split(',')
			.map((field) => field.trim())
			.filter((field) => field.length > 0);

		// Deep clone the item to avoid mutating the original
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject[] = [];

		// Process each field
		for (const field of fields) {
			// Use case-insensitive field lookup
			const { value, actualFieldName } = getFieldValue(item.json, field, caseInsensitiveFields);

			if (debugMode) {
				debugInfo.push({
					requestedField: field,
					actualFieldName: actualFieldName || 'NOT FOUND',
					availableKeys: Object.keys(item.json),
					valueFound: value !== undefined,
					valueType: value === undefined ? 'undefined' : typeof value,
					caseInsensitiveEnabled: caseInsensitiveFields,
				});
			}

			if (value === undefined || actualFieldName === undefined) {
				// Field not found - record this for user feedback
				if (trackChanges) {
					changes.push({
						field,
						before: undefined,
						after: undefined,
						operation: 'smartCapitalization',
						status: 'skipped',
						reason: `Field "${field}" not found in item. Available keys: ${Object.keys(item.json).join(', ')}`,
					});
				}
				continue;
			}

			if (typeof value !== 'string') {
				// Field exists but is not a string
				if (trackChanges) {
					changes.push({
						field: actualFieldName,
						before: value,
						after: value,
						operation: 'smartCapitalization',
						status: 'skipped',
						reason: `Field "${actualFieldName}" is not a string (type: ${typeof value})`,
					});
				}
				continue;
			}

			const capitalizedValue = toTitleCase(value);

			// Record change with appropriate status
			if (capitalizedValue !== value) {
				changes.push({
					field: actualFieldName,
					before: value,
					after: capitalizedValue,
					operation: 'smartCapitalization',
					status: 'changed',
				});
			} else if (trackChanges) {
				changes.push({
					field: actualFieldName,
					before: value,
					after: capitalizedValue,
					operation: 'smartCapitalization',
					status: 'skipped',
					reason: 'Value already in correct format',
				});
			}

			// Use the actual field name for setting the value
			if (actualFieldName.includes('.')) {
				setNestedProperty(newItem.json as Record<string, unknown>, actualFieldName, capitalizedValue);
			} else {
				newItem.json[actualFieldName] = capitalizedValue;
			}
		}

		// Check if any actual changes were made (not just skipped)
		const actualChanges = changes.filter(c => c.status === 'changed');

		// Skip unchanged items if option is enabled
		if (skipUnchanged && actualChanges.length === 0) {
			continue;
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: actualChanges.length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'smartCapitalization',
				inputFields: fieldsRaw,
				parsedFields: fields,
				fieldLookups: debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Normalize Email Handler
 *
 * Trims whitespace, converts to lowercase, and corrects common domain typos.
 */
async function executeNormalizeEmail(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const skipUnchanged = options.skipUnchanged as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const emailField = this.getNodeParameter('emailField', i) as string;
		const outputField = this.getNodeParameter('emailOutputField', i) as string;

		// Deep clone the item to avoid mutating the original
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: emailValue, actualFieldName } = getFieldValue(item.json, emailField, caseInsensitiveFields);
		const targetField = outputField || actualFieldName || emailField;

		if (debugMode) {
			debugInfo.requestedField = emailField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = emailValue !== undefined;
			debugInfo.valueType = emailValue === undefined ? 'undefined' : typeof emailValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
			debugInfo.targetField = targetField;
		}

		if (emailValue === undefined || actualFieldName === undefined) {
			if (trackChanges) {
				changes.push({
					field: emailField,
					before: undefined,
					after: undefined,
					operation: 'normalizeEmail',
					status: 'skipped',
					reason: `Field "${emailField}" not found. Available keys: ${Object.keys(item.json).join(', ')}`,
				});
			}
		} else if (typeof emailValue !== 'string') {
			if (trackChanges) {
				changes.push({
					field: actualFieldName,
					before: emailValue,
					after: emailValue,
					operation: 'normalizeEmail',
					status: 'skipped',
					reason: `Field "${actualFieldName}" is not a string (type: ${typeof emailValue})`,
				});
			}
		} else {
			const normalizedEmail = normalizeEmail(emailValue);

			// Record change with appropriate status
			if (normalizedEmail !== emailValue) {
				changes.push({
					field: targetField,
					before: emailValue,
					after: normalizedEmail,
					operation: 'normalizeEmail',
					status: 'changed',
				});
			} else if (trackChanges) {
				changes.push({
					field: targetField,
					before: emailValue,
					after: normalizedEmail,
					operation: 'normalizeEmail',
					status: 'skipped',
					reason: 'Email already in correct format',
				});
			}

			if (targetField.includes('.')) {
				setNestedProperty(newItem.json as Record<string, unknown>, targetField, normalizedEmail);
			} else {
				newItem.json[targetField] = normalizedEmail;
			}
		}

		// Check if any actual changes were made
		const actualChanges = changes.filter(c => c.status === 'changed');

		// Skip unchanged items if option is enabled
		if (skipUnchanged && actualChanges.length === 0) {
			continue;
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: actualChanges.length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'normalizeEmail',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Clean Object Keys Handler
 *
 * Recursively transforms all keys in JSON objects to the specified case format.
 */
async function executeCleanObjectKeys(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const skipUnchanged = options.skipUnchanged as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const keyFormat = this.getNodeParameter('keyFormat', i) as 'snake_case' | 'camelCase';

		// Transform the entire JSON object (transformObjectKeys already creates a new object)
		const transformedJson = transformObjectKeys(deepClone(item.json), keyFormat);

		// Ensure the result is a valid IDataObject
		if (!isObject(transformedJson)) {
			throw new NodeOperationError(
				this.getNode(),
				`Item ${i} did not produce a valid object after key transformation`,
			);
		}

		const changes: ChangeRecord[] = [];

		// Compare keys between original and transformed
		const originalKeys = Object.keys(item.json);
		const transformedKeys = Object.keys(transformedJson as Record<string, unknown>);

		for (let k = 0; k < originalKeys.length; k++) {
			if (originalKeys[k] !== transformedKeys[k]) {
				changes.push({
					field: originalKeys[k],
					before: originalKeys[k],
					after: transformedKeys[k],
					operation: 'cleanObjectKeys',
				});
			}
		}

		// Skip unchanged items if option is enabled
		if (skipUnchanged && changes.length === 0) {
			continue;
		}

		const newItem: INodeExecutionData = {
			json: transformedJson as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Parse Name Handler
 *
 * Parses a full name into firstName, lastName, middleName, prefix, suffix, and initials.
 */
async function executeParseName(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const nameField = this.getNodeParameter('nameField', i) as string;
		const outputPrefix = this.getNodeParameter('nameOutputPrefix', i) as string;

		// Deep clone the item
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: nameValue, actualFieldName } = getFieldValue(item.json, nameField, caseInsensitiveFields);

		if (debugMode) {
			debugInfo.requestedField = nameField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = nameValue !== undefined;
			debugInfo.valueType = nameValue === undefined ? 'undefined' : typeof nameValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
		}

		if (typeof nameValue === 'string') {
			const parsed = parseName(nameValue);

			// Add parsed fields with optional prefix
			const fieldsAdded = [
				{ field: `${outputPrefix}firstName`, value: parsed.firstName },
				{ field: `${outputPrefix}lastName`, value: parsed.lastName },
				{ field: `${outputPrefix}middleName`, value: parsed.middleName },
				{ field: `${outputPrefix}prefix`, value: parsed.prefix },
				{ field: `${outputPrefix}suffix`, value: parsed.suffix },
				{ field: `${outputPrefix}initials`, value: parsed.initials },
				{ field: `${outputPrefix}fullName`, value: parsed.full },
			];

			for (const { field, value } of fieldsAdded) {
				newItem.json[field] = value;
				if (value) {
					changes.push({
						field,
						before: null,
						after: value,
						operation: 'parseName',
						status: 'changed',
					});
				}
			}
		} else if (trackChanges) {
			changes.push({
				field: nameField,
				before: nameValue,
				after: undefined,
				operation: 'parseName',
				status: 'skipped',
				reason: actualFieldName === undefined
					? `Field "${nameField}" not found. Available keys: ${Object.keys(item.json).join(', ')}`
					: `Field "${actualFieldName}" is not a string (type: ${typeof nameValue})`,
			});
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: changes.filter(c => c.status === 'changed').length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'parseName',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Parse Username Handler
 *
 * Parses a username into name components.
 */
async function executeParseUsername(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const usernameField = this.getNodeParameter('usernameField', i) as string;
		const outputPrefix = this.getNodeParameter('usernameOutputPrefix', i) as string;

		// Deep clone the item
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: usernameValue, actualFieldName } = getFieldValue(item.json, usernameField, caseInsensitiveFields);

		if (debugMode) {
			debugInfo.requestedField = usernameField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = usernameValue !== undefined;
			debugInfo.valueType = usernameValue === undefined ? 'undefined' : typeof usernameValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
		}

		if (typeof usernameValue === 'string') {
			const parsed = parseUsername(usernameValue);

			// Add parsed fields with optional prefix
			const fieldsAdded = [
				{ field: `${outputPrefix}firstName`, value: parsed.firstName },
				{ field: `${outputPrefix}lastName`, value: parsed.lastName },
				{ field: `${outputPrefix}middleName`, value: parsed.middleName },
				{ field: `${outputPrefix}initials`, value: parsed.initials },
				{ field: `${outputPrefix}fullName`, value: parsed.full },
			];

			for (const { field, value } of fieldsAdded) {
				newItem.json[field] = value;
				if (value) {
					changes.push({
						field,
						before: null,
						after: value,
						operation: 'parseUsername',
						status: 'changed',
					});
				}
			}
		} else if (trackChanges) {
			changes.push({
				field: usernameField,
				before: usernameValue,
				after: undefined,
				operation: 'parseUsername',
				status: 'skipped',
				reason: actualFieldName === undefined
					? `Field "${usernameField}" not found. Available keys: ${Object.keys(item.json).join(', ')}`
					: `Field "${actualFieldName}" is not a string (type: ${typeof usernameValue})`,
			});
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: changes.filter(c => c.status === 'changed').length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'parseUsername',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Parse Phone Number Handler
 *
 * Parses a phone number into multiple formats and components.
 */
async function executeParsePhoneNumber(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const phoneField = this.getNodeParameter('parsePhoneField', i) as string;
		const defaultCountry = this.getNodeParameter('parsePhoneDefaultCountry', i) as string;
		const outputPrefix = this.getNodeParameter('parsePhoneOutputPrefix', i) as string;

		// Deep clone the item
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: phoneValue, actualFieldName } = getFieldValue(item.json, phoneField, caseInsensitiveFields);

		if (debugMode) {
			debugInfo.requestedField = phoneField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = phoneValue !== undefined && phoneValue !== null;
			debugInfo.valueType = phoneValue === undefined ? 'undefined' : typeof phoneValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
		}

		if (phoneValue !== undefined && phoneValue !== null && actualFieldName !== undefined) {
			const parsed = parsePhoneNumber(String(phoneValue), defaultCountry);

			// Add parsed fields with prefix
			const fieldsAdded = [
				{ field: `${outputPrefix}e164`, value: parsed.e164 },
				{ field: `${outputPrefix}national`, value: parsed.national },
				{ field: `${outputPrefix}international`, value: parsed.international },
				{ field: `${outputPrefix}countryCode`, value: parsed.countryCode },
				{ field: `${outputPrefix}areaCode`, value: parsed.areaCode },
				{ field: `${outputPrefix}localNumber`, value: parsed.localNumber },
				{ field: `${outputPrefix}extension`, value: parsed.extension },
				{ field: `${outputPrefix}isValid`, value: parsed.isValid },
			];

			for (const { field, value } of fieldsAdded) {
				newItem.json[field] = value as IDataObject[keyof IDataObject];
				if (value !== '' && value !== null && value !== undefined) {
					changes.push({
						field,
						before: null,
						after: value,
						operation: 'parsePhoneNumber',
						status: 'changed',
					});
				}
			}
		} else if (trackChanges) {
			changes.push({
				field: phoneField,
				before: phoneValue,
				after: undefined,
				operation: 'parsePhoneNumber',
				status: 'skipped',
				reason: `Field "${phoneField}" not found or is null. Available keys: ${Object.keys(item.json).join(', ')}`,
			});
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: changes.filter(c => c.status === 'changed').length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'parsePhoneNumber',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Parse Address Handler
 *
 * Parses an address into street, city, state, postal code, and country.
 */
async function executeParseAddress(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const addressField = this.getNodeParameter('addressField', i) as string;
		const outputPrefix = this.getNodeParameter('addressOutputPrefix', i) as string;

		// Deep clone the item
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: addressValue, actualFieldName } = getFieldValue(item.json, addressField, caseInsensitiveFields);

		if (debugMode) {
			debugInfo.requestedField = addressField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = addressValue !== undefined;
			debugInfo.valueType = addressValue === undefined ? 'undefined' : typeof addressValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
		}

		if (typeof addressValue === 'string') {
			const parsed = parseAddress(addressValue);

			// Add parsed fields with prefix
			const fieldsAdded = [
				{ field: `${outputPrefix}streetNumber`, value: parsed.streetNumber },
				{ field: `${outputPrefix}streetName`, value: parsed.streetName },
				{ field: `${outputPrefix}streetAddress`, value: parsed.streetAddress },
				{ field: `${outputPrefix}unit`, value: parsed.unit },
				{ field: `${outputPrefix}city`, value: parsed.city },
				{ field: `${outputPrefix}state`, value: parsed.state },
				{ field: `${outputPrefix}postalCode`, value: parsed.postalCode },
				{ field: `${outputPrefix}country`, value: parsed.country },
			];

			for (const { field, value } of fieldsAdded) {
				newItem.json[field] = value;
				if (value) {
					changes.push({
						field,
						before: null,
						after: value,
						operation: 'parseAddress',
						status: 'changed',
					});
				}
			}
		} else if (trackChanges) {
			changes.push({
				field: addressField,
				before: addressValue,
				after: undefined,
				operation: 'parseAddress',
				status: 'skipped',
				reason: actualFieldName === undefined
					? `Field "${addressField}" not found. Available keys: ${Object.keys(item.json).join(', ')}`
					: `Field "${actualFieldName}" is not a string (type: ${typeof addressValue})`,
			});
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: changes.filter(c => c.status === 'changed').length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'parseAddress',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Extract From Text Handler
 *
 * Extracts structured data (emails, phones, URLs, etc.) from plain text.
 */
async function executeExtractFromText(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const textField = this.getNodeParameter('extractTextField', i) as string;
		const extractTypes = this.getNodeParameter('extractTypes', i) as string[];
		const outputPrefix = this.getNodeParameter('extractOutputPrefix', i) as string;

		// Deep clone the item
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: textValue, actualFieldName } = getFieldValue(item.json, textField, caseInsensitiveFields);

		if (debugMode) {
			debugInfo.requestedField = textField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = textValue !== undefined;
			debugInfo.valueType = textValue === undefined ? 'undefined' : typeof textValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
		}

		if (typeof textValue === 'string') {
			const extracted = extractFromText(textValue);

			// Add only the requested extraction types
			for (const type of extractTypes) {
				if (type in extracted) {
					const field = `${outputPrefix}${type}`;
					const value = extracted[type as keyof typeof extracted];
					newItem.json[field] = value as IDataObject[keyof IDataObject];

					if (Array.isArray(value) && value.length > 0) {
						changes.push({
							field,
							before: null,
							after: value,
							operation: 'extractFromText',
							status: 'changed',
						});
					}
				}
			}
		} else if (trackChanges) {
			changes.push({
				field: textField,
				before: textValue,
				after: undefined,
				operation: 'extractFromText',
				status: 'skipped',
				reason: actualFieldName === undefined
					? `Field "${textField}" not found. Available keys: ${Object.keys(item.json).join(', ')}`
					: `Field "${actualFieldName}" is not a string (type: ${typeof textValue})`,
			});
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: changes.filter(c => c.status === 'changed').length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'extractFromText',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Format Text Handler
 *
 * Formats text with various options (case, trimming, truncation, etc.)
 */
async function executeFormatText(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const skipUnchanged = options.skipUnchanged as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const textField = this.getNodeParameter('formatTextField', i) as string;
		const outputField = this.getNodeParameter('formatTextOutputField', i) as string;
		const caseType = this.getNodeParameter('formatCaseType', i) as string;
		const trimWhitespace = this.getNodeParameter('formatTrimWhitespace', i) as boolean;
		const removeLineBreaks = this.getNodeParameter('formatRemoveLineBreaks', i) as boolean;
		const removeSpecialChars = this.getNodeParameter('formatRemoveSpecialChars', i) as boolean;
		const removeNumbers = this.getNodeParameter('formatRemoveNumbers', i) as boolean;
		const removePunctuation = this.getNodeParameter('formatRemovePunctuation', i) as boolean;
		const maxLength = this.getNodeParameter('formatMaxLength', i) as number;
		const truncationIndicator = this.getNodeParameter('formatTruncationIndicator', i) as string;

		// Deep clone the item
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: textValue, actualFieldName } = getFieldValue(item.json, textField, caseInsensitiveFields);
		const targetField = outputField || actualFieldName || textField;

		if (debugMode) {
			debugInfo.requestedField = textField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = textValue !== undefined;
			debugInfo.valueType = textValue === undefined ? 'undefined' : typeof textValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
			debugInfo.targetField = targetField;
		}

		if (typeof textValue === 'string') {
			let result = textValue;

			// Apply formatting using the utility function for most options
			result = formatText(result, {
				trimWhitespace,
				removeLineBreaks,
				removeSpecialChars,
				removeNumbers,
				removePunctuation,
				maxLength: maxLength > 0 ? maxLength : undefined,
				truncationIndicator,
			});

			// Handle case conversion (including the extra snake/camel/pascal options)
			if (caseType && caseType !== 'none') {
				switch (caseType) {
					case 'lower':
						result = result.toLowerCase();
						break;
					case 'upper':
						result = result.toUpperCase();
						break;
					case 'title':
						result = toTitleCase(result);
						break;
					case 'sentence':
						result = toSentenceCase(result);
						break;
					case 'snake':
						result = toSnakeCase(result);
						break;
					case 'camel':
						result = toCamelCase(result);
						break;
					case 'pascal':
						result = toPascalCase(result);
						break;
				}
			}

			// Record change if value actually changed
			if (result !== textValue) {
				changes.push({
					field: targetField,
					before: textValue,
					after: result,
					operation: 'formatText',
					status: 'changed',
				});
			} else if (trackChanges) {
				changes.push({
					field: targetField,
					before: textValue,
					after: result,
					operation: 'formatText',
					status: 'skipped',
					reason: 'Value already in correct format',
				});
			}

			if (targetField.includes('.')) {
				setNestedProperty(newItem.json as Record<string, unknown>, targetField, result);
			} else {
				newItem.json[targetField] = result;
			}
		} else if (trackChanges) {
			changes.push({
				field: textField,
				before: textValue,
				after: undefined,
				operation: 'formatText',
				status: 'skipped',
				reason: actualFieldName === undefined
					? `Field "${textField}" not found. Available keys: ${Object.keys(item.json).join(', ')}`
					: `Field "${actualFieldName}" is not a string (type: ${typeof textValue})`,
			});
		}

		// Skip unchanged items if option is enabled
		const actualChanges = changes.filter(c => c.status === 'changed');
		if (skipUnchanged && actualChanges.length === 0) {
			continue;
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: actualChanges.length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'formatText',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Split Text Handler
 *
 * Splits text into an array or key-value pairs.
 */
async function executeSplitText(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const textField = this.getNodeParameter('splitTextField', i) as string;
		const splitMode = this.getNodeParameter('splitMode', i) as string;
		const outputField = this.getNodeParameter('splitOutputField', i) as string;

		// Deep clone the item
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: textValue, actualFieldName } = getFieldValue(item.json, textField, caseInsensitiveFields);

		if (debugMode) {
			debugInfo.requestedField = textField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = textValue !== undefined;
			debugInfo.valueType = textValue === undefined ? 'undefined' : typeof textValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
		}

		if (typeof textValue === 'string') {
			let result: unknown;

			if (splitMode === 'toArray') {
				const delimitersRaw = this.getNodeParameter('splitDelimiters', i) as string;
				// Convert string to array of individual characters
				const delimiters = delimitersRaw.split('').filter(d => d.length > 0);
				result = splitMultiple(textValue, delimiters.length > 0 ? delimiters : undefined);
				newItem.json[outputField] = result as IDataObject[keyof IDataObject];
			} else {
				// toKeyValue mode
				const pairDelimiter = this.getNodeParameter('splitPairDelimiter', i) as string;
				const kvDelimiter = this.getNodeParameter('splitKvDelimiter', i) as string;
				result = splitKeyValue(
					textValue,
					pairDelimiter || undefined,
					kvDelimiter || undefined,
				);
				newItem.json[outputField] = result as IDataObject[keyof IDataObject];
			}

			changes.push({
				field: outputField,
				before: textValue,
				after: result,
				operation: 'splitText',
				status: 'changed',
			});
		} else if (trackChanges) {
			changes.push({
				field: textField,
				before: textValue,
				after: undefined,
				operation: 'splitText',
				status: 'skipped',
				reason: actualFieldName === undefined
					? `Field "${textField}" not found. Available keys: ${Object.keys(item.json).join(', ')}`
					: `Field "${actualFieldName}" is not a string (type: ${typeof textValue})`,
			});
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: changes.filter(c => c.status === 'changed').length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'splitText',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}

/**
 * Convert Data Type Handler
 *
 * Converts field values between string, number, boolean, and integer types.
 */
async function executeConvertDataType(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const options = this.getNodeParameter('options', 0, {}) as IDataObject;
	const trackChanges = options.trackChanges as boolean || false;
	const skipUnchanged = options.skipUnchanged as boolean || false;
	const caseInsensitiveFields = options.caseInsensitiveFields !== false; // Default true
	const debugMode = options.debugMode as boolean || false;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const sourceField = this.getNodeParameter('convertSourceField', i) as string;
		const targetType = this.getNodeParameter('convertTargetType', i) as string;
		const outputField = this.getNodeParameter('convertOutputField', i) as string;
		const defaultValue = this.getNodeParameter('convertDefaultValue', i) as string;

		// Deep clone the item
		const newItem: INodeExecutionData = {
			json: deepClone(item.json) as IDataObject,
			pairedItem: item.pairedItem,
		};

		const changes: ChangeRecord[] = [];
		const debugInfo: IDataObject = {};

		// Use case-insensitive field lookup
		const { value: sourceValue, actualFieldName } = getFieldValue(item.json, sourceField, caseInsensitiveFields);
		const targetField = outputField || actualFieldName || sourceField;

		if (debugMode) {
			debugInfo.requestedField = sourceField;
			debugInfo.actualFieldName = actualFieldName || 'NOT FOUND';
			debugInfo.availableKeys = Object.keys(item.json);
			debugInfo.valueFound = sourceValue !== undefined;
			debugInfo.valueType = sourceValue === undefined ? 'undefined' : typeof sourceValue;
			debugInfo.caseInsensitiveEnabled = caseInsensitiveFields;
			debugInfo.targetField = targetField;
			debugInfo.targetType = targetType;
		}

		let convertedValue: unknown = sourceValue;
		let conversionSucceeded = false;

		if (actualFieldName !== undefined) {
			try {
				switch (targetType) {
					case 'string':
						convertedValue = toString(sourceValue, defaultValue || '');
						conversionSucceeded = true;
						break;
					case 'number':
						convertedValue = toNumber(sourceValue, defaultValue ? parseFloat(defaultValue) : 0);
						conversionSucceeded = true;
						break;
					case 'integer':
						const num = toNumber(sourceValue, defaultValue ? parseFloat(defaultValue) : 0);
						convertedValue = Math.round(num);
						conversionSucceeded = true;
						break;
					case 'boolean':
						convertedValue = toBoolean(sourceValue, defaultValue ? toBoolean(defaultValue) : false);
						conversionSucceeded = true;
						break;
				}
			} catch {
				// If conversion fails, use default or original
				if (defaultValue) {
					convertedValue = defaultValue;
				}
			}

			// Record change if value actually changed
			if (convertedValue !== sourceValue) {
				changes.push({
					field: targetField,
					before: sourceValue,
					after: convertedValue,
					operation: 'convertDataType',
					status: 'changed',
				});
			} else if (trackChanges && conversionSucceeded) {
				changes.push({
					field: targetField,
					before: sourceValue,
					after: convertedValue,
					operation: 'convertDataType',
					status: 'skipped',
					reason: 'Value already in target type',
				});
			}

			if (targetField.includes('.')) {
				setNestedProperty(newItem.json as Record<string, unknown>, targetField, convertedValue);
			} else {
				newItem.json[targetField] = convertedValue as IDataObject[keyof IDataObject];
			}
		} else if (trackChanges) {
			changes.push({
				field: sourceField,
				before: undefined,
				after: undefined,
				operation: 'convertDataType',
				status: 'skipped',
				reason: `Field "${sourceField}" not found. Available keys: ${Object.keys(item.json).join(', ')}`,
			});
		}

		// Skip unchanged items if option is enabled
		const actualChanges = changes.filter(c => c.status === 'changed');
		if (skipUnchanged && actualChanges.length === 0) {
			continue;
		}

		// Add changes metadata if tracking is enabled
		if (trackChanges) {
			newItem.json._changes = changes as unknown as IDataObject;
			newItem.json._changesSummary = {
				changed: actualChanges.length,
				skipped: changes.filter(c => c.status === 'skipped').length,
				total: changes.length,
			} as unknown as IDataObject;
		}

		// Add debug info if debug mode is enabled
		if (debugMode) {
			newItem.json._debug = {
				operation: 'convertDataType',
				...debugInfo,
				itemIndex: i,
			} as unknown as IDataObject;
		}

		returnData.push(newItem);
	}

	return returnData;
}
