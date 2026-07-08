# Language Detection Fallback Removal Documentation

## Overview

This document documents all silent fallbacks that were removed from the LinguaLens language detection pipeline as part of the bug fix to eliminate false "same-language" matches and improve detection accuracy for short text and non-Latin scripts.

## Silent Fallbacks Removed

### 1. Silent English Fallback in `src/lib/api/translation.ts` (Line 1062)

**Location:** `src/lib/api/translation.ts`, line 1062 (original)

**Previous Behavior:**
```typescript
sourceParam = toMyMemoryLang(pageLang || 'en'); // Use page lang or 'en' as fallback, but don't block
```

**Issue:** When language detection was uncertain (null or low confidence), the code would silently fall back to `'en'` as the source language. This caused Arabic, Hindi, and other non-Latin text to be treated as English, leading to false "same-language" matches when the target was also English.

**New Behavior:**
```typescript
if (isValidPageLang && pageLang !== target) {
  logger.debug('fallback', { type: 'page-language', pageLang });
  sourceParam = toMyMemoryLang(pageLang);
  detectedSource = pageLang;
} else {
  logger.debug('fallback', { type: 'api-auto-detect', reason: 'low-confidence' });
  sourceParam = toMyMemoryLang(target === 'en' ? 'es' : 'en');
  detectedSource = null;
}
```

**Why This Fix Works:**
- Only uses page language hint if it's valid (2-letter code) AND differs from target
- If no valid page language, sends a placeholder source to MyMemory API to let it handle auto-detection
- Marks detection as uncertain (`detectedSource = null`) so the UI can surface this to the user
- Every fallback decision is logged with structured data for debugging

**Impact:** Eliminates false positives where Arabic/Hindi text was incorrectly identified as English.

---

## New Detection Pipeline

The language detection now follows a strict priority order with no silent fallbacks:

### Step 1: Script-Based Heuristics (Unicode Ranges)

**Trigger:** First character of text

**Scripts Detected:**
- Arabic (U+0600–U+06FF) → `ar`
- Devanagari/Hindi (U+0900–U+097F) → `hi`
- CJK (U+4E00–U+9FFF) → `zh`
- Hangul/Korean (U+AC00–U+D7AF) → `ko`
- Cyrillic (U+0400–U+04FF) → `ru`
- Greek (U+0370–U+03FF) → `el`
- Thai (U+0E00–U+0E7F) → `th`
- Hebrew (U+0590–U+05FF) → `he`
- Latin → Falls through to statistical detection

**Confidence:** 0.95 (very high)

**Advantage:** Works even for single characters - no minimum length requirement.

### Step 2: Dictionary Lookup

**Trigger:** Text length < 15 characters

**Method:** Exact match against `COMMON_WORDS` dictionary

**Languages Covered:** Spanish, French, German, Italian, Portuguese, Hindi

**Confidence:** 1.0 (exact match)

**Advantage:** More reliable than statistical detection for short common words.

### Step 3: Length Check

**Trigger:** Text length < 4 characters

**Behavior:** Returns `null` (uncertain) - no fallback

**Reason:** Statistical detection unreliable below 4 characters.

### Step 4: Statistical Detection (franc)

**Trigger:** Text length ≥ 4 characters

**Method:** n-gram based language detection via `franc` library

**Confidence:** Variable (0.5 to 0.9 based on text length)

**Formula:** `Math.min(0.9, 0.5 + (textLength / 20) * 0.4)`

**Advantage:** Reliable for longer text (20+ characters).

### Step 5: Fallback Handling

**When Detection is Uncertain (null or confidence < 0.5):**

1. **Try page language hint** (if valid 2-letter code and differs from target)
   - Logged as: `fallback: { type: 'page-language', pageLang }`
   
2. **Otherwise, let API handle auto-detection**
   - Send placeholder source to MyMemory (different from target to avoid 403)
   - Mark as uncertain: `detectedSource = null`
   - Logged as: `fallback: { type: 'api-auto-detect', reason: 'low-confidence' }`

**No Silent English Fallback:** The code never defaults to `'en'` without logging the reason.

