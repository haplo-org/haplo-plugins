/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.onInstall = function() {
    O.query().link(T.Language, A.Type).execute().each((language) => {
        const mLanguage = language.mutableCopy();
        const behaviour = language.ref.getBehaviourExactMaybe();
        // Behaviours are of the form haplo:list:language:[code]:[name]
        const threeDigitCode = behaviour.split(":")[3];
        const twoDigitCode = threeDigitToTwoDigitCodes[threeDigitCode];

        const threeDigitText = O.text(O.T_TEXT, threeDigitCode);
        if(!mLanguage.has(threeDigitText, A.LanguageCode)) {
            mLanguage.append(threeDigitText, A.LanguageCode);
        }

        // Some languages don't have a two digit code as 3 digit codes
        const twoDigitText = twoDigitCode ? O.text(O.T_TEXT, twoDigitCode) : undefined;
        if(twoDigitText && !mLanguage.has(twoDigitText, A.LanguageCode)) {
            mLanguage.append(twoDigitText, A.LanguageCode);
        }
        if(!language.valuesEqual(mLanguage)) {
            mLanguage.save();
        }
    });
};

P.implementService("haplo:languages:get_code_to_behaviour_map", function() {
    const map = {};
    O.query().link(T.Language, A.Type).execute().each((language) => {
        const behaviour = language.ref.getBehaviourExactMaybe();
        const threeCharCode = behaviour.split(":")[3];
        const twoCharCode = threeDigitToTwoDigitCodes[threeCharCode];
        map[threeCharCode] = behaviour;
        if(twoCharCode) {
            map[twoCharCode] = behaviour;
        }
    });
    return map;
});

