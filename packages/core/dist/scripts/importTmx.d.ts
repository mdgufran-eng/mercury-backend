/**
 * Load a TMX file into MongoDB Translation Memory.
 *
 * Usage:
 *   node dist/scripts/importTmx.js <path-to-tmx> <srcLang> <tgtLang>
 *   node dist/scripts/importTmx.js ~/Desktop/Headout_Human-en_US-fr_FR.tmx en fr
 *
 * Strategy for inconsistencies (same EN → multiple FR):
 *   Pick the most frequent translation.
 */
export {};
