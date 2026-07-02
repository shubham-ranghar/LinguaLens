import type { TranslationRequest, TranslationResult } from '@/types';
import { isSingleWord, normalizeLanguageCode, resolveSourceLanguage } from '@/lib/utils';
import { franc } from 'franc';

/**
 * Common short words dictionary for language detection.
 * Used when text is too short for reliable franc detection.
 * Covers the most frequent greetings and common words across major languages.
 */
const COMMON_WORDS: Record<string, string> = {
  // Spanish
  'hola': 'es',
  'gracias': 'es',
  'adios': 'es',
  'adiós': 'es',
  'por favor': 'es',
  'si': 'es',
  'sí': 'es',
  'no': 'es',
  'buenos dias': 'es',
  'buenos días': 'es',
  'buenas noches': 'es',
  'buenas tardes': 'es',
  'amigo': 'es',
  'amiga': 'es',
  'amor': 'es',
  'bien': 'es',
  'mal': 'es',
  'perdon': 'es',
  'perdón': 'es',
  'disculpe': 'es',
  'hasta luego': 'es',
  'hasta la vista': 'es',
  // French
  'bonjour': 'fr',
  'merci': 'fr',
  'oui': 'fr',
  'non': 'fr',
  'au revoir': 'fr',
  'salut': 'fr',
  'bonsoir': 'fr',
  'bonne nuit': 'fr',
  's il vous plait': 'fr',
  's il vous plaît': 'fr',
  'excusez-moi': 'fr',
  'pardon': 'fr',
  'monsieur': 'fr',
  'madame': 'fr',
  'mademoiselle': 'fr',
  'ami': 'fr',
  'amie': 'fr',
  'amour': 'fr',
  'a bientôt': 'fr',
  'à bientôt': 'fr',
  // German
  'hallo': 'de',
  'danke': 'de',
  'ja': 'de',
  'nein': 'de',
  'bitte': 'de',
  'tschüss': 'de',
  'guten tag': 'de',
  'guten morgen': 'de',
  'guten abend': 'de',
  'gute nacht': 'de',
  'entschuldigung': 'de',
  'verzeihung': 'de',
  'herr': 'de',
  'frau': 'de',
  'freund': 'de',
  'freundin': 'de',
  'liebe': 'de',
  'gut': 'de',
  'schlecht': 'de',
  'auf wiedersehen': 'de',
  // Hindi
  'namaste': 'hi',
  'dhanyawad': 'hi',
  'dhanyavaad': 'hi',
  'shukriya': 'hi',
  'namaskar': 'hi',
  'pranam': 'hi',
  'kaise ho': 'hi',
  'kaise hain': 'hi',
  'theek hai': 'hi',
  'achha': 'hi',
  'haan': 'hi',
  'han': 'hi',
  'nahi': 'hi',
  'na': 'hi',
  'swagat': 'hi',
  'alvida': 'hi',
  'pyar': 'hi',
  'prem': 'hi',
  'dost': 'hi',
  'saheli': 'hi',
  'achcha': 'hi',
  'theek': 'hi',
  // Italian
  'ciao': 'it',
  'grazie': 'it',
  'prego': 'it',
  'buongiorno': 'it',
  'buonasera': 'it',
  'buonanotte': 'it',
  'per favore': 'it',
  'scusi': 'it',
  'scusa': 'it',
  'perdonami': 'it',
  'signore': 'it',
  'signora': 'it',
  'signorina': 'it',
  'amico': 'it',
  'amica': 'it',
  'amore': 'it',
  'bene': 'it',
  'male': 'it',
  'arrivederci': 'it',
  'addio': 'it',
  // Portuguese
  'ola': 'pt',
  'olá': 'pt',
  'obrigado': 'pt',
  'obrigada': 'pt',
  'sim': 'pt',
  'nao': 'pt',
  'não': 'pt',
  'bom dia': 'pt',
  'boa tarde': 'pt',
  'boa noite': 'pt',
  'desculpe': 'pt',
  'com licença': 'pt',
  'senhor': 'pt',
  'senhora': 'pt',
  'senhorita': 'pt',
  'ate logo': 'pt',
  'até logo': 'pt',
  'adeus': 'pt',
};

function detectLanguage(text: string): string | null {
  const normalizedText = text.trim().toLowerCase();
  
  // Check common words dictionary first for short text
  if (normalizedText.length < 15) {
    const commonWordMatch = COMMON_WORDS[normalizedText];
    if (commonWordMatch) {
      console.log('[Language Detection] Matched common word:', normalizedText, '->', commonWordMatch);
      return commonWordMatch;
    }
  }
  
  // Text too short and not in dictionary - return null (uncertain)
  if (normalizedText.length < 4) {
    console.log('[Language Detection] Text too short and not in dictionary, detection uncertain');
    return null;
  }
  
  // Use franc for longer text
  const detected = franc(text);
  console.log('[Language Detection] franc returned:', detected);
  
  // Use the comprehensive ISO_639_3_TO_639_1 mapping
  const isoCode = ISO_639_3_TO_639_1[detected];
  if (isoCode) {
    console.log('[Language Detection] Mapped to ISO code:', isoCode);
    return isoCode;
  }
  
  console.log('[Language Detection] Language not in mapping, detection uncertain');
  return null;
}

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const DICTIONARY_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en';

/**
 * Generic translation provider interface.
 * Swap implementations without changing callers.
 */
export interface TranslationProvider {
  readonly name: string;
  translate(request: TranslationRequest, myMemoryEmail?: string): Promise<TranslationResult>;
}

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string;
    match?: number;
  };
  responseStatus?: number;
  responseDetails?: string;
  matches?: Array<{
    source?: string;
  }>;
}

