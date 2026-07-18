import { logger } from '@/lib/logger';

/**
 * Lightweight rule-based transliteration from Hinglish (Latin script) to Devanagari
 * Uses ITRANS-style mapping for common Hindi sounds
 * This is a simplified implementation focused on common Hinglish patterns
 */

/**
 * Mapping of Latin consonant clusters to Devanagari
 */
const CONSONANT_MAP: Record<string, string> = {
  // Simple consonants
  'k': 'क', 'kh': 'ख', 'g': 'ग', 'gh': 'घ', 'ng': 'ं',
  'ch': 'च', 'chh': 'छ', 'j': 'ज', 'z': 'ज़', 'jh': 'झ',
  't': 'त', 'th': 'थ', 'd': 'द', 'dh': 'ध', 'n': 'न',
  'T': 'ट', 'Th': 'ठ', 'D': 'ड', 'Dh': 'ढ', 'N': 'ण',
  'p': 'प', 'ph': 'फ', 'b': 'ब', 'bh': 'भ', 'm': 'म',
  'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व', 'w': 'व',
  'sh': 'श', 's': 'स', 'h': 'ह',
  
  // Common consonant+vowel combinations
  'ka': 'का', 'kha': 'खा', 'ga': 'गा', 'gha': 'घा', 'nga': 'ंा',
  'cha': 'चा', 'chha': 'छा', 'ja': 'जा', 'jha': 'झा', 'nya': 'ञा',
  'ta': 'ता', 'tha': 'था', 'da': 'दा', 'dha': 'धा', 'na': 'ना',
  'pa': 'पा', 'pha': 'फा', 'ba': 'बा', 'bha': 'भा', 'ma': 'मा',
  'ya': 'या', 'ra': 'रा', 'la': 'ला', 'va': 'वा', 'sha': 'शा',
  'sa': 'सा', 'ha': 'हा',
  
  'ki': 'कि', 'khi': 'खि', 'gi': 'गि', 'ghi': 'घि', 'ni': 'नि',
  'chi': 'चि', 'chhi': 'छि', 'ji': 'जि', 'jhi': 'झि',
  'ti': 'ति', 'thi': 'थि', 'di': 'दि', 'dhi': 'धि',
  'pi': 'पि', 'phi': 'फि', 'bi': 'बि', 'bhi': 'भि', 'mi': 'मि',
  'yi': 'यि', 'ri': 'रि', 'li': 'लि', 'vi': 'वि', 'shi': 'शि',
  'si': 'सि', 'hi': 'हि',
  
  'ke': 'के', 'khe': 'खे', 'ge': 'गे', 'ghe': 'घे', 'ne': 'ने',
  'che': 'चे', 'chhe': 'छे', 'je': 'जे', 'jhe': 'झे',
  'te': 'ते', 'the': 'थे', 'de': 'दे', 'dhe': 'धे',
  'pe': 'पे', 'phe': 'फे', 'be': 'बे', 'bhe': 'भे', 'me': 'मे',
  'ye': 'ये', 're': 'रे', 'le': 'ले', 've': 'वे', 'she': 'शे',
  'se': 'से', 'he': 'हे',
};

/**
 * Mapping of vowels to Devanagari matras (vowel signs)
 */
const VOWEL_MAP: Record<string, string> = {
  'a': 'ा', 'aa': 'ा', 'A': 'ा',
  'i': 'ि', 'ee': 'ी', 'I': 'ी',
  'u': 'ु', 'oo': 'ू', 'U': 'ू',
  'e': 'े', 'ai': 'ै', 'E': 'े',
  'o': 'ो', 'au': 'ौ', 'O': 'ो',
};

/**
 * Mapping of standalone vowels
 */
const STANDALONE_VOWEL_MAP: Record<string, string> = {
  'a': 'अ', 'aa': 'आ', 'A': 'आ',
  'i': 'इ', 'ee': 'ई', 'I': 'ई',
  'u': 'उ', 'oo': 'ऊ', 'U': 'ऊ',
  'e': 'ए', 'ai': 'ऐ', 'E': 'ए',
  'o': 'ओ', 'au': 'औ', 'O': 'ओ',
};

/**
 * Common Hinglish words with their Devanagari equivalents
 * This handles frequent words that don't follow simple rules
 */