// Generated from the ISO-639.2 table available at iso.org
var threeDigitToTwoDigitCodes = {
    "aar": "aa",
    "abk": "ab",
    "ace": "",
    "ach": "",
    "ada": "",
    "ady": "",
    "afa": "",
    "afh": "",
    "afr": "af",
    "ain": "",
    "aka": "ak",
    "akk": "",
    "alb": "sq",
    "ale": "",
    "alg": "",
    "alt": "",
    "amh": "am",
    "ang": "",
    "anp": "",
    "apa": "",
    "ara": "ar",
    "arc": "",
    "arg": "an",
    "arm": "hy",
    "arn": "",
    "arp": "",
    "art": "",
    "arw": "",
    "asm": "as",
    "ast": "",
    "ath": "",
    "aus": "",
    "ava": "av",
    "ave": "ae",
    "awa": "",
    "aym": "ay",
    "aze": "az",
    "bad": "",
    "bai": "",
    "bak": "ba",
    "bal": "",
    "bam": "bm",
    "ban": "",
    "baq": "eu",
    "bas": "",
    "bat": "",
    "bej": "",
    "bel": "be",
    "bem": "",
    "ben": "bn",
    "ber": "",
    "bho": "",
    "bih": "bh",
    "bik": "",
    "bin": "",
    "bis": "bi",
    "bla": "",
    "bnt": "",
    "bos": "bs",
    "bra": "",
    "bre": "br",
    "btk": "",
    "bua": "",
    "bug": "",
    "bul": "bg",
    "bur": "my",
    "byn": "",
    "cad": "",
    "cai": "",
    "car": "",
    "cat": "ca",
    "cau": "",
    "ceb": "",
    "cel": "",
    "cha": "ch",
    "chb": "",
    "che": "ce",
    "chg": "",
    "chi": "zh",
    "chk": "",
    "chm": "",
    "chn": "",
    "cho": "",
    "chp": "",
    "chr": "",
    "chu": "cu",
    "chv": "cv",
    "chy": "",
    "cmc": "",
    "cnr": "",
    "cop": "",
    "cor": "kw",
    "cos": "co",
    "cpe": "",
    "cpf": "",
    "cpp": "",
    "cre": "cr",
    "crh": "",
    "crp": "",
    "csb": "",
    "cus": "",
    "cze": "cs",
    "dak": "",
    "dan": "da",
    "dar": "",
    "day": "",
    "del": "",
    "den": "",
    "dgr": "",
    "din": "",
    "div": "dv",
    "doi": "",
    "dra": "",
    "dsb": "",
    "dua": "",
    "dum": "",
    "dut": "nl",
    "dyu": "",
    "dzo": "dz",
    "efi": "",
    "egy": "",
    "eka": "",
    "elx": "",
    "eng": "en",
    "enm": "",
    "epo": "eo",
    "est": "et",
    "ewe": "ee",
    "ewo": "",
    "fan": "",
    "fao": "fo",
    "fat": "",
    "fij": "fj",
    "fil": "",
    "fin": "fi",
    "fiu": "",
    "fon": "",
    "fre": "fr",
    "frm": "",
    "fro": "",
    "frr": "",
    "frs": "",
    "fry": "fy",
    "ful": "ff",
    "fur": "",
    "gaa": "",
    "gay": "",
    "gba": "",
    "gem": "",
    "geo": "ka",
    "ger": "de",
    "gez": "",
    "gil": "",
    "gla": "gd",
    "gle": "ga",
    "glg": "gl",
    "glv": "gv",
    "gmh": "",
    "goh": "",
    "gon": "",
    "gor": "",
    "got": "",
    "grb": "",
    "grc": "",
    "gre": "el",
    "grn": "gn",
    "gsw": "",
    "guj": "gu",
    "gwi": "",
    "hai": "",
    "hat": "ht",
    "hau": "ha",
    "haw": "",
    "heb": "he",
    "her": "hz",
    "hil": "",
    "him": "",
    "hin": "hi",
    "hit": "",
    "hmn": "",
    "hmo": "ho",
    "hrv": "hr",
    "hsb": "",
    "hun": "hu",
    "hup": "",
    "iba": "",
    "ibo": "ig",
    "ice": "is",
    "ido": "io",
    "iii": "ii",
    "ijo": "",
    "iku": "iu",
    "ile": "ie",
    "ilo": "",
    "ina": "ia",
    "inc": "",
    "ind": "id",
    "ine": "",
    "inh": "",
    "ipk": "ik",
    "ira": "",
    "iro": "",
    "ita": "it",
    "jav": "jv",
    "jbo": "",
    "jpn": "ja",
    "jpr": "",
    "jrb": "",
    "kaa": "",
    "kab": "",
    "kac": "",
    "kal": "kl",
    "kam": "",
    "kan": "kn",
    "kar": "",
    "kas": "ks",
    "kau": "kr",
    "kaw": "",
    "kaz": "kk",
    "kbd": "",
    "kha": "",
    "khi": "",
    "khm": "km",
    "kho": "",
    "kik": "ki",
    "kin": "rw",
    "kir": "ky",
    "kmb": "",
    "kok": "",
    "kom": "kv",
    "kon": "kg",
    "kor": "ko",
    "kos": "",
    "kpe": "",
    "krc": "",
    "krl": "",
    "kro": "",
    "kru": "",
    "kua": "kj",
    "kum": "",
    "kur": "ku",
    "kut": "",
    "lad": "",
    "lah": "",
    "lam": "",
    "lao": "lo",
    "lat": "la",
    "lav": "lv",
    "lez": "",
    "lim": "li",
    "lin": "ln",
    "lit": "lt",
    "lol": "",
    "loz": "",
    "ltz": "lb",
    "lua": "",
    "lub": "lu",
    "lug": "lg",
    "lui": "",
    "lun": "",
    "luo": "",
    "lus": "",
    "mac": "mk",
    "mad": "",
    "mag": "",
    "mah": "mh",
    "mai": "",
    "mak": "",
    "mal": "ml",
    "man": "",
    "mao": "mi",
    "map": "",
    "mar": "mr",
    "mas": "",
    "may": "ms",
    "mdf": "",
    "mdr": "",
    "men": "",
    "mga": "",
    "mic": "",
    "min": "",
    "mis": "",
    "mkh": "",
    "mlg": "mg",
    "mlt": "mt",
    "mnc": "",
    "mni": "",
    "mno": "",
    "moh": "",
    "mon": "mn",
    "mos": "",
    "mul": "",
    "mun": "",
    "mus": "",
    "mwl": "",
    "mwr": "",
    "myn": "",
    "myv": "",
    "nah": "",
    "nai": "",
    "nap": "",
    "nau": "na",
    "nav": "nv",
    "nbl": "nr",
    "nde": "nd",
    "ndo": "ng",
    "nds": "",
    "nep": "ne",
    "new": "",
    "nia": "",
    "nic": "",
    "niu": "",
    "nno": "nn",
    "nob": "nb",
    "nog": "",
    "non": "",
    "nor": "no",
    "nqo": "",
    "nso": "",
    "nub": "",
    "nwc": "",
    "nya": "ny",
    "nym": "",
    "nyn": "",
    "nyo": "",
    "nzi": "",
    "oci": "oc",
    "oji": "oj",
    "ori": "or",
    "orm": "om",
    "osa": "",
    "oss": "os",
    "ota": "",
    "oto": "",
    "paa": "",
    "pag": "",
    "pal": "",
    "pam": "",
    "pan": "pa",
    "pap": "",
    "pau": "",
    "peo": "",
    "per": "fa",
    "phi": "",
    "phn": "",
    "pli": "pi",
    "pol": "pl",
    "pon": "",
    "por": "pt",
    "pra": "",
    "pro": "",
    "pus": "ps",
    "qaaqtz": "",
    "que": "qu",
    "raj": "",
    "rap": "",
    "rar": "",
    "roa": "",
    "roh": "rm",
    "rom": "",
    "rum": "ro",
    "run": "rn",
    "rup": "",
    "rus": "ru",
    "sad": "",
    "sag": "sg",
    "sah": "",
    "sai": "",
    "sal": "",
    "sam": "",
    "san": "sa",
    "sas": "",
    "sat": "",
    "scn": "",
    "sco": "",
    "sel": "",
    "sem": "",
    "sga": "",
    "sgn": "",
    "shn": "",
    "sid": "",
    "sin": "si",
    "sio": "",
    "sit": "",
    "sla": "",
    "slo": "sk",
    "slv": "sl",
    "sma": "",
    "sme": "se",
    "smi": "",
    "smj": "",
    "smn": "",
    "smo": "sm",
    "sms": "",
    "sna": "sn",
    "snd": "sd",
    "snk": "",
    "sog": "",
    "som": "so",
    "son": "",
    "sot": "st",
    "spa": "es",
    "srd": "sc",
    "srn": "",
    "srp": "sr",
    "srr": "",
    "ssa": "",
    "ssw": "ss",
    "suk": "",
    "sun": "su",
    "sus": "",
    "sux": "",
    "swa": "sw",
    "swe": "sv",
    "syc": "",
    "syr": "",
    "tah": "ty",
    "tai": "",
    "tam": "ta",
    "tat": "tt",
    "tel": "te",
    "tem": "",
    "ter": "",
    "tet": "",
    "tgk": "tg",
    "tgl": "tl",
    "tha": "th",
    "tib": "bo",
    "tig": "",
    "tir": "ti",
    "tiv": "",
    "tkl": "",
    "tlh": "",
    "tli": "",
    "tmh": "",
    "tog": "",
    "ton": "to",
    "tpi": "",
    "tsi": "",
    "tsn": "tn",
    "tso": "ts",
    "tuk": "tk",
    "tum": "",
    "tup": "",
    "tur": "tr",
    "tut": "",
    "tvl": "",
    "twi": "tw",
    "tyv": "",
    "udm": "",
    "uga": "",
    "uig": "ug",
    "ukr": "uk",
    "umb": "",
    "und": "",
    "urd": "ur",
    "uzb": "uz",
    "vai": "",
    "ven": "ve",
    "vie": "vi",
    "vol": "vo",
    "vot": "",
    "wak": "",
    "wal": "",
    "war": "",
    "was": "",
    "wel": "cy",
    "wen": "",
    "wln": "wa",
    "wol": "wo",
    "xal": "",
    "xho": "xh",
    "yao": "",
    "yap": "",
    "yid": "yi",
    "yor": "yo",
    "ypk": "",
    "zap": "",
    "zbl": "",
    "zen": "",
    "zgh": "",
    "zha": "za",
    "znd": "",
    "zul": "zu",
    "zun": "",
    "zxx": "",
    "zza": ""
};