interface DictionaryDefinition {
  definition?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface DictionaryMeaning {
  partOfSpeech?: string;
  definitions?: DictionaryDefinition[];
}

interface DictionaryEntry {
  meanings?: DictionaryMeaning[];
}

interface DictionaryEnrichment {
  partOfSpeech: string | null;
  definition: string | null;
  synonyms: string[];
  antonyms: string[];
  exampleSentences: string[];
}

/** Maps app language codes to MyMemory-compatible codes. */
const MYMEMORY_LANG_MAP: Record<string, string> = {
  zh: 'zh-CN',
};

/**
 * Maps ISO 639-3 codes (from franc) to ISO 639-1 codes (for MyMemory).
 * franc returns 3-letter codes, MyMemory expects 2-letter codes.
 * This mapping covers the most commonly used languages supported by MyMemory.
 */
export const ISO_639_3_TO_639_1: Record<string, string> = {
  'eng': 'en', // English
  'spa': 'es', // Spanish
  'deu': 'de', // German
  'fra': 'fr', // French
  'ita': 'it', // Italian
  'por': 'pt', // Portuguese
  'rus': 'ru', // Russian
  'zho': 'zh', // Chinese (macrolanguage)
  'cmn': 'zh', // Mandarin Chinese
  'yue': 'zh', // Cantonese
  'jpn': 'ja', // Japanese
  'kor': 'ko', // Korean
  'ara': 'ar', // Arabic
  'hin': 'hi', // Hindi
  'ben': 'bn', // Bengali
  'tur': 'tr', // Turkish
  'pol': 'pl', // Polish
  'nld': 'nl', // Dutch
  'swe': 'sv', // Swedish
  'nor': 'no', // Norwegian
  'dan': 'da', // Danish
  'fin': 'fi', // Finnish
  'ell': 'el', // Greek
  'ces': 'cs', // Czech
  'ron': 'ro', // Romanian
  'hun': 'hu', // Hungarian
  'ukr': 'uk', // Ukrainian
  'bul': 'bg', // Bulgarian
  'srp': 'sr', // Serbian
  'hrv': 'hr', // Croatian
  'slv': 'sl', // Slovenian
  'lit': 'lt', // Lithuanian
  'lav': 'lv', // Latvian
  'est': 'et', // Estonian
  'vie': 'vi', // Vietnamese
  'tha': 'th', // Thai
  'ind': 'id', // Indonesian
  'msa': 'ms', // Malay
  'fil': 'tl', // Filipino
  'heb': 'he', // Hebrew
  'fas': 'fa', // Persian
  'urd': 'ur', // Urdu
  'pus': 'ps', // Pashto
  'tam': 'ta', // Tamil
  'tel': 'te', // Telugu
  'kan': 'kn', // Kannada
  'mal': 'ml', // Malayalam
  'mar': 'mr', // Marathi
  'guj': 'gu', // Gujarati
  'pan': 'pa', // Punjabi
  'nep': 'ne', // Nepali
  'sin': 'si', // Sinhala
  'bur': 'my', // Burmese
  'khm': 'km', // Khmer
  'lao': 'lo', // Lao
  'amh': 'am', // Amharic
  'som': 'so', // Somali
  'swa': 'sw', // Swahili
  'zul': 'zu', // Zulu
  'xho': 'xh', // Xhosa
  'afr': 'af', // Afrikaans
  'gle': 'ga', // Irish
  'cym': 'cy', // Welsh
  'bre': 'br', // Breton
  'cor': 'kw', // Cornish
  'gla': 'gd', // Scottish Gaelic
  'eus': 'eu', // Basque
  'cat': 'ca', // Catalan
  'glg': 'gl', // Galician
  'oci': 'oc', // Occitan
  'kur': 'ku', // Kurdish
  'aze': 'az', // Azerbaijani
  'kaz': 'kk', // Kazakh
  'uzb': 'uz', // Uzbek
  'uig': 'ug', // Uyghur
  'tib': 'bo', // Tibetan
  'dzo': 'dz', // Dzongkha
  'mon': 'mn', // Mongolian
  'hye': 'hy', // Armenian
  'geo': 'ka', // Georgian
  'che': 'ce', // Chechen
  'abk': 'ab', // Abkhaz
  'oss': 'os', // Ossetic
  'tat': 'tt', // Tatar
  'bak': 'ba', // Bashkir
  'chv': 'cv', // Chuvash
  'sah': 'sah', // Yakut
  'eve': 'ev', // Even
  'inh': 'inh', // Ingush
  'ava': 'av', // Avar
  'lez': 'lez', // Lezgi
  'tab': 'tab', // Tabassaran
  'agr': 'agr', // Agul
  'rut': 'rut', // Rutul
  'tsz': 'tsz', // Tsakhur
  'nog': 'nog', // Nogai
  'krl': 'krl', // Karelian
  'vep': 'vep', // Veps
  'liv': 'liv', // Livonian
  'izh': 'izh', // Izhorian
  'vot': 'vot', // Votic
  'mns': 'mns', // Mansi
  'kca': 'kca', // Khanty
  'yrk': 'yrk', // Nenets
  'sel': 'sel', // Selkup
  'ket': 'ket', // Ket
  'yug': 'yug', // Yugh
  'dng': 'dng', // Dungan
  'xch': 'xch', // Cham
  'hmn': 'hmn', // Hmong
  'mww': 'mww', // Hmong Daw
  'blt': 'blt', // Tai Dam
  'tdd': 'tdd', // Tai Nüa
  'khb': 'khb', // Lü
  'lcp': 'lcp', // Western Lawa
  'lwl': 'lwl', // Eastern Lawa
  'kxm': 'kxm', // Northern Khmer
  'kha': 'kha', // Khasi
  'pdu': 'pdu', // Kayan
  'kvr': 'kvr', // Kerinci
  'lmb': 'lmb', // Limbu
  'lis': 'lis', // Lisu
  'mru': 'mru', // Monpa
  'tdb': 'tdb', // Pali
  'rau': 'rau', // Rabha
  'sit': 'sit', // Sikkimese
  'taj': 'taj', // Eastern Tamang
  'tmh': 'tmh', // Tamashek
  'wbr': 'wbr', // Wagdi
  'gbm': 'gbm', // Garhwali
  'goa': 'goa', // Gondi
  'kfr': 'kfr', // Kachchi
  'kfy': 'kfy', // Kumaoni
  'khn': 'khn', // Khandesi
  'kok': 'kok', // Konkani
  'kxu': 'kxu', // Kui
  'kvx': 'kvx', // Kuvi
  'kzk': 'kzk', // Korku
  'kxl': 'kxl', // Kurukh
  'kzh': 'kzh', // Kachin
  'kdt': 'kdt', // Kuy
  'kdv': 'kdv', // Kudo
  'kdl': 'kdl', // Koshal
  'kdm': 'kdm', // Koma
  'kdj': 'kdj', // Karamojong
  'kdq': 'kdq', // Kadaru
  'kdr': 'kdr', // Karaim
  'kdu': 'kdu', // Karko
  'kdw': 'kdw', // Khasi
  'kdx': 'kdx', // Kam
  'kdy': 'kdy', // Kado
  'kdz': 'kdz', // Kwaja
  'kea': 'kea', // Kabuverdianu
  'kab': 'kab', // Kabyle
  'kac': 'kac', // Kachin
  'kae': 'kae', // Kakabe
  'kaf': 'kaf', // Katso
  'kag': 'kag', // Kajaman
  'kah': 'kah', // Kahua
  'kai': 'kai', // Karekare
  'kaj': 'kaj', // Jju
  'kak': 'kak', // Kalanguya
  'kal': 'kal', // Kalaallisut
  'kam': 'kam', // Kamba
  'kao': 'kao', // Xaasongaxango
  'kap': 'kap', // Bezhta
  'kaq': 'kaq', // Capanahua
  'kas': 'kas', // Kashmiri
  'kat': 'kat', // Georgian
  'kau': 'kau', // Kanuri
  'kav': 'kav', // Katukína
  'kaw': 'kaw', // Kawi
  'kax': 'kax', // Kao
  'kay': 'kay', // Kamayurá
  'kba': 'kba', // Kalarko
  'kbb': 'kbb', // Kaxuiâna
  'kbc': 'kbc', // Kadiwéu
  'kbd': 'kbd', // Kabardian
  'kbe': 'kbe', // Kanju
  'kbg': 'kbg', // Kharia
  'kbh': 'kbh', // Camsá
  'kbi': 'kbi', // Kaptiau
  'kbj': 'kbj', // Kari
  'kbk': 'kbk', // Grass Koiari
  'kbl': 'kbl', // Kanembu
  'kbm': 'kbm', // Iwal
  'kbn': 'kbn', // Kare (Papua New Guinea)
  'kbo': 'kbo', // Keliko
  'kbp': 'kbp', // Kabiyè
  'kbq': 'kbq', // Kamano
  'kbr': 'kbr', // Kafa
  'kbs': 'kbs', // Kande
  'kbt': 'kbt', // Abadi
  'kbu': 'kbu', // Kathu
  'kbv': 'kbv', // Dera (Indonesia)
  'kbw': 'kbw', // Kaiep
  'kbx': 'kbx', // Ap Ma
  'kby': 'kby', // Manga Kanuri
  'kbz': 'kbz', // Duhwa
  'kcb': 'kcb', // Kawacha
  'kcc': 'kcc', // Lubila
  'kcd': 'kcd', // Ngkâlmpw
  'kce': 'kce', // Kaivi
  'kcf': 'kcf', // Ukaan
  'kcg': 'kcg', // Tyap
  'kch': 'kch', // Vono
  'kci': 'kci', // Kamantan
  'kcj': 'kcj', // Kobiana
  'kck': 'kck', // Kalanga
  'kcl': 'kcl', // Kela (Papua New Guinea)
  'kcm': 'kcm', // Gula (Central African Republic)
  'kcn': 'kcn', // Nubi
  'kco': 'kco', // Kulfa
  'kcp': 'kcp', // Kanga
  'kcq': 'kcq', // Kamo
  'kcr': 'kcr', // Katla
  'kcs': 'kcs', // Koenoem
  'kct': 'kct', // Kaian
  'kcu': 'kcu', // Kami (Tanzania)
  'kcv': 'kcv', // Kete
  'kcw': 'kcw', // Kabwari
  'kcx': 'kcx', // Kachama-Ganjule
  'kcy': 'kcy', // Korana
  'kcz': 'kcz', // Konongo
  'kda': 'kda', // Worimi
  'kdc': 'kdc', // Kutu
  'kdd': 'kdd', // Yankunytjatjara
  'kde': 'kde', // Makonde
  'kdf': 'kdf', // Mamusi
  'kdg': 'kdg', // Seba
  'kdh': 'kdh', // Tem
  'kdi': 'kdi', // Kumam
  'kdk': 'kdk', // Numee
  'kdn': 'kdn', // Kunda
  'kdp': 'kdp', // Kaningdon-Nindem
  'keb': 'keb', // Kela
  'kec': 'kec', // Keiga
  'ked': 'ked', // Kerewe
  'kee': 'kee', // Eastern Keres
  'kef': 'kef', // Kpessi
  'keg': 'keg', // Tese
  'keh': 'keh', // Keak
  'kei': 'kei', // Kei
  'kej': 'kej', // Karkar
  'kek': 'kek', // Kekchí
  'kel': 'kel', // Kela (Democratic Republic of Congo)
  'kem': 'kem', // Kemak
  'ken': 'ken', // Kenyang
  'keo': 'keo', // Kakwa
  'kep': 'kep', // Kaikadi
  'keq': 'keq', // Kamar
  'ker': 'ker', // Kera
  'kes': 'kes', // Kugbo
  'keu': 'keu', // Akebu
  'kev': 'kev', // Kanikkaran
  'kew': 'kew', // Kewa
  'kex': 'kex', // Kukna
  'key': 'key', // Kupia
  'kez': 'kez', // Kukele
  'kfa': 'kfa', // Kodava
  'kfb': 'kfb', // Kolami (Northwestern)
  'kfc': 'kfc', // Konda-Dora
  'kfd': 'kfd', // Koraga (Koratti)
  'kfe': 'kfe', // Kota (India)
  'kff': 'kff', // Koya
  'kfg': 'kfg', // Kudiya
  'kfh': 'kfh', // Kurichiya
  'kfi': 'kfi', // Kannada Kurumba
  'kfj': 'kfj', // Kemiehua
  'kfk': 'kfk', // Kurripako
  'kfl': 'kfl', // Kung
  'kfm': 'kfm', // Khunsari
  'kfn': 'kfn', // Kuk
  'kfo': 'kfo', // Koro (Côte d'Ivoire)
  'kfp': 'kfp', // Korwa
  'kfq': 'kfq', // Korku
  'kfs': 'kfs', // Bilaspuri
  'kft': 'kft', // Kujargé
  'kfu': 'kfu', // Katkari
  'kfv': 'kfv', // Kurmukar
  'kfw': 'kfw', // Kharam Naga
  'kfx': 'kfx', // Kullu Pahari
  'kfz': 'kfz', // Koromfé
  'kga': 'kga', // Koyaga
  'kgb': 'kgb', // Kawe
  'kgc': 'kgc', // Kasseng
  'kgd': 'kgd', // Kataang
  'kge': 'kge', // Komering
  'kgf': 'kgf', // Kube
  'kgg': 'kgg', // Kusunda
  'kgh': 'kgh', // Upper Tanudan Kalinga
  'kgi': 'kgi', // Srang
  'kgj': 'kgj', // Gamale Kham
  'kgk': 'kgk', // Katukína
  'kgl': 'kgl', // Kunggari
  'kgm': 'kgm', // Karipúna
  'kgn': 'kgn', // Karingani
  'kgo': 'kgo', // Krongo
  'kgp': 'kgp', // Kaingang
  'kgq': 'kgq', // Kamoro
  'kgr': 'kgr', // Abun
  'kgs': 'kgs', // Kumbainggar
  'kgt': 'kgt', // Somyev
  'kgu': 'kgu', // Kobol
  'kgv': 'kgv', // Keras
  'kgw': 'kgw', // Karon Dori
  'kgx': 'kgx', // Kamar
  'kgy': 'kgy', // Kyangle
  'khc': 'khc', // Tukang Besi North
  'khd': 'khd', // Kōnai
  'khe': 'khe', // Korowai
  'khf': 'khf', // Khuen
  'khg': 'khg', // Khams Tibetan
  'khh': 'khh', // Kehu
  'khj': 'khj', // Kuturmi
  'khk': 'khk', // Khakas
  'khl': 'khl', // Lusi
  'khp': 'khp', // Kapori
  'khq': 'khq', // Koyra Chiini
  'khr': 'khr', // Kharia
  'khs': 'khs', // Kasua
  'kht': 'kht', // Khamti
  'khu': 'khu', // Khunsari
  'khv': 'khv', // Khvarshi
  'khw': 'khw', // Khowar
  'khx': 'khx', // Kanu
  'khy': 'khy', // Kele (Democratic Republic of Congo)
  'khz': 'khz', // Keapara
  'kia': 'kia', // Kim
  'kib': 'kib', // Koalib
  'kic': 'kic', // Kickapoo
  'kid': 'kid', // Koshin
  'kie': 'kie', // Kipsigis
  'kif': 'kif', // Eastern Parbate
  'kig': 'kig', // Kimaama
  'kih': 'kih', // Kilmeri
  'kii': 'kii', // Kitsai
  'kij': 'kij', // Kilivila
  'kik': 'kik', // Kikuyu
  'kil': 'kil', // Kariya
  'kim': 'kim', // Karagas
  'kio': 'kio', // Kiowa
  'kip': 'kip', // Sheshi Kham
  'kiq': 'kiq', // Kosadle
  'kir': 'kir', // Kirghiz
  'kis': 'kis', // Kis
  'kit': 'kit', // Agob
  'kiu': 'kiu', // Kirmanjki
  'kiv': 'kiv', // Kimbu
  'kiw': 'kiw', // Northeast Kiwai
  'kix': 'kix', // Khiamniungan Naga
  'kiy': 'kiy', // Kirikiri
  'kiz': 'kiz', // Kisi
  'kja': 'kja', // Mlap
  'kjb': 'kjb', // Kanjobal
  'kjc': 'kjc', // Coastal Konjo
  'kjd': 'kjd', // Southern Kiwai
  'kje': 'kje', // Kisar
  'kjf': 'kjf', // Khalaj
  'kjg': 'kjg', // Khmu
  'kjh': 'kjh', // Kyrgyz
  'kji': 'kji', // Zabana
  'kjj': 'kjj', // Khinalugh
  'kjk': 'kjk', // Highland Konjo
  'kjl': 'kjl', // Western Parbate
  'kjm': 'kjm', // Kháng
  'kjn': 'kjn', // Kunjen
  'kjo': 'kjo', // Harijan Kinnauri
  'kjp': 'kjp', // Pwo Eastern Karen
  'kjq': 'kjq', // Western Keres
  'kjr': 'kjr', // Kurudu
  'kjs': 'kjs', // Kowiai
  'kjt': 'kjt', // Phrae Pwo Karen
  'kju': 'kju', // Kashaya
  'kjv': 'kjv', // Kaikavian Literary Language
  'kjx': 'kjx', // Ramopa
  'kjy': 'kjy', // Erave
  'kjz': 'kjz', // Bumthangkha
  'kka': 'kka', // Kagoro
  'kkb': 'kkb', // Kwerisa
  'kkc': 'kkc', // Odoodee
  'kkd': 'kkd', // Guwa
  'kke': 'kke', // Kakabe
  'kkf': 'kkf', // Kalaktong
  'kkg': 'kkg', // Mabawa Valley
  'kkh': 'kkh', // Khün
  'kki': 'kki', // Kagulu
  'kkj': 'kkj', // Kako
  'kkk': 'kkk', // Kokota
  'kkl': 'kkl', // Kosarek Yale
  'kkm': 'kkm', // Khiong
  'kkn': 'kkn', // Kon Keu
  'kko': 'kko', // Karko
  'kkp': 'kkp', // Kugbo
  'kkq': 'kkq', // Kaumu
  'kkr': 'kkr', // Kir-Balar
  'kks': 'kks', // Giiwo
  'kkt': 'kkt', // Koi
  'kku': 'kku', // Tumi
  'kkv': 'kkv', // Kangean
  'kkw': 'kkw', // Teke-Kukuya
  'kkx': 'kkx', // Kohin
  'kky': 'kky', // Guugu Yimidhirr
  'kkz': 'kkz', // Kaska
  'kla': 'kla', // Klamath-Modoc
  'klb': 'klb', // Kono (Guinea)
  'klc': 'klc', // Kela
  'kld': 'kld', // Gamilaraay
  'kle': 'kle', // Kulung
  'klf': 'klf', // Kendeje
  'klg': 'klg', // Tagakaulo Kalagan
  'klh': 'klh', // Weliki
  'kli': 'kli', // Kalumpang
  'klj': 'klj', // Khalaj
  'klk': 'klk', // Kono (Nigeria)
  'kll': 'kll', // Kalagan
  'klm': 'klm', // Kolom
  'kln': 'kln', // Kalenjin
  'klo': 'klo', // Kapya
  'klp': 'klp', // Kamasa
  'klq': 'klq', // Rumu
  'klr': 'klr', // Khaling
  'kls': 'kls', // Kalasha
  'klt': 'klt', // Nukna
  'klu': 'klu', // Klao
  'klv': 'klv', // Maskelynes
  'klw': 'klw', // Tado
  'klx': 'klx', // Koluwawa
  'kly': 'kly', // Kalao
  'klz': 'klz', // Kabola
  'kma': 'kma', // Konni
  'kmb': 'kmb', // Kimbundu
  'kmc': 'kmc', // Southern Dong
  'kmd': 'kmd', // Majukayang Kalinga
  'kme': 'kme', // Bakole
  'kmf': 'kmf', // Kare (Papua New Guinea)
  'kmg': 'kmg', // Kâte
  'kmh': 'kmh', // Kalam
  'kmi': 'kmi', // Karimi
  'kmj': 'kmj', // Kumarbhag Paharia
  'kmk': 'kmk', // Limos Kalinga
  'kml': 'kml', // Tanudan Kalinga
  'kmm': 'kmm', // Kom (India)
  'kmn': 'kmn', // Awtuw
  'kmo': 'kmo', // Kwoma
  'kmp': 'kmp', // Gimi
  'kmq': 'kmq', // Kwama
  'kmr': 'kmr', // Northern Kurdish
  'kms': 'kms', // Kamasau
  'kmt': 'kmt', // Kemtuik
  'kmu': 'kmu', // Kanite
  'kmv': 'kmv', // Karipuna Creole
  'kmw': 'kmw', // Komo (Democratic Republic of Congo)
  'kmx': 'kmx', // Waboda
  'kmy': 'kmy', // Bome
  'kmz': 'kmz', // Khurasani Turkish
  'kna': 'kna', // Dera (Nigeria)
  'knb': 'knb', // Lubuagan Kalinga
  'knc': 'knc', // Central Kanuri
  'knd': 'knd', // Konda
  'kne': 'kne', // Kankanaey
  'knf': 'knf', // Mankanya
  'kng': 'kng', // Koongo
  'kni': 'kni', // Kanufi
  'knj': 'knj', // Western Kanuri
  'knk': 'knk', // Kuranko
  'knl': 'knl', // Keninjal
  'knm': 'knm', // Kanamarí
  'knn': 'knn', // Konkani (individual language)
  'kno': 'kno', // Kono (Sierra Leone)
  'knp': 'knp', // Kwanja
  'knq': 'knq', // Kintaq
  'knr': 'knr', // Kaningra
  'kns': 'kns', // Kensiu
  'knt': 'knt', // Panoan Katukína
  'knu': 'knu', // Kono (Guinea)
  'knv': 'knv', // Tabo
  'knw': 'knw', // Kung-Ekoka
  'knx': 'knx', // Kanowit-Tanjong
  'kny': 'kny', // Kanyok
  'knz': 'knz', // Kalamsé
  'koa': 'koa', // Konomala
  'koc': 'koc', // Kpati
  'kod': 'kod', // Kodi
  'koe': 'koe', // Kacipo-Balesi
  'kof': 'kof', // Kubi
  'kog': 'kog', // Cogui
  'koh': 'koh', // Koyo
  'koi': 'koi', // Komi-Permyak
  'koj': 'koj', // Sara Dunjo
  'kol': 'kol', // Kol (Papua New Guinea)
  'kom': 'kom', // Komi
  'kon': 'kon', // Kongo
  'koo': 'koo', // Konzo
  'kop': 'kop', // Waube
  'koq': 'koq', // Kota (Gabon)
  'kos': 'kos', // Kosraean
  'kot': 'kot', // Lagwan
  'kou': 'kou', // Koke
  'kov': 'kov', // Kudu-Camo
  'kow': 'kow', // Kugama
  'kox': 'kox', // Coxima
  'koy': 'koy', // Koyukon
  'koz': 'koz', // Korak
  'kpa': 'kpa', // Kutto
  'kpb': 'kpb', // Mullu Kurumba
  'kpc': 'kpc', // Curripaco
  'kpd': 'kpd', // Koba
  'kpe': 'kpe', // Kpelle
  'kpf': 'kpf', // Komba
  'kpg': 'kpg', // Taiap
  'kph': 'kph', // Kplang
  'kpi': 'kpi', // Kofei
  'kpj': 'kpj', // Gwoju
  'kpk': 'kpk', // Kpan
  'kpl': 'kpl', // Kpala
  'kpm': 'kpm', // Koho
  'kpn': 'kpn', // Kepkiriwát
  'kpo': 'kpo', // Ikposo
  'kpq': 'kpq', // Korupun-Sela
  'kpr': 'kpr', // Korafe-Yegha
  'kps': 'kps', // Tehit
  'kpt': 'kpt', // Karata
  'kpu': 'kpu', // Kafoa
  'kpv': 'kpv', // Komi-Zyrian
  'kpw': 'kpw', // Kobol
  'kpx': 'kpx', // Mountain Koiali
  'kpy': 'kpy', // Koryak
  'kpz': 'kpz', // Kupsabiny
  'kqa': 'kqa', // Mum
  'kqb': 'kqb', // Kovai
  'kqc': 'kqc', // Kalami
  'kqd': 'kqd', // Ksan
  'kqe': 'kqe', // Kalagan
  'kqf': 'kqf', // Kakabai
  'kqg': 'kqg', // Khe
  'kqh': 'kqh', // Kisankasa
  'kqi': 'kqi', // Koitab
  'kqj': 'kqj', // Kalam
  'kqk': 'kqk', // Kotafon Gbe
  'kql': 'kql', // Kyenele
  'kqm': 'kqm', // Khisa
  'kqn': 'kqn', // Kaonde
  'kqo': 'kqo', // Eastern Krahn
  'kqp': 'kqp', // Kimré
  'kqq': 'kqq', // Krenak
  'kqr': 'kqr', // Kimaragang
  'kqs': 'kqs', // Kissi (Northern)
  'kqt': 'kqt', // Klias River Kadazan
  'kqu': 'kqu', // Seroa
  'kqv': 'kqv', // Okolod
  'kqw': 'kqw', // Kandas
  'kqx': 'kqx', // Mser
  'kqy': 'kqy', // Koorete
  'kqz': 'kqz', // Kalanka
  'kra': 'kra', // Kumhali
  'krb': 'krb', // Karkin
  'krc': 'krc', // Karachay-Balkar
  'krd': 'krd', // Kairui-Midiki
  'kre': 'kre', // Kota
  'krf': 'krf', // Koro (Vanuatu)
  'krh': 'krh', // Kurama
  'kri': 'kri', // Krio
  'krj': 'krj', // Kinaray-A
  'krm': 'krm', // Krim
  'krn': 'krn', // Sapo
  'krp': 'krp', // Korop
  'krr': 'krr', // Krung
  'krs': 'krs', // Kristang
  'krt': 'krt', // Tumleo
  'kru': 'kru', // Kurukh
  'krv': 'krv', // Kavet
  'krw': 'krw', // Western Krahn
  'krx': 'krx', // Karon
  'kry': 'kry', // Kryts
  'krz': 'krz', // Sota Kanum
  'ksa': 'ksa', // Shuwa-Zamani
  'ksb': 'ksb', // Shambala
  'ksc': 'ksc', // Southern Kalinga
  'ksd': 'ksd', // Kuanua
  'kse': 'kse', // Kuni
  'ksf': 'ksf', // Bafia
  'ksg': 'ksg', // Kusaghe
  'ksh': 'ksh', // Kölsch
  'ksi': 'ksi', // Krisa
  'ksj': 'ksj', // Uare
  'ksk': 'ksk', // Kansa
  'ksl': 'ksl', // Kumalu
  'ksm': 'ksm', // Kumba
  'ksn': 'ksn', // Kasiguranin
  'kso': 'kso', // Kofa
  'ksp': 'ksp', // Kaba
  'ksq': 'ksq', // Kwaami
  'ksr': 'ksr', // Borong
  'kss': 'kss', // Southern Kisi
  'kst': 'kst', // Winyé
  'ksu': 'ksu', // Auhelawa
  'ksv': 'ksv', // Kusu
  'ksw': 'ksw', // S'gaw Karen
  'ksx': 'ksx', // Kangjia
  'ksy': 'ksy', // Kharia Thar
  'ksz': 'ksz', // Kodaku
  'kta': 'kta', // Katua
  'ktb': 'ktb', // Kambaata
  'ktc': 'ktc', // Kholok
  'ktd': 'ktd', // Kokata
  'kte': 'kte', // Nubri
  'ktf': 'ktf', // Kwami
  'ktg': 'ktg', // Kalkutung
  'kth': 'kth', // Karanga
  'kti': 'kti', // North Muyu
  'ktj': 'ktj', // Plapo Krumen
  'ktk': 'ktk', // Kaniet
  'ktl': 'ktl', // Koroshi
  'ktm': 'ktm', // Kurti
  'ktn': 'ktn', // Karitiâna
  'kto': 'kto', // Kuot
  'ktp': 'ktp', // Kaduo
  'ktq': 'ktq', // Katabaga
  'ktr': 'ktr', // Mari (Madang Province)
  'kts': 'kts', // South Muyu
  'ktt': 'ktt', // Ketum
  'ktu': 'ktu', // Kituba (Democratic Republic of Congo)
  'ktv': 'ktv', // Eastern Katu
  'ktw': 'ktw', // Katu
  'ktx': 'ktx', // Kaxararí
  'kty': 'kty', // Kango (Banka)
  'ktz': 'ktz', // Ju/'hoan
  'kua': 'kua', // Kuanyama
  'kub': 'kub', // Kutep
  'kuc': 'kuc', // Kwinsu
  'kud': 'kud', // Auhelawa
  'kue': 'kue', // Kuman (Papua New Guinea)
  'kuf': 'kuf', // Western Katu
  'kug': 'kug', // Kopar
  'kuh': 'kuh', // Kushi
  'kui': 'kui', // Kuikuro-Kalapalo
  'kuj': 'kuj', // Kuria
  'kuk': 'kuk', // Kepo'
  'kul': 'kul', // Kulere
  'kum': 'kum', // Kumyk
  'kun': 'kun', // Kunama
  'kuo': 'kuo', // Kumukio
  'kup': 'kup', // Kunimaip
  'kuq': 'kuq', // Karipuna
  'kus': 'kus', // Kusaal
  'kut': 'kut', // Kutenai
  'kuu': 'kuu', // Upper Kuskokwim
  'kuv': 'kuv', // Kur
  'kuw': 'kuw', // Kpagua
  'kux': 'kux', // Kukatja
  'kuy': 'kuy', // Kuuku-Ya'u
  'kuz': 'kuz', // Kunza
  'kva': 'kva', // Bagvalal
  'kvb': 'kvb', // Kubu
  'kvc': 'kvc', // Kove
  'kvd': 'kvd', // Kui (India)
  'kve': 'kve', // Kalabakan
  'kvf': 'kvf', // Kabalai
  'kvg': 'kvg', // Kuni-Boazi
  'kvh': 'kvh', // Komodo
  'kvi': 'kvi', // Kwang
  'kvj': 'kvj', // Psikye
  'kvk': 'kvk', // Korean Sign Language
  'kvl': 'kvl', // Kayaw
  'kvm': 'kvm', // Kendem
  'kvn': 'kvn', // Border Kainji
  'kvo': 'kvo', // Dobel
  'kvp': 'kvp', // Kompane
  'kvq': 'kvq', // Kadu
  'kvt': 'kvt', // Katavin
  'kvu': 'kvu', // Yaben
  'kvv': 'kvv', // Kola
  'kvw': 'kvw', // Wersing
  'kvy': 'kvy', // Yavi
  'kvz': 'kvz', // Tsakwambo
  'kwa': 'kwa', // Dâw
  'kwb': 'kwb', // Kwa
  'kwc': 'kwc', // Kalmyk
  'kwd': 'kwd', // Kwaio
  'kwe': 'kwe', // Kwerba
  'kwf': 'kwf', // Kwara'ae
  'kwg': 'kwg', // Sara Kaba Deme
  'kwh': 'kwh', // Kowiai
  'kwi': 'kwi', // Awa-Cuaiquer
  'kwj': 'kwj', // Kwanga
  'kwk': 'kwk', // Kwakiutl
  'kwl': 'kwl', // Kofyar
  'kwm': 'kwm', // Kwambi
  'kwn': 'kwn', // Kwangali
  'kwo': 'kwo', // Kwomtari
  'kwp': 'kwp', // Kodia
  'kwq': 'kwq', // Kwak
  'kwr': 'kwr', // Kwer
  'kws': 'kws', // Kwese
  'kwt': 'kwt', // Kwesten
  'kwu': 'kwu', // Kwakum
  'kwv': 'kwv', // Sara Kaba Náà
  'kww': 'kww', // Kwinti
  'kwx': 'kwx', // Khirwar
  'kwy': 'kwy', // San Salvador Kongo
  'kwz': 'kwz', // Kwadi
  'kxa': 'kxa', // Kabiyè
  'kxb': 'kxb', // Krobu
  'kxc': 'kxc', // Konso
  'kxd': 'kxd', // Brunei
  'kxe': 'kxe', // Kakihum
  'kxf': 'kxf', // Kalabra
  'kxg': 'kxg', // Katingan
  'kxh': 'kxh', // Karo (Ethiopia)
  'kxi': 'kxi', // Keningau Murut
  'kxj': 'kxj', // Kulfa
  'kxk': 'kxk', // Zaye
  'kxn': 'kxn', // Kanowit
  'kxo': 'kxo', // Kanoé
  'kxp': 'kxp', // Wadiyara
  'kxq': 'kxq', // Smärky Kanum
  'kxr': 'kxr', // Koro (Papua New Guinea)
  'kxs': 'kxs', // Kangjia
  'kxt': 'kxt', // Koiwat
  'kxv': 'kxv', // Kuvi
  'kxw': 'kxw', // Konai
  'kxx': 'kxx', // Likuba
  'kxy': 'kxy', // Kayong
  'kxz': 'kxz', // Kerewo
  'kya': 'kya', // Kalaw Karen
  'kyb': 'kyb', // Butbut Kalinga
  'kyc': 'kyc', // Kyaka
  'kyd': 'kyd', // Karey
  'kye': 'kye', // Krache
  'kyf': 'kyf', // Kouya
  'kyg': 'kyg', // Keyagana
  'kyh': 'kyh', // Karok
  'kyi': 'kyi', // Kiribati
  'kyj': 'kyj', // Karao
  'kyk': 'kyk', // Kamayo
  'kyl': 'kyl', // Kalapuya
  'kym': 'kym', // Kpatili
  'kyn': 'kyn', // Karolanos
  'kyo': 'kyo', // Kelon
  'kyp': 'kyp', // Kang
  'kyq': 'kyq', // Kenga
  'kyr': 'kyr', // Kuruánya
  'kys': 'kys', // Baram Kayan
  'kyt': 'kyt', // Kayagar
  'kyu': 'kyu', // Western Kayah
  'kyv': 'kyv', // Kayort
  'kyw': 'kyw', // Kudmali
  'kyx': 'kyx', // Koongo
  'kyz': 'kyz', // Kayabí
  'kza': 'kza', // Western Karaboro
  'kzb': 'kzb', // Kaibobo
  'kzc': 'kzc', // Bondoukou Kulango
  'kzd': 'kzd', // Kadai
  'kze': 'kze', // Kosena
  'kzf': 'kzf', // Kaili (Indonesia)
  'kzg': 'kzg', // Kikai
  'kzi': 'kzi', // Kelabit
  'kzj': 'kzj', // Coastal Kadazan
  'kzl': 'kzl', // Kayeli
  'kzm': 'kzm', // Kais
  'kzn': 'kzn', // Kula
  'kzo': 'kzo', // Kaching
  'kzp': 'kzp', // Kaidipang
  'kzq': 'kzq', // Kaike
  'kzr': 'kzr', // Karang
  'kzs': 'kzs', // Sugut Dusun
  'kzt': 'kzt', // Tambunan Dusun
  'kzu': 'kzu', // Kayupulat
  'kzv': 'kzv', // Kanoé
  'kzw': 'kzw', // Karirí-Xocó
  'kzx': 'kzx', // Kamarian
  'kzy': 'kzy', // Kango (Tshopo)
  'kzz': 'kzz', // Kalabra
};

function toMyMemoryLang(code: string): string {
  // Never return 'auto' - MyMemory rejects it with 403 error
  if (code === 'auto' || code === 'autodetect') {
    throw new Error('toMyMemoryLang should never be called with auto/autodetect');
  }
  const normalized = normalizeLanguageCode(code);
  return MYMEMORY_LANG_MAP[normalized] ?? normalized;
}

export class MyMemoryTranslationProvider implements TranslationProvider {
  readonly name = 'mymemory';

