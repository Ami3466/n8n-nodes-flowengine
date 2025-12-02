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
