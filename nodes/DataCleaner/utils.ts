/**
 * utils.ts - Native Algorithm Implementations for n8n-nodes-data-cleaner
 *
 * IMPORTANT: Zero Runtime Dependencies Policy
 * ============================================
 * This file contains custom implementations of algorithms that would typically
 * require external libraries (lodash, fuse.js, libphonenumber-js, etc.).
 *
 * Why native implementations?
 * 1. n8n Community Node verification requires minimal/zero runtime dependencies
 * 2. Reduces bundle size and attack surface
 * 3. Ensures compatibility across all n8n versions
 * 4. Avoids licensing conflicts with the MIT license requirement
 *
 * All algorithms are thoroughly documented and tested for production use.
 */

// ============================================================================
// FUZZY STRING MATCHING ALGORITHMS
// ============================================================================

/**
 * Calculates the Levenshtein distance between two strings.
 * This is the minimum number of single-character edits (insertions, deletions,
 * or substitutions) required to change one string into the other.
 *
 * Time Complexity: O(m * n) where m and n are string lengths
 * Space Complexity: O(min(m, n)) - optimized to use single row
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns The edit distance between the two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
	// Normalize strings for comparison
	const s1 = str1.toLowerCase().trim();
	const s2 = str2.toLowerCase().trim();

	// Early exit for identical strings
	if (s1 === s2) return 0;

	// Early exit for empty strings
	if (s1.length === 0) return s2.length;
	if (s2.length === 0) return s1.length;

	// Ensure s1 is the shorter string for space optimization
	const [shorter, longer] = s1.length <= s2.length ? [s1, s2] : [s2, s1];

	// Use a single row instead of full matrix (space optimization)
	let previousRow: number[] = Array.from({ length: shorter.length + 1 }, (_, i) => i);
	let currentRow: number[] = new Array(shorter.length + 1);

	for (let i = 1; i <= longer.length; i++) {
		currentRow[0] = i;

		for (let j = 1; j <= shorter.length; j++) {
			const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;

			currentRow[j] = Math.min(
				currentRow[j - 1] + 1,      // Insertion
				previousRow[j] + 1,          // Deletion
				previousRow[j - 1] + cost    // Substitution
			);
		}

		// Swap rows
		[previousRow, currentRow] = [currentRow, previousRow];
	}

	return previousRow[shorter.length];
}

/**
 * Calculates a normalized similarity score between two strings using Levenshtein distance.
 * Returns a value between 0.0 (completely different) and 1.0 (identical).
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score between 0.0 and 1.0
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
	if (!str1 && !str2) return 1.0;
	if (!str1 || !str2) return 0.0;

	const distance = levenshteinDistance(str1, str2);
	const maxLength = Math.max(str1.length, str2.length);

	return maxLength === 0 ? 1.0 : 1.0 - distance / maxLength;
}

/**
 * Jaro similarity algorithm - measures the similarity between two strings.
 * Better suited for short strings like names than Levenshtein.
 *
 * The Jaro similarity considers:
 * - Number of matching characters
 * - Number of transpositions
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score between 0.0 and 1.0
 */