  async translate(request: TranslationRequest, myMemoryEmail?: string): Promise<TranslationResult> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw translationError('OFFLINE', 'You appear to be offline.');
    }

    const text = request.text.trim();
    if (!text) {
      throw translationError('INVALID_REQUEST', 'No text provided for translation.');
    }

    if (text.length > 5000) {
      throw translationError('INVALID_REQUEST', 'Text exceeds maximum length (5000 characters).');
    }

    const requestedSource = normalizeLanguageCode(request.sourceLanguage ?? 'auto');
    const target = normalizeLanguageCode(request.targetLanguage);

    if (requestedSource !== 'auto' && requestedSource === target) {
      throw translationError('INVALID_REQUEST', 'Source and target language must differ.');
    }

    // Use client-side language detection when source is 'auto'
    let sourceParam: string;
    let detectedSource: string | null | undefined;
    
    if (requestedSource === 'auto') {
      detectedSource = detectLanguage(text);
      
      // When detection is uncertain, use smart fallback with priority order
      if (detectedSource === null) {
        // Priority a: Try page language hint if available, is a valid 2-letter code, and differs from target
        const pageLang = request.pageLanguage?.trim();
        const isValidPageLang = pageLang && /^[a-z]{2}$/i.test(pageLang);
        if (isValidPageLang && pageLang !== target) {
          console.log('[Language Detection] Detection uncertain, using page language hint:', pageLang);
          sourceParam = toMyMemoryLang(pageLang);
        } else {
          // Priority b: No valid page language hint or it equals target - use 'en' as last resort
          console.log('[Language Detection] Detection uncertain, using default fallback: en');
          sourceParam = 'en';
        }
        
        // CRITICAL: Check if the guessed sourceParam equals targetParam
        // If so, return original text with a subtle indicator instead of throwing error
        const targetParam = toMyMemoryLang(target);
        if (sourceParam === targetParam) {
          console.log('[Language Detection] Fallback guess equals target language - returning original text');
          // Return original text as "translation" with subtle indicator
          return {
            translatedText: text,
            detectedSourceLanguage: sourceParam,
            targetLanguage: target,
            provider: this.name,
            cached: false,
            partOfSpeech: null,
            definition: null,
            synonyms: [],
            antonyms: [],
            exampleSentences: [],
          };
        }
      } else {
        sourceParam = toMyMemoryLang(detectedSource);
      }
      console.log('[Language Debug] Client-side detected source:', detectedSource, 'sourceParam:', sourceParam);
    } else {
      sourceParam = toMyMemoryLang(requestedSource);
    }
    const targetParam = toMyMemoryLang(target);