const COMMON_WORDS_MAP: Record<string, string> = {
  'hai': 'है', 'hain': 'हैं', 'nahi': 'नहीं', 'nahin': 'नहीं',
  'kya': 'क्या', 'kaise': 'कैसे', 'kab': 'कब', 'kahan': 'कहां',
  'kaun': 'कौन', 'kyun': 'क्यों', 'kyunki': 'क्योंकि',
  'mera': 'मेरा', 'mere': 'मेरे', 'meri': 'मेरी',
  'tera': 'तेरा', 'tere': 'तेरे', 'teri': 'तेरी',
  'uska': 'उसका', 'uske': 'उसके', 'uski': 'उसकी',
  'hamara': 'हमारा', 'hamare': 'हमारे', 'hamari': 'हमारी',
  'aap': 'आप', 'aapka': 'आपका', 'aapke': 'आपके', 'aapki': 'आपकी',
  'hum': 'हम', 'tum': 'तुम', 'tumhara': 'तुम्हारा',
  'woh': 'वह', 'wo': 'वो', 'ye': 'ये', 'yeh': 'यह',
  'karta': 'करता', 'karti': 'करती', 'karte': 'करते',
  'karo': 'करो', 'karunga': 'करूंगा', 'karega': 'करेगा',
  'raha': 'रहा', 'rahi': 'रही', 'rahe': 'रहे',
  'gaya': 'गया', 'gayi': 'गई', 'gaye': 'गए',
  'aata': 'आता', 'aati': 'आती', 'aate': 'आते',
  'aana': 'आना', 'aao': 'आओ', 'aaye': 'आए',
  'sakta': 'सकता', 'sakti': 'सकती', 'sakte': 'सकते',
  'chahiye': 'चाहिए',
  'acha': 'अच्छा', 'achha': 'अच्छा', 'accha': 'अच्छा',
  'theek': 'ठीक', 'thik': 'ठीक',
  'sahi': 'सही', 'galat': 'गलत',
  'bohot': 'बहुत', 'bahut': 'बहुत',
  'kuch': 'कुछ', 'kuchh': 'कुछ',
  'sab': 'सब', 'sabhi': 'सभी',
  'har': 'हर', 'koi': 'कोई',
  'alag': 'अलग', 'same': 'सेम',
  'kafi': 'काफी', 'thoda': 'थोड़ा', 'thodi': 'थोड़ी',
  'poora': 'पूरा', 'puri': 'पूरी', 'pure': 'पूरे',
  'naya': 'नया', 'nayi': 'नई', 'naye': 'नए',
  'matlab': 'मतलब',
  'dost': 'दोस्त', 'yaar': 'यार', 'bhai': 'भाई',
  'ghar': 'घर', 'kaam': 'काम',
  'time': 'टाइम', 'waqt': 'वक्त',
  'din': 'दिन', 'raat': 'रात',
  'subah': 'सुबह', 'shaam': 'शाम',
  'kal': 'कल', 'aaj': 'आज',
  'log': 'लोग', 'cheez': 'चीज़',
  'baat': 'बात', 'dimaag': 'दिमाग',
  'dil': 'दिल', 'pyar': 'प्यार',
  'zindagi': 'ज़िंदगी', 'life': 'लाइफ',
  'paisa': 'पैसा', 'paise': 'पैसे',
  'ji': 'जी', 'haan': 'हां', 'han': 'हां',
  'are': 'अरे', 'arre': 'अरे',
  'please': 'प्लीज़', 'thanks': 'थैंक्स',
  'sorry': 'सॉरी', 'maaf': 'माफ़',
  'namaste': 'नमस्ते', 'namaskar': 'नमस्कार',
  'abhi': 'अभी', 'ab': 'अब',
  'jaldi': 'जल्दी', 'der': 'देर',
  'samay': 'समय',
  'ghanta': 'घंटा', 'minute': 'मिनट',
  'baar': 'बार', 'dafa': 'दफ़ा',
  'ek': 'एक', 'do': 'दो', 'teen': 'तीन',
  'char': 'चार', 'paanch': 'पांच',
  'saath': 'साथ', 'bina': 'बिना',
  'ke': 'के', 'ka': 'का', 'ki': 'की',
  'se': 'से', 'mein': 'में',
  'par': 'पर', 'lekin': 'लेकिन',
  'ya': 'या', 'phir': 'फिर',
  'bhi': 'भी', 'hi': 'ही', 'sirf': 'सिर्फ',
  'liye': 'लिए', 'bad': 'बाद',
  'beech': 'बीच', 'samne': 'सामने',
  'upar': 'ऊपर', 'neeche': 'नीचे',
  'andar': 'अंदर', 'bahar': 'बाहर',
};