export function jaroSimilarity(str1: string, str2: string): number {
	const s1 = str1.toLowerCase().trim();
	const s2 = str2.toLowerCase().trim();

	if (s1 === s2) return 1.0;
	if (s1.length === 0 || s2.length === 0) return 0.0;

	// Calculate the match window
	const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
	const matchWindowSize = Math.max(0, matchWindow);

	const s1Matches = new Array(s1.length).fill(false);
	const s2Matches = new Array(s2.length).fill(false);

	let matches = 0;
	let transpositions = 0;

	// Find matching characters within the window
	for (let i = 0; i < s1.length; i++) {
		const start = Math.max(0, i - matchWindowSize);
		const end = Math.min(i + matchWindowSize + 1, s2.length);

		for (let j = start; j < end; j++) {
			if (s2Matches[j] || s1[i] !== s2[j]) continue;

			s1Matches[i] = true;
			s2Matches[j] = true;
			matches++;
			break;
		}
	}

	if (matches === 0) return 0.0;

	// Count transpositions
	let k = 0;
	for (let i = 0; i < s1.length; i++) {
		if (!s1Matches[i]) continue;

		while (!s2Matches[k]) k++;

		if (s1[i] !== s2[k]) transpositions++;
		k++;
	}

	const jaro =
		(matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

	return jaro;
}

/**
 * Jaro-Winkler similarity - an extension of Jaro that gives more weight
 * to strings that match from the beginning. Excellent for name matching.
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @param prefixScale - Scaling factor for common prefix (default: 0.1, max: 0.25)
 * @returns Similarity score between 0.0 and 1.0
 */
export function jaroWinklerSimilarity(
	str1: string,
	str2: string,
	prefixScale: number = 0.1
): number {
	const jaroSim = jaroSimilarity(str1, str2);

	if (jaroSim === 0) return 0.0;

	const s1 = str1.toLowerCase().trim();
	const s2 = str2.toLowerCase().trim();

	// Calculate common prefix length (max 4 characters)
	let prefixLength = 0;
	const maxPrefixLength = Math.min(4, Math.min(s1.length, s2.length));

	for (let i = 0; i < maxPrefixLength; i++) {
		if (s1[i] === s2[i]) {
			prefixLength++;
		} else {
			break;
		}
	}

	// Ensure prefix scale doesn't exceed 0.25
	const boundedScale = Math.min(prefixScale, 0.25);

	return jaroSim + prefixLength * boundedScale * (1 - jaroSim);
}

/**
 * Combined fuzzy matching function that uses the best algorithm based on context.
 * Uses Jaro-Winkler for short strings, Levenshtein for longer ones.
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score between 0.0 and 1.0
 */
export function fuzzyMatch(str1: string, str2: string): number {
	// For short strings (< 10 chars), Jaro-Winkler is more appropriate
	if (str1.length < 10 && str2.length < 10) {
		return jaroWinklerSimilarity(str1, str2);
	}

	// For longer strings, use Levenshtein-based similarity
	return levenshteinSimilarity(str1, str2);
}

// ============================================================================
// CASE CONVERSION UTILITIES
// ============================================================================

/**
 * Converts a string to Title Case with smart handling of common patterns.
 * Handles mixed case input like "jOhN dOE" -> "John Doe"
 *
 * @param str - The input string to convert
 * @returns Title-cased string
 */
export function toTitleCase(str: string): string {
	if (!str) return '';

	// Common lowercase exceptions (articles, prepositions, conjunctions)
	const exceptions = new Set([
		'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'so', 'yet',
		'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'it'
	]);

	// Common uppercase exceptions (acronyms, etc.)
	const uppercaseExceptions = new Set([
		'usa', 'uk', 'uae', 'nyc', 'la', 'dc', 'ibm', 'nasa', 'fbi', 'cia',
		'ceo', 'cfo', 'cto', 'coo', 'vp', 'svp', 'evp', 'md', 'phd', 'llc',
		'inc', 'ltd', 'ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'xi'
	]);

	return str
		.toLowerCase()
		.split(/(\s+)/) // Split on whitespace but keep delimiters
		.map((word, index, array) => {
			// Skip whitespace
			if (/^\s+$/.test(word)) return word;

			const lowerWord = word.toLowerCase();

			// Check for uppercase exceptions
			if (uppercaseExceptions.has(lowerWord)) {
				return word.toUpperCase();
			}

			// Apply lowercase exceptions (but not for first/last word)
			const isFirstOrLast = index === 0 || index === array.length - 1;
			if (!isFirstOrLast && exceptions.has(lowerWord)) {
				return lowerWord;
			}

			// Standard title case: capitalize first letter
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join('');
}

/**
 * Converts a string to snake_case.
 * Handles camelCase, PascalCase, spaces, hyphens, and mixed input.
 *
 * @param str - The input string to convert
 * @returns snake_case string
 */
export function toSnakeCase(str: string): string {
	if (!str) return '';

	return str
		// Insert underscore before uppercase letters (for camelCase/PascalCase)
		.replace(/([a-z])([A-Z])/g, '$1_$2')
		// Insert underscore before sequences of uppercase followed by lowercase
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
		// Replace spaces, hyphens, dots with underscores
		.replace(/[\s\-\.]+/g, '_')
		// Remove non-alphanumeric characters except underscores
		.replace(/[^a-zA-Z0-9_]/g, '')
		// Convert to lowercase
		.toLowerCase()
		// Remove leading/trailing underscores
		.replace(/^_+|_+$/g, '')
		// Collapse multiple underscores
		.replace(/_+/g, '_');
}

/**
 * Converts a string to camelCase.
 * Handles snake_case, PascalCase, spaces, hyphens, and mixed input.
 *
 * @param str - The input string to convert
 * @returns camelCase string
 */
export function toCamelCase(str: string): string {
	if (!str) return '';

	return str
		// Replace special characters with spaces for word boundary detection
		.replace(/[_\-\.\s]+/g, ' ')
		// Trim and lowercase
		.trim()
		.toLowerCase()
		// Split into words and process
		.split(' ')
		.filter((word) => word.length > 0)
		.map((word, index) => {
			if (index === 0) {
				// First word stays lowercase
				return word;
			}
			// Capitalize first letter of subsequent words
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join('');
}

/**
 * Converts a string to PascalCase (UpperCamelCase).
 *
 * @param str - The input string to convert
 * @returns PascalCase string
 */
export function toPascalCase(str: string): string {
	const camel = toCamelCase(str);
	if (!camel) return '';
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}

// ============================================================================
// PHONE NUMBER UTILITIES
// ============================================================================

/**
 * Cleans and formats a phone number to E.164 format.
 * Uses regex-only approach without external libraries.
 *
 * E.164 format: +[country code][number] (max 15 digits total)
 * Example: +15550001111
 *
 * @param phone - The input phone number string
 * @param defaultCountryCode - Default country code if none detected (default: "1" for US)
 * @returns Formatted E.164 phone number or original if invalid
 */
export function cleanPhoneNumber(
	phone: string,
	defaultCountryCode: string = '1'
): string {
	if (!phone || typeof phone !== 'string') {
		return phone || '';
	}

	// Remove all non-numeric characters except leading +
	const hasPlus = phone.trim().startsWith('+');
	const digitsOnly = phone.replace(/\D/g, '');

	if (digitsOnly.length === 0) {
		return phone; // Return original if no digits found
	}

	// Validate: E.164 allows max 15 digits
	if (digitsOnly.length > 15) {
		return phone; // Return original if too long
	}

	let normalizedNumber = digitsOnly;

	// Check if number already has a country code
	if (hasPlus) {
		// Already has + prefix, trust the country code
		return `+${digitsOnly}`;
	}

	// Common patterns for detecting country codes
	// US/Canada: 10 digits without country code, 11 with leading 1
	if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
		// Likely US/Canada with country code
		return `+${digitsOnly}`;
	}

	if (digitsOnly.length === 10) {
		// Assume US/Canada format, add default country code
		return `+${defaultCountryCode}${digitsOnly}`;
	}

	// UK: 10-11 digits, often starts with 0 (national) or 44 (international)
	if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
		// UK national format, convert to international
		return `+44${digitsOnly.slice(1)}`;
	}

	if (digitsOnly.length === 12 && digitsOnly.startsWith('44')) {
		// UK international without +
		return `+${digitsOnly}`;
	}

	// For other formats, add default country code if number seems local
	if (digitsOnly.length >= 7 && digitsOnly.length <= 10) {
		return `+${defaultCountryCode}${digitsOnly}`;
	}

	// If we can't determine the format, prepend + to existing digits
	return `+${digitsOnly}`;
}

/**
 * Validates if a phone number appears to be in valid E.164 format.
 *
 * @param phone - The phone number to validate
 * @returns True if the phone number is valid E.164 format
 */
export function isValidE164(phone: string): boolean {
	// E.164 regex: + followed by 1-15 digits
	const e164Regex = /^\+[1-9]\d{1,14}$/;
	return e164Regex.test(phone);
}

// ============================================================================
// EMAIL UTILITIES
// ============================================================================

/**
 * Normalizes an email address:
 * - Trims whitespace
 * - Converts to lowercase
 * - Removes common typos in domain extensions
 *
 * @param email - The email address to normalize
 * @returns Normalized email address
 */
export function normalizeEmail(email: string): string {
	if (!email || typeof email !== 'string') {
		return email || '';
	}

	// Trim whitespace and convert to lowercase
	let normalized = email.trim().toLowerCase();

	// Basic validation: must contain @ and at least one character on each side
	const atIndex = normalized.indexOf('@');
	if (atIndex < 1 || atIndex === normalized.length - 1) {
		return normalized; // Return as-is if invalid structure
	}

	// Common domain typo corrections
	const domainCorrections: Record<string, string> = {
		'gmial.com': 'gmail.com',
		'gmal.com': 'gmail.com',
		'gamil.com': 'gmail.com',
		'gnail.com': 'gmail.com',
		'gmaill.com': 'gmail.com',
		'hotmal.com': 'hotmail.com',
		'hotmai.com': 'hotmail.com',
		'hotamil.com': 'hotmail.com',
		'yahooo.com': 'yahoo.com',
		'yaho.com': 'yahoo.com',
		'outloo.com': 'outlook.com',
		'outlok.com': 'outlook.com',
	};

	const domain = normalized.slice(atIndex + 1);
	const correctedDomain = domainCorrections[domain] || domain;

	return normalized.slice(0, atIndex + 1) + correctedDomain;
}

/**
 * Validates if a string looks like a valid email address.
 * Uses a practical regex that catches most invalid emails without being overly strict.
 *
 * @param email - The email to validate
 * @returns True if the email appears valid
 */
export function isValidEmail(email: string): boolean {
	if (!email || typeof email !== 'string') return false;

	// Practical email regex - not RFC 5322 compliant but catches most issues
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	return emailRegex.test(email.trim().toLowerCase());
}

// ============================================================================
// OBJECT KEY TRANSFORMATION UTILITIES
// ============================================================================

/**
 * Recursively transforms all keys in an object to the specified case format.
 * Handles nested objects and arrays.
 *
 * @param obj - The object to transform
 * @param caseType - The target case format ('snake_case' or 'camelCase')
 * @returns A new object with transformed keys
 */
export function transformObjectKeys(
	obj: unknown,
	caseType: 'snake_case' | 'camelCase'
): unknown {
	const transformer = caseType === 'snake_case' ? toSnakeCase : toCamelCase;

	// Handle null/undefined
	if (obj === null || obj === undefined) {
		return obj;
	}

	// Handle arrays - transform each element
	if (Array.isArray(obj)) {
		return obj.map((item) => transformObjectKeys(item, caseType));
	}

	// Handle Date objects - return as-is
	if (obj instanceof Date) {
		return obj;
	}

	// Handle plain objects
	if (typeof obj === 'object') {
		const result: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			const newKey = transformer(key);
			result[newKey] = transformObjectKeys(value, caseType);
		}

		return result;
	}

	// Primitive values - return as-is
	return obj;
}

// ============================================================================
// DEDUPLICATION UTILITIES
// ============================================================================

/**
 * Represents a comparison result for fuzzy deduplication.
 */
export interface DuplicateGroup {
	/** The index of the "master" record to keep */
	keepIndex: number;
	/** Indices of records identified as duplicates */
	duplicateIndices: number[];
	/** The similarity scores for each duplicate */
	similarityScores: number[];
}

/**
 * Identifies duplicate records in an array based on fuzzy matching of specified fields.
 *
 * @param items - Array of records to check for duplicates
 * @param fieldsToCheck - Array of field names to use for comparison
 * @param threshold - Similarity threshold (0.0 to 1.0), records above this are duplicates
 * @returns Array of duplicate groups, where each group contains the master and its duplicates
 */
export function findFuzzyDuplicates(
	items: Record<string, unknown>[],
	fieldsToCheck: string[],
	threshold: number = 0.8
): DuplicateGroup[] {
	const duplicateGroups: DuplicateGroup[] = [];
	const processedIndices = new Set<number>();

	for (let i = 0; i < items.length; i++) {
		// Skip if already marked as a duplicate
		if (processedIndices.has(i)) continue;

		const currentGroup: DuplicateGroup = {
			keepIndex: i,
			duplicateIndices: [],
			similarityScores: [],
		};

		for (let j = i + 1; j < items.length; j++) {
			// Skip if already processed
			if (processedIndices.has(j)) continue;

			// Calculate combined similarity across all fields
			let totalSimilarity = 0;
			let fieldCount = 0;

			for (const field of fieldsToCheck) {
				const value1 = String(items[i][field] ?? '');
				const value2 = String(items[j][field] ?? '');

				// Skip empty field comparisons
				if (!value1 && !value2) continue;

				totalSimilarity += fuzzyMatch(value1, value2);
				fieldCount++;
			}

			// Calculate average similarity across fields
			const averageSimilarity = fieldCount > 0 ? totalSimilarity / fieldCount : 0;

			// If above threshold, mark as duplicate
			if (averageSimilarity >= threshold) {
				currentGroup.duplicateIndices.push(j);
				currentGroup.similarityScores.push(averageSimilarity);
				processedIndices.add(j);
			}
		}

		// Only add groups that have duplicates
		if (currentGroup.duplicateIndices.length > 0) {
			duplicateGroups.push(currentGroup);
		}
	}

	return duplicateGroups;
}

/**
 * Removes fuzzy duplicate records from an array, keeping the first occurrence.
 *
 * @param items - Array of records to deduplicate
 * @param fieldsToCheck - Array of field names to use for comparison
 * @param threshold - Similarity threshold (0.0 to 1.0)
 * @returns Deduplicated array and metadata about removed items
 */
export function deduplicateFuzzy(
	items: Record<string, unknown>[],
	fieldsToCheck: string[],
	threshold: number = 0.8
): {
	deduplicated: Record<string, unknown>[];
	removedCount: number;
	duplicateGroups: DuplicateGroup[];
} {
	const duplicateGroups = findFuzzyDuplicates(items, fieldsToCheck, threshold);

	// Collect all indices to remove
	const indicesToRemove = new Set<number>();
	for (const group of duplicateGroups) {
		for (const dupIndex of group.duplicateIndices) {
			indicesToRemove.add(dupIndex);
		}
	}

	// Filter out duplicates
	const deduplicated = items.filter((_, index) => !indicesToRemove.has(index));

	return {
		deduplicated,
		removedCount: indicesToRemove.size,
		duplicateGroups,
	};
}

// ============================================================================
// UTILITY TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a string.
 */
export function isString(value: unknown): value is string {
	return typeof value === 'string';
}

/**
 * Safely gets a nested property from an object using dot notation.
 *
 * @param obj - The object to get the property from
 * @param path - Dot-notation path (e.g., "user.name.first")
 * @returns The value at the path, or undefined if not found
 */
export function getNestedProperty(obj: unknown, path: string): unknown {
	if (!isObject(obj) || !path) return undefined;

	const parts = path.split('.');
	let current: unknown = obj;

	for (const part of parts) {
		if (!isObject(current)) return undefined;
		current = current[part];
	}

	return current;
}

/**
 * Safely sets a nested property in an object using dot notation.
 *
 * @param obj - The object to set the property in
 * @param path - Dot-notation path (e.g., "user.name.first")
 * @param value - The value to set
 * @returns The modified object
 */
export function setNestedProperty(
	obj: Record<string, unknown>,
	path: string,
	value: unknown
): Record<string, unknown> {
	if (!path) return obj;

	const parts = path.split('.');
	let current: Record<string, unknown> = obj;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (!isObject(current[part])) {
			current[part] = {};
		}
		current = current[part] as Record<string, unknown>;
	}

	current[parts[parts.length - 1]] = value;
	return obj;
}

// ============================================================================
// NAME PARSING UTILITIES
// ============================================================================

/**
 * Parsed name result with all components
 */
export interface ParsedName {
	/** Full original name */
	full: string;
	/** First name / given name */
	firstName: string;
	/** Middle name(s) if present */
	middleName: string;
	/** Last name / surname / family name */
	lastName: string;
	/** Name prefix (Mr., Mrs., Dr., etc.) */
	prefix: string;
	/** Name suffix (Jr., Sr., III, PhD, etc.) */
	suffix: string;
	/** Initials (e.g., "J.D.S.") */
	initials: string;
}

/**
 * Common name prefixes (titles)
 */
const NAME_PREFIXES = new Set([
	'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor',
	'rev', 'reverend', 'fr', 'father', 'sr', 'sister',
	'hon', 'honorable', 'judge', 'justice',
	'sir', 'dame', 'lord', 'lady', 'capt', 'captain',
	'col', 'colonel', 'gen', 'general', 'lt', 'lieutenant',
	'sgt', 'sergeant', 'cpl', 'corporal', 'pvt', 'private',
	'adm', 'admiral', 'cmdr', 'commander', 'maj', 'major',
]);

/**
 * Common name suffixes
 */
const NAME_SUFFIXES = new Set([
	'jr', 'sr', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
	'phd', 'md', 'dds', 'dvm', 'jd', 'esq', 'esquire',
	'cpa', 'rn', 'rph', 'pe', 'ra', 'aia', 'faia',
	'ret', 'retired', 'usn', 'usmc', 'usaf', 'usa',
]);

/**
 * Parses a full name string into its component parts.
 * Handles various formats: "John Doe", "Dr. John Smith Jr.", "Smith, John", etc.
 *
 * @param fullName - The full name string to parse
 * @returns ParsedName object with all components
 */
export function parseName(fullName: string): ParsedName {
	const result: ParsedName = {
		full: '',
		firstName: '',
		middleName: '',
		lastName: '',
		prefix: '',
		suffix: '',
		initials: '',
	};

	if (!fullName || typeof fullName !== 'string') {
		return result;
	}

	// Clean and normalize the input
	let name = fullName.trim().replace(/\s+/g, ' ');
	result.full = name;

	// Handle "Last, First Middle" format
	if (name.includes(',')) {
		const [lastPart, ...rest] = name.split(',').map(s => s.trim());
		if (rest.length > 0) {
			name = rest.join(' ') + ' ' + lastPart;
		}
	}

	// Split into parts
	const parts = name.split(' ').filter(p => p.length > 0);

	if (parts.length === 0) {
		return result;
	}

	// Extract prefix
	if (parts.length > 1) {
		const firstPart = parts[0].toLowerCase().replace(/\./g, '');
		if (NAME_PREFIXES.has(firstPart)) {
			result.prefix = parts.shift() || '';
		}
	}

	// Extract suffix(es)
	const suffixes: string[] = [];
	while (parts.length > 1) {
		const lastPart = parts[parts.length - 1].toLowerCase().replace(/\./g, '').replace(/,/g, '');
		if (NAME_SUFFIXES.has(lastPart)) {
			suffixes.unshift(parts.pop() || '');
		} else {
			break;
		}
	}
	result.suffix = suffixes.join(' ');

	// Assign remaining parts
	if (parts.length === 1) {
		// Only one name part - treat as first name
		result.firstName = parts[0];
	} else if (parts.length === 2) {
		// Two parts - first and last name
		result.firstName = parts[0];
		result.lastName = parts[1];
	} else if (parts.length >= 3) {
		// Three or more parts - first, middle(s), last
		result.firstName = parts[0];
		result.lastName = parts[parts.length - 1];
		result.middleName = parts.slice(1, -1).join(' ');
	}

	// Generate initials
	const initialParts = [result.firstName, result.middleName, result.lastName]
		.filter(p => p.length > 0)
		.map(p => p.charAt(0).toUpperCase());
	result.initials = initialParts.join('.') + (initialParts.length > 0 ? '.' : '');

	return result;
}

/**
 * Parses a username into likely name components.
 * Handles formats like: john_doe, john.doe, johndoe, JohnDoe
 *
 * @param username - The username to parse
 * @returns ParsedName object with best-effort name extraction
 */
export function parseUsername(username: string): ParsedName {
	const result: ParsedName = {
		full: username || '',
		firstName: '',
		middleName: '',
		lastName: '',
		prefix: '',
		suffix: '',
		initials: '',
	};

	if (!username || typeof username !== 'string') {
		return result;
	}

	// Remove common prefixes/suffixes in usernames
	let cleaned = username
		.replace(/^[@#]/g, '') // Remove @ or # prefix
		.replace(/[0-9]+$/g, ''); // Remove trailing numbers

	// Split by common separators
	let parts: string[] = [];

	if (cleaned.includes('_') || cleaned.includes('.') || cleaned.includes('-')) {
		// Separator-based username (john_doe, john.doe, john-doe)
		parts = cleaned.split(/[_.\-]+/).filter(p => p.length > 0);
	} else {
		// CamelCase or concatenated (JohnDoe, johndoe)
		// Try to split on case changes
		const camelParts = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
		if (camelParts.length > 1) {
			parts = camelParts;
		} else {
			// Single word - can't reliably split
			parts = [cleaned];
		}
	}

	// Apply title case and assign
	parts = parts.map(p => toTitleCase(p));

	if (parts.length === 1) {
		result.firstName = parts[0];
	} else if (parts.length === 2) {
		result.firstName = parts[0];
		result.lastName = parts[1];
	} else if (parts.length >= 3) {
		result.firstName = parts[0];
		result.lastName = parts[parts.length - 1];
		result.middleName = parts.slice(1, -1).join(' ');
	}

	// Build full name
	result.full = [result.firstName, result.middleName, result.lastName]
		.filter(p => p.length > 0)
		.join(' ');

	// Generate initials
	const initialParts = [result.firstName, result.middleName, result.lastName]
		.filter(p => p.length > 0)
		.map(p => p.charAt(0).toUpperCase());
	result.initials = initialParts.join('.') + (initialParts.length > 0 ? '.' : '');

	return result;
}

// ============================================================================
// PHONE NUMBER PARSING UTILITIES
// ============================================================================

/**
 * Parsed phone number result with all components
 */
export interface ParsedPhoneNumber {
	/** Original input */
	original: string;
	/** E.164 formatted number (+15550001234) */
	e164: string;
	/** National format ((555) 000-1234) */
	national: string;
	/** International format (+1 555 000 1234) */
	international: string;
	/** Country code (1, 44, etc.) */
	countryCode: string;
	/** Area/region code */
	areaCode: string;
	/** Local number without area code */
	localNumber: string;
	/** Extension if present */
	extension: string;
	/** Whether the number appears valid */
	isValid: boolean;
}

/**
 * Parses a phone number into its component parts with multiple format outputs.
 *
 * @param phone - The phone number to parse
 * @param defaultCountryCode - Default country code if not detected
 * @returns ParsedPhoneNumber with all components and formats
 */
export function parsePhoneNumber(
	phone: string,
	defaultCountryCode: string = '1'
): ParsedPhoneNumber {
	const result: ParsedPhoneNumber = {
		original: phone || '',
		e164: '',
		national: '',
		international: '',
		countryCode: '',
		areaCode: '',
		localNumber: '',
		extension: '',
		isValid: false,
	};

	if (!phone || typeof phone !== 'string') {
		return result;
	}

	// Extract extension if present
	const extMatch = phone.match(/(?:ext\.?|x|extension)\s*(\d+)/i);
	if (extMatch) {
		result.extension = extMatch[1];
		phone = phone.replace(extMatch[0], '').trim();
	}

	// Clean phone number
	const hasPlus = phone.trim().startsWith('+');
	const digitsOnly = phone.replace(/\D/g, '');

	if (digitsOnly.length < 7 || digitsOnly.length > 15) {
		return result;
	}

	let countryCode = defaultCountryCode;
	let nationalNumber = digitsOnly;

	// Detect country code
	if (hasPlus) {
		// Has + prefix, extract country code
		// Common country codes: 1 (US/CA), 44 (UK), 91 (India), 86 (China), 49 (Germany)
		if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
			countryCode = '1';
			nationalNumber = digitsOnly.slice(1);
		} else if (digitsOnly.startsWith('44') && digitsOnly.length >= 12) {
			countryCode = '44';
			nationalNumber = digitsOnly.slice(2);
		} else if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
			countryCode = '91';
			nationalNumber = digitsOnly.slice(2);
		} else if (digitsOnly.startsWith('86') && digitsOnly.length === 13) {
			countryCode = '86';
			nationalNumber = digitsOnly.slice(2);
		} else if (digitsOnly.startsWith('49') && digitsOnly.length >= 11) {
			countryCode = '49';
			nationalNumber = digitsOnly.slice(2);
		} else {
			// Assume first 1-3 digits are country code
			if (digitsOnly.length > 10) {
				const ccLength = digitsOnly.length - 10;
				countryCode = digitsOnly.slice(0, Math.min(ccLength, 3));
				nationalNumber = digitsOnly.slice(Math.min(ccLength, 3));
			}
		}
	} else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
		// US/Canada with country code
		countryCode = '1';
		nationalNumber = digitsOnly.slice(1);
	} else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
		// UK national format (0XXXXXXXXXX)
		countryCode = '44';
		nationalNumber = digitsOnly.slice(1);
	}

	result.countryCode = countryCode;

	// Extract area code and local number (assuming 10-digit format for simplicity)
	if (nationalNumber.length >= 10) {
		result.areaCode = nationalNumber.slice(0, 3);
		result.localNumber = nationalNumber.slice(3);
	} else if (nationalNumber.length >= 7) {
		result.localNumber = nationalNumber;
	}

	// Build formatted outputs
	result.e164 = `+${countryCode}${nationalNumber}`;

	// National format (US style: (XXX) XXX-XXXX)
	if (nationalNumber.length === 10) {
		result.national = `(${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`;
	} else if (nationalNumber.length === 7) {
		result.national = `${nationalNumber.slice(0, 3)}-${nationalNumber.slice(3)}`;
	} else {
		result.national = nationalNumber;
	}

	// International format (+X XXX XXX XXXX)
	if (nationalNumber.length === 10) {
		result.international = `+${countryCode} ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
	} else {
		result.international = `+${countryCode} ${nationalNumber}`;
	}

	// Add extension to formats if present
	if (result.extension) {
		result.national += ` ext. ${result.extension}`;
		result.international += ` ext. ${result.extension}`;
	}

	result.isValid = isValidE164(result.e164);

	return result;
}

// ============================================================================
// TEXT EXTRACTION & FORMATTING UTILITIES
// ============================================================================

/**
 * Result of extracting structured data from text
 */
export interface ExtractedData {
	/** All email addresses found */
	emails: string[];
	/** All phone numbers found */
	phones: string[];
	/** All URLs found */
	urls: string[];
	/** All dates found (various formats) */
	dates: string[];
	/** All monetary amounts found */
	amounts: string[];
	/** All hashtags found */
	hashtags: string[];
	/** All mentions (@username) found */
	mentions: string[];
	/** All numbers found */
	numbers: string[];
}

/**
 * Extracts structured data from plain text.
 * Finds emails, phone numbers, URLs, dates, amounts, hashtags, mentions, and numbers.
 *
 * @param text - The text to extract data from
 * @returns ExtractedData with all found items
 */
export function extractFromText(text: string): ExtractedData {
	const result: ExtractedData = {
		emails: [],
		phones: [],
		urls: [],
		dates: [],
		amounts: [],
		hashtags: [],
		mentions: [],
		numbers: [],
	};

	if (!text || typeof text !== 'string') {
		return result;
	}

	// Extract emails
	const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
	result.emails = [...new Set(text.match(emailRegex) || [])];

	// Extract phone numbers (various formats)
	const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}(?:\s*(?:ext\.?|x)\s*\d+)?/gi;
	const phoneMatches = text.match(phoneRegex) || [];
	result.phones = [...new Set(phoneMatches.map(p => p.trim()).filter(p => p.replace(/\D/g, '').length >= 7))];

	// Extract URLs
	const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
	result.urls = [...new Set(text.match(urlRegex) || [])];

	// Extract dates (various formats)
	const datePatterns = [
		/\d{1,2}\/\d{1,2}\/\d{2,4}/g,                    // MM/DD/YYYY or DD/MM/YYYY
		/\d{4}-\d{2}-\d{2}/g,                             // YYYY-MM-DD
		/\d{1,2}-\d{1,2}-\d{2,4}/g,                       // DD-MM-YYYY
		/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}/gi,  // Month DD, YYYY
		/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}/gi,     // DD Month YYYY
	];
	const allDates: string[] = [];
	for (const pattern of datePatterns) {
		const matches = text.match(pattern) || [];
		allDates.push(...matches);
	}
	result.dates = [...new Set(allDates)];

	// Extract monetary amounts
	const amountRegex = /(?:\$|€|£|¥|₹|USD|EUR|GBP)\s*[\d,]+(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|euros?|pounds?)/gi;
	result.amounts = [...new Set(text.match(amountRegex) || [])];

	// Extract hashtags
	const hashtagRegex = /#[a-zA-Z][a-zA-Z0-9_]*/g;
	result.hashtags = [...new Set(text.match(hashtagRegex) || [])];

	// Extract mentions
	const mentionRegex = /@[a-zA-Z][a-zA-Z0-9_]*/g;
	result.mentions = [...new Set(text.match(mentionRegex) || [])];

	// Extract standalone numbers
	const numberRegex = /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g;
	const numberMatches = text.match(numberRegex) || [];
	// Filter out numbers that are part of other patterns (dates, phones, etc.)
	result.numbers = [...new Set(numberMatches.filter(n => {
		// Skip if it looks like part of a date or phone
		return n.length <= 10 && !n.includes('/') && !n.includes('-');
	}))];

	return result;
}

/**
 * Options for text formatting
 */
export interface FormatTextOptions {
	/** Remove extra whitespace */
	trimWhitespace?: boolean;
	/** Remove line breaks */
	removeLineBreaks?: boolean;
	/** Convert to specific case */
	caseType?: 'lower' | 'upper' | 'title' | 'sentence' | null;
	/** Remove special characters */
	removeSpecialChars?: boolean;
	/** Remove numbers */
	removeNumbers?: boolean;
	/** Remove punctuation */
	removePunctuation?: boolean;
	/** Truncate to max length */
	maxLength?: number;
	/** Custom character to use for truncation indicator */
	truncationIndicator?: string;
}

/**
 * Formats text according to specified options.
 *
 * @param text - The text to format
 * @param options - Formatting options
 * @returns Formatted text
 */
export function formatText(text: string, options: FormatTextOptions = {}): string {
	if (!text || typeof text !== 'string') {
		return text || '';
	}

	let result = text;

	// Remove line breaks if requested
	if (options.removeLineBreaks) {
		result = result.replace(/[\r\n]+/g, ' ');
	}

	// Trim whitespace if requested
	if (options.trimWhitespace !== false) {
		result = result.replace(/\s+/g, ' ').trim();
	}

	// Remove special characters if requested
	if (options.removeSpecialChars) {
		result = result.replace(/[^a-zA-Z0-9\s]/g, '');
	}

	// Remove numbers if requested
	if (options.removeNumbers) {
		result = result.replace(/\d/g, '');
	}

	// Remove punctuation if requested
	if (options.removePunctuation) {
		result = result.replace(/[.,!?;:'"()\[\]{}]/g, '');
	}

	// Apply case conversion
	if (options.caseType) {
		switch (options.caseType) {
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
		}
	}

	// Truncate if needed
	if (options.maxLength && result.length > options.maxLength) {
		const indicator = options.truncationIndicator ?? '...';
		result = result.slice(0, options.maxLength - indicator.length) + indicator;
	}

	return result;
}

/**
 * Converts text to sentence case (first letter of each sentence capitalized).
 *
 * @param text - The text to convert
 * @returns Sentence-cased text
 */
export function toSentenceCase(text: string): string {
	if (!text) return '';

	return text
		.toLowerCase()
		.replace(/(^\s*\w|[.!?]\s+\w)/g, match => match.toUpperCase());
}

// ============================================================================
// ADDRESS PARSING UTILITIES
// ============================================================================

/**
 * Parsed address components
 */
export interface ParsedAddress {
	/** Original input */
	original: string;
	/** Street number */
	streetNumber: string;
	/** Street name */
	streetName: string;
	/** Unit/apartment number */
	unit: string;
	/** City name */
	city: string;
	/** State/province */
	state: string;
	/** Postal/ZIP code */
	postalCode: string;
	/** Country */
	country: string;
	/** Full street address line */
	streetAddress: string;
}

/**
 * US state abbreviations
 */
const US_STATES: Record<string, string> = {
	'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
	'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
	'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
	'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
	'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
	'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
	'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
	'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
	'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
	'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
	'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
	'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
	'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
};

/**
 * Reverse lookup for state abbreviations
 */
const STATE_ABBREVS = new Set(Object.values(US_STATES));

/**
 * Parses a US/Canadian address into components.
 * Best-effort parsing - may not be 100% accurate for all formats.
 *
 * @param address - The address string to parse
 * @returns ParsedAddress with extracted components
 */
export function parseAddress(address: string): ParsedAddress {
	const result: ParsedAddress = {
		original: address || '',
		streetNumber: '',
		streetName: '',
		unit: '',
		city: '',
		state: '',
		postalCode: '',
		country: '',
		streetAddress: '',
	};

	if (!address || typeof address !== 'string') {
		return result;
	}

	// Normalize the address
	let normalized = address.trim().replace(/\s+/g, ' ');

	// Extract postal/ZIP code
	const usZipMatch = normalized.match(/\b(\d{5}(?:-\d{4})?)\b/);
	const caPostalMatch = normalized.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i);

	if (usZipMatch) {
		result.postalCode = usZipMatch[1];
		result.country = 'USA';
		normalized = normalized.replace(usZipMatch[0], '').trim();
	} else if (caPostalMatch) {
		result.postalCode = caPostalMatch[1].toUpperCase().replace(/\s/g, ' ');
		result.country = 'Canada';
		normalized = normalized.replace(caPostalMatch[0], '').trim();
	}

	// Remove common country names
	normalized = normalized.replace(/\b(USA|United States|US|Canada|CA)\b/gi, '').trim();

	// Split by comma to get address parts
	const parts = normalized.split(',').map(p => p.trim()).filter(p => p.length > 0);

	if (parts.length >= 1) {
		// First part is usually street address
		const streetPart = parts[0];

		// Extract unit/apartment
		const unitMatch = streetPart.match(/(?:apt\.?|apartment|unit|suite|ste\.?|#)\s*([a-z0-9-]+)/i);
		if (unitMatch) {
			result.unit = unitMatch[1];
		}

		// Extract street number and name
		const streetMatch = streetPart.match(/^(\d+(?:-\d+)?[a-z]?)\s+(.+?)(?:\s+(?:apt\.?|apartment|unit|suite|ste\.?|#).*)?$/i);
		if (streetMatch) {
			result.streetNumber = streetMatch[1];
			result.streetName = streetMatch[2].replace(/,.*$/, '').trim();
		} else {
			result.streetName = streetPart.replace(/,.*$/, '').trim();
		}

		result.streetAddress = result.streetNumber
			? `${result.streetNumber} ${result.streetName}`
			: result.streetName;

		if (result.unit) {
			result.streetAddress += ` #${result.unit}`;
		}
	}

	if (parts.length >= 2) {
		// Second part is usually city
		result.city = parts[1];
	}

	if (parts.length >= 3) {
		// Third part is usually state
		const statePart = parts[2].trim();
		const stateUpper = statePart.toUpperCase();

		if (STATE_ABBREVS.has(stateUpper)) {
			result.state = stateUpper;
		} else {
			const stateLower = statePart.toLowerCase();
			result.state = US_STATES[stateLower] || statePart;
		}
	}

	// Try to extract state from city part if not found
	if (!result.state && result.city) {
		const cityStateParts = result.city.split(/\s+/);
		if (cityStateParts.length >= 2) {
			const lastPart = cityStateParts[cityStateParts.length - 1].toUpperCase();
			if (STATE_ABBREVS.has(lastPart)) {
				result.state = lastPart;
				result.city = cityStateParts.slice(0, -1).join(' ');
			}
		}
	}

	return result;
}