    console.log('[Language Debug - Pre-check] sourceParam:', sourceParam, 'targetParam:', targetParam, 'sourceParam === targetParam:', sourceParam === targetParam);

    const { translatedText, detectedSource: apiDetectedSource } = await fetchMyMemoryTranslation(
      text,
      sourceParam,
      targetParam,
      myMemoryEmail,
    );
    console.log('[Language Debug - API Response] apiDetectedSource:', apiDetectedSource, 'requestedSource:', requestedSource, 'target:', target);
    console.log('[Language Debug - Translation Comparison] original:', JSON.stringify(text), 'translated:', JSON.stringify(translatedText), 'areEqual:', text.toLowerCase() === translatedText.toLowerCase());
    const resolvedSource =
      requestedSource === 'auto'
        ? (detectedSource ?? null)
        : requestedSource;
    console.log('[Language Debug - Resolved] resolvedSource:', resolvedSource);

    // Log detected language for debugging auto-detect issues
    if (requestedSource === 'auto') {
      console.log('[Auto-detect Debug]', {
        rawDetected: detectedSource,
        normalizedDetected: detectedSource ? normalizeLanguageCode(detectedSource) : 'N/A',
        targetLanguage: target,
        normalizedTarget: normalizeLanguageCode(target),
        isSameLanguage: detectedSource ? normalizeLanguageCode(detectedSource) === normalizeLanguageCode(target) : 'N/A',
      });
    }

