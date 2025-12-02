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

	// Extract JSON data from items
	const records = items.map((item) => item.json as Record<string, unknown>);

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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const phoneField = this.getNodeParameter('phoneField', i) as string;
		const defaultCountryCode = this.getNodeParameter('defaultCountryCode', i) as string;
		const outputField = this.getNodeParameter('phoneOutputField', i) as string;

		// Clone the item to avoid mutating the original
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the phone value (supports nested fields)
		const phoneValue = getNestedProperty(item.json, phoneField);

		if (phoneValue !== undefined && phoneValue !== null) {
			const cleanedPhone = cleanPhoneNumber(String(phoneValue), defaultCountryCode);

			// Determine output field
			const targetField = outputField || phoneField;

			// Set the cleaned value
			if (targetField.includes('.')) {
				setNestedProperty(newItem.json as Record<string, unknown>, targetField, cleanedPhone);
			} else {
				newItem.json[targetField] = cleanedPhone;
			}
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const fieldsRaw = this.getNodeParameter('capitalizeFields', i) as string;

		// Parse fields
		const fields = fieldsRaw
			.split(',')
			.map((field) => field.trim())
			.filter((field) => field.length > 0);

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Process each field
		for (const field of fields) {
			const value = getNestedProperty(item.json, field);

			if (typeof value === 'string') {
				const capitalizedValue = toTitleCase(value);

				if (field.includes('.')) {
					setNestedProperty(newItem.json as Record<string, unknown>, field, capitalizedValue);
				} else {
					newItem.json[field] = capitalizedValue;
				}
			}
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const emailField = this.getNodeParameter('emailField', i) as string;
		const outputField = this.getNodeParameter('emailOutputField', i) as string;

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the email value
		const emailValue = getNestedProperty(item.json, emailField);

		if (typeof emailValue === 'string') {
			const normalizedEmail = normalizeEmail(emailValue);

			// Determine output field
			const targetField = outputField || emailField;

			if (targetField.includes('.')) {
				setNestedProperty(newItem.json as Record<string, unknown>, targetField, normalizedEmail);
			} else {
				newItem.json[targetField] = normalizedEmail;
			}
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const keyFormat = this.getNodeParameter('keyFormat', i) as 'snake_case' | 'camelCase';

		// Transform the entire JSON object
		const transformedJson = transformObjectKeys(item.json, keyFormat);

		// Ensure the result is a valid IDataObject
		if (!isObject(transformedJson)) {
			throw new NodeOperationError(
				this.getNode(),
				`Item ${i} did not produce a valid object after key transformation`,
			);
		}

		returnData.push({
			json: transformedJson as IDataObject,
			pairedItem: item.pairedItem,
		});
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const nameField = this.getNodeParameter('nameField', i) as string;
		const outputPrefix = this.getNodeParameter('nameOutputPrefix', i) as string;

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the name value
		const nameValue = getNestedProperty(item.json, nameField);

		if (typeof nameValue === 'string') {
			const parsed = parseName(nameValue);

			// Add parsed fields with optional prefix
			newItem.json[`${outputPrefix}firstName`] = parsed.firstName;
			newItem.json[`${outputPrefix}lastName`] = parsed.lastName;
			newItem.json[`${outputPrefix}middleName`] = parsed.middleName;
			newItem.json[`${outputPrefix}prefix`] = parsed.prefix;
			newItem.json[`${outputPrefix}suffix`] = parsed.suffix;
			newItem.json[`${outputPrefix}initials`] = parsed.initials;
			newItem.json[`${outputPrefix}fullName`] = parsed.full;
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const usernameField = this.getNodeParameter('usernameField', i) as string;
		const outputPrefix = this.getNodeParameter('usernameOutputPrefix', i) as string;

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the username value
		const usernameValue = getNestedProperty(item.json, usernameField);

		if (typeof usernameValue === 'string') {
			const parsed = parseUsername(usernameValue);

			// Add parsed fields with optional prefix
			newItem.json[`${outputPrefix}firstName`] = parsed.firstName;
			newItem.json[`${outputPrefix}lastName`] = parsed.lastName;
			newItem.json[`${outputPrefix}middleName`] = parsed.middleName;
			newItem.json[`${outputPrefix}initials`] = parsed.initials;
			newItem.json[`${outputPrefix}fullName`] = parsed.full;
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const phoneField = this.getNodeParameter('parsePhoneField', i) as string;
		const defaultCountry = this.getNodeParameter('parsePhoneDefaultCountry', i) as string;
		const outputPrefix = this.getNodeParameter('parsePhoneOutputPrefix', i) as string;

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the phone value
		const phoneValue = getNestedProperty(item.json, phoneField);

		if (phoneValue !== undefined && phoneValue !== null) {
			const parsed = parsePhoneNumber(String(phoneValue), defaultCountry);

			// Add parsed fields with prefix
			newItem.json[`${outputPrefix}e164`] = parsed.e164;
			newItem.json[`${outputPrefix}national`] = parsed.national;
			newItem.json[`${outputPrefix}international`] = parsed.international;
			newItem.json[`${outputPrefix}countryCode`] = parsed.countryCode;
			newItem.json[`${outputPrefix}areaCode`] = parsed.areaCode;
			newItem.json[`${outputPrefix}localNumber`] = parsed.localNumber;
			newItem.json[`${outputPrefix}extension`] = parsed.extension;
			newItem.json[`${outputPrefix}isValid`] = parsed.isValid;
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const addressField = this.getNodeParameter('addressField', i) as string;
		const outputPrefix = this.getNodeParameter('addressOutputPrefix', i) as string;

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the address value
		const addressValue = getNestedProperty(item.json, addressField);

		if (typeof addressValue === 'string') {
			const parsed = parseAddress(addressValue);

			// Add parsed fields with prefix
			newItem.json[`${outputPrefix}streetNumber`] = parsed.streetNumber;
			newItem.json[`${outputPrefix}streetName`] = parsed.streetName;
			newItem.json[`${outputPrefix}streetAddress`] = parsed.streetAddress;
			newItem.json[`${outputPrefix}unit`] = parsed.unit;
			newItem.json[`${outputPrefix}city`] = parsed.city;
			newItem.json[`${outputPrefix}state`] = parsed.state;
			newItem.json[`${outputPrefix}postalCode`] = parsed.postalCode;
			newItem.json[`${outputPrefix}country`] = parsed.country;
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const textField = this.getNodeParameter('extractTextField', i) as string;
		const extractTypes = this.getNodeParameter('extractTypes', i) as string[];
		const outputPrefix = this.getNodeParameter('extractOutputPrefix', i) as string;

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the text value
		const textValue = getNestedProperty(item.json, textField);

		if (typeof textValue === 'string') {
			const extracted = extractFromText(textValue);

			// Add only the requested extraction types
			for (const type of extractTypes) {
				if (type in extracted) {
					newItem.json[`${outputPrefix}${type}`] = extracted[type as keyof typeof extracted];
				}
			}
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

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the text value
		const textValue = getNestedProperty(item.json, textField);

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

			// Determine output field
			const targetField = outputField || textField;

			if (targetField.includes('.')) {
				setNestedProperty(newItem.json as Record<string, unknown>, targetField, result);
			} else {
				newItem.json[targetField] = result;
			}
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const textField = this.getNodeParameter('splitTextField', i) as string;
		const splitMode = this.getNodeParameter('splitMode', i) as string;
		const outputField = this.getNodeParameter('splitOutputField', i) as string;

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the text value
		const textValue = getNestedProperty(item.json, textField);

		if (typeof textValue === 'string') {
			if (splitMode === 'toArray') {
				const delimitersRaw = this.getNodeParameter('splitDelimiters', i) as string;
				// Convert string to array of individual characters
				const delimiters = delimitersRaw.split('').filter(d => d.length > 0);
				const result = splitMultiple(textValue, delimiters.length > 0 ? delimiters : undefined);
				newItem.json[outputField] = result;
			} else {
				// toKeyValue mode
				const pairDelimiter = this.getNodeParameter('splitPairDelimiter', i) as string;
				const kvDelimiter = this.getNodeParameter('splitKvDelimiter', i) as string;
				const result = splitKeyValue(
					textValue,
					pairDelimiter || undefined,
					kvDelimiter || undefined,
				);
				newItem.json[outputField] = result;
			}
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

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const sourceField = this.getNodeParameter('convertSourceField', i) as string;
		const targetType = this.getNodeParameter('convertTargetType', i) as string;
		const outputField = this.getNodeParameter('convertOutputField', i) as string;
		const defaultValue = this.getNodeParameter('convertDefaultValue', i) as string;

		// Clone the item
		const newItem: INodeExecutionData = {
			json: { ...item.json } as IDataObject,
			pairedItem: item.pairedItem,
		};

		// Get the source value
		const sourceValue = getNestedProperty(item.json, sourceField);
		let convertedValue: unknown = sourceValue;

		try {
			switch (targetType) {
				case 'string':
					convertedValue = toString(sourceValue, defaultValue || '');
					break;
				case 'number':
					convertedValue = toNumber(sourceValue, defaultValue ? parseFloat(defaultValue) : 0);
					break;
				case 'integer':
					const num = toNumber(sourceValue, defaultValue ? parseFloat(defaultValue) : 0);
					convertedValue = Math.round(num);
					break;
				case 'boolean':
					convertedValue = toBoolean(sourceValue, defaultValue ? toBoolean(defaultValue) : false);
					break;
			}
		} catch {
			// If conversion fails, use default or original
			if (defaultValue) {
				convertedValue = defaultValue;
			}
		}

		// Determine output field
		const targetField = outputField || sourceField;

		if (targetField.includes('.')) {
			setNestedProperty(newItem.json as Record<string, unknown>, targetField, convertedValue);
		} else {
			newItem.json[targetField] = convertedValue as IDataObject[keyof IDataObject];
		}

		returnData.push(newItem);
	}

	return returnData;
}
