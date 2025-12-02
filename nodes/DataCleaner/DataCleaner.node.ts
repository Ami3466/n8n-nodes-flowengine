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
