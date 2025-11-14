
/**
 * @file inputSanitization.ts
 * @description Utility functions for sanitizing and validating user inputs from Discord slash commands.
 */

/**
 * Sanitizes a string input by trimming whitespace and optionally removing extra internal spaces.
 * @param input The string to sanitize.
 * @param removeExtraSpaces If true, replaces multiple internal spaces with a single space. Defaults to false.
 * @returns The sanitized string.
 */
export function sanitizeString(input: string | null | undefined, removeExtraSpaces: boolean = false): string | null {
  if (input === null || input === undefined) {
    return null;
  }
  let sanitized = input.trim();
  if (removeExtraSpaces) {
    sanitized = sanitized.replace(/\s+/g, ' ');
  }
  return sanitized === '' ? null : sanitized;
}

/**
 * Sanitizes and validates a number input.
 * @param input The number or string to sanitize and validate.
 * @param min Optional minimum allowed value.
 * @param max Optional maximum allowed value.
 * @returns The sanitized number, or null if invalid.
 */
export function sanitizeNumber(input: string | number | null | undefined, min?: number, max?: number): number | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  let num: number;
  if (typeof input === 'string') {
    num = parseFloat(input);
  } else {
    num = input;
  }

  if (isNaN(num)) {
    return null;
  }

  if (min !== undefined && num < min) {
    return null;
  }
  if (max !== undefined && num > max) {
    return null;
  }

  return num;
}

/**
 * Sanitizes and validates a boolean input.
 * @param input The boolean or string to sanitize and validate.
 * @returns The sanitized boolean, or null if invalid.
 */
export function sanitizeBoolean(input: string | boolean | null | undefined): boolean | null {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input === 'boolean') {
    return input;
  }
  const lowerInput = input.toLowerCase().trim();
  if (lowerInput === 'true' || lowerInput === '1') {
    return true;
  }
  if (lowerInput === 'false' || lowerInput === '0') {
    return false;
  }
  return null;
}

/**
 * Sanitizes and validates a Discord ID (string of digits).
 * @param input The string to sanitize and validate as a Discord ID.
 * @returns The sanitized Discord ID, or null if invalid.
 */
export function sanitizeDiscordId(input: string | null | undefined): string | null {
  if (input === null || input === undefined) {
    return null;
  }
  const sanitized = input.trim();
  if (!/^\d{17,19}$/.test(sanitized)) { // Discord IDs are typically 17-19 digits
    return null;
  }
  return sanitized;
}