// ============================================================================
// STRING SPLITTING UTILITIES
// ============================================================================

/**
 * Splits a string into parts using multiple delimiters.
 *
 * @param text - The text to split
 * @param delimiters - Array of delimiter strings or regex patterns
 * @param trimParts - Whether to trim each part (default: true)
 * @returns Array of split parts
 */
export function splitMultiple(
	text: string,
	delimiters: string[] = [',', ';', '|', '\t', '\n'],
	trimParts: boolean = true
): string[] {
	if (!text || typeof text !== 'string') {
		return [];
	}

	// Create regex from delimiters
	const escapedDelimiters = delimiters.map(d =>
		d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	);
	const regex = new RegExp(escapedDelimiters.join('|'), 'g');

	const parts = text.split(regex);

	if (trimParts) {
		return parts.map(p => p.trim()).filter(p => p.length > 0);
	}

	return parts;
}

/**
 * Splits text into key-value pairs.
 * Handles formats like "key: value", "key = value", "key -> value"
 *
 * @param text - The text containing key-value pairs
 * @param pairDelimiter - Delimiter between pairs (default: newline or semicolon)
 * @param kvDelimiter - Delimiter between key and value (default: colon, equals, or arrow)
 * @returns Object with extracted key-value pairs
 */
export function splitKeyValue(
	text: string,
	pairDelimiter?: string,
	kvDelimiter?: string
): Record<string, string> {
	const result: Record<string, string> = {};

	if (!text || typeof text !== 'string') {
		return result;
	}

	// Split into pairs
	const pairRegex = pairDelimiter
		? new RegExp(pairDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		: /[\n;]/;
	const pairs = text.split(pairRegex);

	// Extract key-value from each pair
	const kvRegex = kvDelimiter
		? new RegExp(kvDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		: /[:=]|->|=>/;

	for (const pair of pairs) {
		const trimmed = pair.trim();
		if (!trimmed) continue;

		const kvMatch = trimmed.split(kvRegex);
		if (kvMatch.length >= 2) {
			const key = kvMatch[0].trim();
			const value = kvMatch.slice(1).join(':').trim(); // Rejoin in case value contains delimiter
			if (key) {
				result[key] = value;
			}
		}
	}

	return result;
}

// ============================================================================
// DATA TYPE CONVERSION UTILITIES
// ============================================================================

/**
 * Converts a string to a boolean value.
 * Handles various representations: "true", "yes", "1", "on", etc.
 *
 * @param value - The value to convert
 * @param defaultValue - Default if conversion fails (default: false)
 * @returns Boolean value
 */
export function toBoolean(value: unknown, defaultValue: boolean = false): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;

	if (typeof value === 'string') {
		const lower = value.toLowerCase().trim();
		if (['true', 'yes', '1', 'on', 'enabled', 'active', 'y'].includes(lower)) {
			return true;
		}
		if (['false', 'no', '0', 'off', 'disabled', 'inactive', 'n'].includes(lower)) {
			return false;
		}
	}

	return defaultValue;
}

/**
 * Converts a string to a number.
 * Handles various formats: "1,234.56", "$1,234", "1.234,56" (European), etc.
 *
 * @param value - The value to convert
 * @param defaultValue - Default if conversion fails (default: 0)
 * @returns Numeric value
 */
export function toNumber(value: unknown, defaultValue: number = 0): number {
	if (typeof value === 'number') return value;

	if (typeof value === 'string') {
		// Remove currency symbols and whitespace
		let cleaned = value.replace(/[$€£¥₹\s]/g, '');

		// Handle European format (1.234,56) vs US format (1,234.56)
		const hasCommaDecimal = /,\d{1,2}$/.test(cleaned);
		const hasDotThousands = /\.\d{3}/.test(cleaned);

		if (hasCommaDecimal && hasDotThousands) {
			// European format: 1.234,56
			cleaned = cleaned.replace(/\./g, '').replace(',', '.');
		} else {
			// US format or simple: 1,234.56 or 1234.56
			cleaned = cleaned.replace(/,/g, '');
		}

		const num = parseFloat(cleaned);
		return isNaN(num) ? defaultValue : num;
	}

	return defaultValue;
}

/**
 * Converts a value to a trimmed string.
 *
 * @param value - The value to convert
 * @param defaultValue - Default if conversion fails (default: '')
 * @returns String value
 */
export function toString(value: unknown, defaultValue: string = ''): string {
	if (value === null || value === undefined) return defaultValue;
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'object') {
		try {
			return JSON.stringify(value);
		} catch {
			return defaultValue;
		}
	}
	return String(value);
}