    // Prevent false same-language match when auto-detect incorrectly returns target language
    if (requestedSource === 'auto' && detectedSource) {
      const normalizedDetected = normalizeLanguageCode(detectedSource);
      const normalizedTarget = normalizeLanguageCode(target);
      if (normalizedDetected === normalizedTarget) {
        console.warn('[Auto-detect Warning] Detected language matches target language - forcing translation to proceed');
        // Don't skip translation - let the API handle it even if detected == target
      }
    }

    // Check if translation returned original text unchanged (indicates same-language issue)
    const isUnchanged = translatedText.toLowerCase() === text.toLowerCase();
    console.log('[Language Debug - Unchanged Check] isUnchanged:', isUnchanged, 'requestedSource:', requestedSource);
    if (requestedSource === 'auto' && isUnchanged) {
      console.warn('[Auto-detect Warning] Translation returned original text unchanged - likely detected language matches target');
      console.log('[Language Debug] Original detectedSource from API:', detectedSource);
      // Force a retry with explicit source language if we have a page language hint
      if (request.pageLanguage && request.pageLanguage !== target) {
        console.log('[Auto-detect Retry] Retrying with explicit source from page language:', request.pageLanguage);
        const retrySource = toMyMemoryLang(request.pageLanguage);
        const retryResult = await fetchMyMemoryTranslation(text, retrySource, targetParam, myMemoryEmail);
        if (retryResult.translatedText.toLowerCase() !== text.toLowerCase()) {
          console.log('[Language Debug] Retry succeeded - using detectedSource from original API response:', detectedSource);
          return {
            translatedText: retryResult.translatedText,
            detectedSourceLanguage: detectedSource ?? request.pageLanguage,
            targetLanguage: target,
            provider: this.name,
            cached: false,
            partOfSpeech: null,
            definition: null,
            synonyms: [],
            antonyms: [],
            exampleSentences: [],
          };
        }
      }
    }

