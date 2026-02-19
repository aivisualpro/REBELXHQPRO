/**
 * Fuzzy Tokenized Search Utility for MongoDB Queries
 * 
 * Splits search input into individual words, matches each independently (any order),
 * with prefix-trimming for typo tolerance. Returns a MongoDB query condition.
 *
 * Example: "powder green 100g" matches "Green Maeng Da/7 100gm Powder"
 * Example: "relex 8ct" matches "Relax Blend Kratom Capsules - 8ct" (fuzzy prefix)
 */

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a fuzzy MongoDB query for the given search string across the specified fields.
 * Each word in the search must match at least one of the fields.
 * Supports typo tolerance via prefix trimming (drops 1-2 trailing chars for longer tokens).
 *
 * @param search - The raw search string from the user
 * @param fields - Array of MongoDB field paths to search across (e.g. ['name', '_id', 'email'])
 * @returns A MongoDB query condition to spread into your query object, or null if no search
 */
export function buildFuzzySearchQuery(search: string, fields: string[]): Record<string, any> | null {
    if (!search || !search.trim()) return null;

    const tokens = search.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;

    const andConditions = tokens.map(token => {
        const escaped = escapeRegex(token);
        const patterns: string[] = [escaped];

        // Drop trailing chars for typo tolerance
        if (token.length >= 4) patterns.push(escaped.slice(0, -1));
        if (token.length >= 6) patterns.push(escaped.slice(0, -2));

        const fuzzyPattern = [...new Set(patterns)].join('|');

        return {
            $or: fields.map(field => ({
                [field]: { $regex: fuzzyPattern, $options: 'i' }
            }))
        };
    });

    return { $and: andConditions };
}

/**
 * Build a single fuzzy regex pattern string from a search query.
 * Useful for secondary lookups (e.g. finding matching SKUs/Clients by name).
 * Combines all tokens with fuzzy prefixes into one alternation pattern.
 *
 * @param search - The raw search string
 * @returns A regex pattern string suitable for MongoDB { $regex: pattern, $options: 'i' }
 */
export function buildFuzzyRegex(search: string): string {
    if (!search || !search.trim()) return '';

    const tokens = search.trim().split(/\s+/).filter(Boolean);
    const allPatterns: string[] = [];

    tokens.forEach(token => {
        const escaped = escapeRegex(token);
        allPatterns.push(escaped);
        if (token.length >= 4) allPatterns.push(escaped.slice(0, -1));
        if (token.length >= 6) allPatterns.push(escaped.slice(0, -2));
    });

    return [...new Set(allPatterns)].join('|');
}