---

## Configuration Constants

New configurable constants in `src/lib/api/translation.ts`:

```typescript
export const MIN_RELIABLE_DETECTION_LENGTH = 20;  // Minimum length for high-confidence franc detection
export const MIN_DICTIONARY_LOOKUP_LENGTH = 15;   // Maximum length for dictionary lookup priority
export const MIN_FRANC_DETECTION_LENGTH = 4;      // Minimum length to attempt franc detection
```

These replace hardcoded magic numbers and make thresholds configurable.

---

## Same-Language Detection Improvements

### Pre-API Check

**Previous:** Simple string comparison of source and target language codes.

**New:** Only applies when detection is CONFIDENT (`detectedSource !== null` for auto-detect).

**Reason:** Avoids blocking API calls when detection is uncertain.

### Post-API Check

**Previous:** Case-insensitive string comparison of original and translated text.

**New:** Normalized comparison that:
- Removes punctuation and symbols (Unicode property escapes)
- Normalizes whitespace
- Case-folds
- Only triggers when text length ≥ 20 characters OR explicit same-language selection

**Function:**
```typescript
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\p{P}\p{S}]/gu, '') // Remove punctuation and symbols
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
```

**Advantage:** Avoids false negatives from punctuation differences.

---

## Structured Logging

All detection and translation events now emit structured logs:

### Log Categories

- `script-heuristic`: Script-based detection results
- `dictionary-lookup`: Dictionary match results
- `detection`: General detection status
- `franc`: Statistical detection results
- `detection-result`: Final detection result with confidence
- `fallback`: Fallback decisions (page language or API auto-detect)
- `client-detection`: Client-side detection before API call
- `pre-api-check`: Pre-API same-language check
- `api-call`: API call parameters
- `api-response`: API response data
- `post-api-check`: Post-API same-language check
- `same-language`: Same-language flag triggers
- `final-result`: Final translation result

### Log Buffer

- In-memory buffer stores last 50 events
- Accessible via `getLogBuffer()`, `clearLogBuffer()`, `exportLogs()`
- Exportable as JSON for debugging
- Gated behind `debugMode` flag in chrome.storage

### Debug Mode

```typescript
// Enable debug mode
await setDebugMode(true);

// Check debug mode status
const enabled = await getDebugMode();
```

In production, only error and warn logs are output unless debug mode is enabled.

---

## Testing

Unit tests added in `src/lib/api/translation.test.ts` covering:

- Script heuristics for 8+ scripts (Arabic, Hindi, CJK, Korean, Cyrillic, Greek, Thai, Hebrew)
- Dictionary lookup for 6+ languages
- Edge cases (empty text, whitespace, numbers, mixed scripts)
- Length threshold behavior
- Confidence scoring
- Case insensitivity
- Whitespace handling

---

## Verification Checklist

- [x] No silent fallback to `'en'` anywhere in codebase
- [x] Script heuristics detect non-Latin scripts correctly
- [x] Dictionary lookup prioritized for short text
- [x] Configurable detection length thresholds
- [x] Normalized text comparison for same-language detection
- [x] Structured logging with debug flag gating
- [x] In-memory log buffer for debugging
- [x] Unit tests for detection pipeline
- [x] All fallback decisions logged with reason

---

## Migration Notes

### Breaking Changes

None. The changes are internal to the detection pipeline and maintain backward compatibility with the API.

### Behavior Changes

1. **Short text (< 4 chars):** Now returns uncertain instead of falling back to English
2. **Uncertain detection:** Now surfaces to user via UI instead of silent English fallback
3. **Same-language detection:** More accurate with normalized comparison and length threshold

### Required Actions

None for end users. Extension will automatically use the improved detection pipeline.

---

## Future Improvements

1. **Enhanced CJK detection:** Add context-based distinction between Chinese, Japanese, Korean
2. **Expanded dictionary:** Add more common words for additional languages
3. **User feedback loop:** Allow users to correct detection and improve model
4. **Confidence threshold UI:** Show detection confidence to users when uncertain