    const enrichment =
      requestedSource === 'auto'
        ? null
        : await fetchDictionaryEnrichment(text, requestedSource, target, translatedText);

    const result = {
      translatedText,
      detectedSourceLanguage: resolvedSource,
      targetLanguage: target,
      provider: this.name,
      cached: false,
      partOfSpeech: enrichment?.partOfSpeech ?? null,
      definition: enrichment?.definition ?? null,
      synonyms: enrichment?.synonyms ?? [],
      antonyms: enrichment?.antonyms ?? [],
      exampleSentences: enrichment?.exampleSentences ?? [],
    };
    console.log('[Language Debug - Final Result] detectedSourceLanguage:', result.detectedSourceLanguage, 'targetLanguage:', result.targetLanguage);
    return result;
  }
}

async function fetchMyMemoryTranslation(
  text: string,
  source: string,
  target: string,
  myMemoryEmail?: string,
): Promise<{ translatedText: string; detectedSource?: string }> {
  // Never send 'autodetect' or 'auto' to MyMemory - it rejects it with 403 error
  // This is a defensive check - toMyMemoryLang should already prevent this
  if (source === 'auto' || source === 'autodetect') {
    throw new Error('fetchMyMemoryTranslation should never be called with auto/autodetect source');
  }
  
  const sourceParam = source;
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceParam}|${target}`,
  });

  const email = myMemoryEmail?.trim();
  if (email) {
    params.set('de', email);
  }

  let response: Response;
  try {
    response = await fetch(`${MYMEMORY_ENDPOINT}?${params.toString()}`);
  } catch {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  if (!response.ok) {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  let data: MyMemoryResponse;
  try {
    data = (await response.json()) as MyMemoryResponse;
  } catch {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  // DEBUG: Log full raw API response to see actual structure
  console.log('[MyMemory API Raw Response]', JSON.stringify(data, null, 2));

  if (data.responseStatus === 403) {
    // Check if this is the specific "PLEASE SELECT TWO DISTINCT LANGUAGES" error
    if (data.responseDetails?.includes('PLEASE SELECT TWO DISTINCT LANGUAGES')) {
      throw translationError(
        'INVALID_REQUEST',
        'Could not detect language automatically — please select the source language manually.',
      );
    }
    throw translationError(
      'RATE_LIMITED',
      'Daily free translation limit reached — resets at midnight. Add your email in Settings for a higher limit.',
    );
  }

  if (data.responseStatus !== 200) {
    const detail = data.responseDetails ?? 'Translation failed. Please try again.';
    throw translationError('API_FAILURE', detail);
  }

  const translatedText = data.responseData?.translatedText?.trim();
  if (!translatedText) {
    throw translationError('API_FAILURE', 'Translation failed. Please try again.');
  }

  const detectedSource =
    source === 'auto' && data.matches?.[0]?.source
      ? normalizeLanguageCode(data.matches[0].source)
      : undefined;

  return { translatedText, detectedSource };
}

function getEnglishLookupWord(
  text: string,
  source: string,
  target: string,
  translatedText: string,
): string | null {
  if (!isSingleWord(text)) return null;
  if (source === 'en') return text;
  if (target === 'en' && isSingleWord(translatedText)) return translatedText;
  return null;
}

async function fetchDictionaryEnrichment(
  text: string,
  source: string,
  target: string,
  translatedText: string,
): Promise<DictionaryEnrichment | null> {
  const word = getEnglishLookupWord(text, source, target, translatedText);
  if (!word) return null;

  try {
    const response = await fetch(`${DICTIONARY_ENDPOINT}/${encodeURIComponent(word.toLowerCase())}`);
    if (response.status === 404) return null;
    if (!response.ok) return null;

    const entries = (await response.json()) as DictionaryEntry[];
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const definitions: string[] = [];
    const synonyms = new Set<string>();
    const antonyms = new Set<string>();
    const examples: string[] = [];
    let partOfSpeech: string | null = null;

    for (const entry of entries) {
      for (const meaning of entry.meanings ?? []) {
        if (!partOfSpeech && meaning.partOfSpeech) {
          partOfSpeech = meaning.partOfSpeech;
        }

        for (const def of meaning.definitions ?? []) {
          if (def.definition && definitions.length < 3) {
            definitions.push(def.definition);
          }
          if (def.example && examples.length < 3) {
            examples.push(def.example);
          }
          for (const syn of def.synonyms ?? []) {
            if (synonyms.size < 8) synonyms.add(syn);
          }
          for (const ant of def.antonyms ?? []) {
            if (antonyms.size < 8) antonyms.add(ant);
          }
        }
      }
    }

    if (definitions.length === 0 && synonyms.size === 0 && antonyms.size === 0 && examples.length === 0) {
      return null;
    }

    return {
      partOfSpeech,
      definition: definitions.length > 0 ? definitions.join(' · ') : null,
      synonyms: [...synonyms],
      antonyms: [...antonyms],
      exampleSentences: examples,
    };
  } catch {
    return null;
  }
}

/** Mock provider for development and tests. */
export class MockTranslationProvider implements TranslationProvider {
  readonly name = 'mock';

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    await delay(300 + Math.random() * 400);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw translationError('OFFLINE', 'You appear to be offline.');
    }

    const text = request.text.trim();
    if (!text) {
      throw translationError('INVALID_REQUEST', 'No text provided for translation.');
    }

    if (text.length > 5000) {
      throw translationError('RATE_LIMITED', 'Text exceeds maximum length (5000 characters).');
    }

    const detected = resolveSourceLanguage(
      request.sourceLanguage ?? 'auto',
      request.pageLanguage,
    );

    return {
      translatedText: `[${request.targetLanguage}] ${text}`,
      detectedSourceLanguage: detected,
      targetLanguage: request.targetLanguage,
      provider: this.name,
      cached: false,
      partOfSpeech: null,
      definition: null,
      synonyms: [],
      antonyms: [],
      exampleSentences: [],
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function translationError(
  code: import('@/types').TranslationErrorCode,
  message: string,
): Error & { code: import('@/types').TranslationErrorCode } {
  const err = new Error(message) as Error & { code: import('@/types').TranslationErrorCode };
  err.code = code;
  return err;
}

export function isTranslationError(
  error: unknown,
): error is Error & { code: import('@/types').TranslationErrorCode } {
  return error instanceof Error && 'code' in error && typeof (error as { code: unknown }).code === 'string';
}

export const defaultTranslationProvider: TranslationProvider = new MyMemoryTranslationProvider();

/**
 * Google Translate provider (requires API key).
 * Note: This is a placeholder - Google Translate API requires proper authentication.
 */
export class GoogleTranslateProvider implements TranslationProvider {
  readonly name = 'google';

  async translate(_request: TranslationRequest, _myMemoryEmail?: string): Promise<TranslationResult> {
    // Placeholder implementation - requires Google Cloud Translation API key
    throw translationError('MISSING_API_KEY', 'Google Translate provider requires API key configuration.');
  }
}

/**
 * Fallback chain provider that tries multiple providers in sequence.
 * If the primary provider fails, it falls back to secondary providers.
 */
export class FallbackTranslationProvider implements TranslationProvider {
  readonly name = 'fallback';
  private providers: TranslationProvider[];

  constructor(providers: TranslationProvider[]) {
    if (providers.length === 0) {
      throw new Error('Fallback provider requires at least one provider');
    }
    this.providers = providers;
  }

  async translate(request: TranslationRequest, myMemoryEmail?: string): Promise<TranslationResult> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        const result = await provider.translate(request, myMemoryEmail);
        // Mark which provider succeeded
        return { ...result, provider: `${provider.name} (via fallback)` };
      } catch (error) {
        if (isTranslationError(error)) {
          errors.push(error);
          // Retry with next provider on rate limit or API failure
          if (error.code === 'RATE_LIMITED' || error.code === 'API_FAILURE') {
            continue;
          }
          // Don't retry on client errors
          throw error;
        }
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // All providers failed
    throw translationError(
      'API_FAILURE',
      `All translation providers failed: ${errors.map(e => e.message).join(', ')}`,
    );
  }
}

/**
 * Create a fallback chain with MyMemory as primary and Mock as fallback.
 * To use real providers, replace MockTranslationProvider with configured providers.
 */
export function createFallbackProvider(): TranslationProvider {
  return new FallbackTranslationProvider([
    new MyMemoryTranslationProvider(),
    new MockTranslationProvider(), // Fallback for development/testing
  ]);
}