/**
 * Check if text is in Devanagari script.
 * Returns true if the text contains Devanagari characters.
 */
export function isDevanagariScript(text: string): boolean {
  // Devanagari Unicode range: U+0900 to U+097F
  const devanagariRegex = /[\u0900-\u097F]/;
  return devanagariRegex.test(text);
}

/**
 * Transliterate Hinglish text to Devanagari with fallback check.
 * If the output is not in Devanagari script, re-runs the conversion.
 * 
 * @param text - Hinglish text in Latin script
 * @returns Devanagari text
 */
export function transliterateHinglishToDevanagari(text: string): string {
  const words = text.split(/\s+/);
  const transliteratedWords: string[] = [];
  
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    
    // Check common words map first
    if (COMMON_WORDS_MAP[lowerWord]) {
      transliteratedWords.push(COMMON_WORDS_MAP[lowerWord]);
      logger.debug('transliteration', { 
        word: lowerWord, 
        result: COMMON_WORDS_MAP[lowerWord],
        method: 'common-word-map'
      });
      continue;
    }
    
    // Apply rule-based transliteration
    let devanagariWord = '';
    let i = 0;
    
    while (i < word.length) {
      let matched = false;
      
      // Try longest matches first (consonant+vowel combinations)
      for (let len = 4; len >= 1; len--) {
        if (i + len <= word.length) {
          const substr = word.slice(i, i + len).toLowerCase();
          
          if (CONSONANT_MAP[substr]) {
            devanagariWord += CONSONANT_MAP[substr];
            i += len;
            matched = true;
            break;
          }
        }
      }
      
      if (matched) continue;
      
      // Try vowel matras
      for (let len = 3; len >= 1; len--) {
        if (i + len <= word.length) {
          const substr = word.slice(i, i + len).toLowerCase();
          
          if (VOWEL_MAP[substr]) {
            devanagariWord += VOWEL_MAP[substr];
            i += len;
            matched = true;
            break;
          }
        }
      }
      
      if (matched) continue;
      
      // Try standalone vowels
      for (let len = 3; len >= 1; len--) {
        if (i + len <= word.length) {
          const substr = word.slice(i, i + len).toLowerCase();
          
          if (STANDALONE_VOWEL_MAP[substr]) {
            devanagariWord += STANDALONE_VOWEL_MAP[substr];
            i += len;
            matched = true;
            break;
          }
        }
      }
      
      if (matched) continue;
      
      // If no match, keep original character (likely English word or punctuation)
      devanagariWord += word[i];
      i++;
    }
    
    transliteratedWords.push(devanagariWord);
    
    logger.debug('transliteration', { 
      original: word, 
      result: devanagariWord,
      method: 'rule-based'
    });
  }
  
  const result = transliteratedWords.join(' ');
  logger.debug('transliteration-complete', { 
    original: text, 
    result,
    wordCount: words.length
  });
  
  // Fallback check: if output is not in Devanagari, re-run conversion
  // This handles cases where MyMemory returns Romanized Hindi instead of Devanagari
  if (!isDevanagariScript(result) && /[a-zA-Z]/.test(result)) {
    logger.warn('transliteration-fallback', { 
      original: text, 
      result,
      reason: 'Output not in Devanagari script, re-running conversion'
    });
    
    // Re-run with more aggressive conversion
    const fallbackWords: string[] = [];
    for (const word of words) {
      const lowerWord = word.toLowerCase();
      if (COMMON_WORDS_MAP[lowerWord]) {
        fallbackWords.push(COMMON_WORDS_MAP[lowerWord]);
      } else {
        // Force conversion using common words map for any remaining Latin text
        fallbackWords.push(lowerWord.split('').map(char => {
          // Simple character-level fallback
          if (COMMON_WORDS_MAP[char]) return COMMON_WORDS_MAP[char];
          return char; // Keep punctuation/numbers as-is
        }).join(''));
      }
    }
    
    const fallbackResult = fallbackWords.join(' ');
    if (isDevanagariScript(fallbackResult)) {
      logger.debug('transliteration-fallback-success', { 
        original: text, 
        result: fallbackResult
      });
      return fallbackResult;
    }
  }
  
  return result;
}
