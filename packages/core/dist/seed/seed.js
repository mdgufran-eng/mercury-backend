"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSeed = runSeed;
const connection_js_1 = require("../db/connection.js");
const Collections = __importStar(require("../db/collections.js"));
const indexes_js_1 = require("../db/indexes.js");
const CUSTOMERS = [
    { customerId: 6740, name: 'HUMAN', type: 'HUMAN', createdAt: new Date() },
    { customerId: 14716606, name: 'MACHINE', type: 'MACHINE', createdAt: new Date() },
    { customerId: 37376304, name: 'Payload', type: 'PAYLOAD', createdAt: new Date() },
];
const MACHINE_TEMPLATES = [
    { templateId: 15713574, lang: 'de' },
    { templateId: 14757570, lang: 'fr' },
    { templateId: 15713599, lang: 'it' },
    { templateId: 15713587, lang: 'es' },
    { templateId: 15713655, lang: 'nl' },
    { templateId: 15243113, lang: 'pt' },
    { templateId: 29346477, lang: 'pl' },
    { templateId: 29346499, lang: 'ru' },
    { templateId: 29346488, lang: 'ro' },
    { templateId: 29346539, lang: 'tr' },
    { templateId: 30926064, lang: 'no' },
    { templateId: 30926113, lang: 'sv' },
    { templateId: 30926039, lang: 'da' },
    { templateId: 155018068, lang: 'ja' },
    { templateId: 155018251, lang: 'ko' },
    { templateId: 155017715, lang: 'zh_hans' },
    { templateId: 201210023, lang: 'cs' },
    { templateId: 201210238, lang: 'sk' },
    { templateId: 201210367, lang: 'el' },
    { templateId: 201210413, lang: 'hu' },
];
const HUMAN_TEMPLATES = [
    { templateId: 4109587, lang: 'id' },
    { templateId: 18597, lang: 'it' },
    { templateId: 17400, lang: 'es' },
    { templateId: 30526609, lang: 'no' },
    { templateId: 29346457, lang: 'ru' },
    { templateId: 29346448, lang: 'ro' },
    { templateId: 62020, lang: 'nl' },
    { templateId: 20345, lang: 'fr' },
    { templateId: 30526514, lang: 'sv' },
    { templateId: 13393, lang: 'de' },
    { templateId: 33395, lang: 'pt' },
    { templateId: 2637096, lang: 'pl' },
    { templateId: 30526400, lang: 'da' },
    { templateId: 29346466, lang: 'tr' },
    { templateId: 155018326, lang: 'ja' },
    { templateId: 155018307, lang: 'ko' },
    { templateId: 155018345, lang: 'zh_hans' },
    { templateId: 201210350, lang: 'cs' },
    { templateId: 201210399, lang: 'sk' },
    { templateId: 201206988, lang: 'el' },
    { templateId: 201204284, lang: 'hu' },
];
const FREELANCER_LANGUAGES = [
    'de', 'fr', 'it', 'es', 'nl', 'pt', 'pl', 'ru', 'ro', 'tr',
    'no', 'sv', 'da', 'id', 'ja', 'ko', 'zh_hans', 'cs', 'sk', 'el', 'hu',
];
async function runSeed(db) {
    await (0, indexes_js_1.createIndexes)(db);
    const customerCol = Collections.customers(db);
    for (const c of CUSTOMERS) {
        await customerCol.updateOne({ customerId: c.customerId }, { $set: c }, { upsert: true });
    }
    const templateCol = Collections.templates(db);
    for (const t of MACHINE_TEMPLATES) {
        const tmpl = {
            templateId: t.templateId,
            name: `MACHINE-EN-${t.lang.toUpperCase()}`,
            sourceLanguage: 'EN',
            targetLanguage: t.lang,
            method: 'MACHINE',
            createdAt: new Date(),
        };
        await templateCol.updateOne({ templateId: t.templateId }, { $set: tmpl }, { upsert: true });
    }
    for (const t of HUMAN_TEMPLATES) {
        const tmpl = {
            templateId: t.templateId,
            name: `HUMAN-EN-${t.lang.toUpperCase()}`,
            sourceLanguage: 'EN',
            targetLanguage: t.lang,
            method: 'HUMAN',
            createdAt: new Date(),
        };
        await templateCol.updateOne({ templateId: t.templateId }, { $set: tmpl }, { upsert: true });
    }
    const freelancerCol = Collections.freelancers(db);
    for (let i = 0; i < FREELANCER_LANGUAGES.length; i++) {
        const lang = FREELANCER_LANGUAGES[i];
        const freelancer = {
            freelancerId: 9000000 + i + 1,
            name: `LLM-${lang.toUpperCase()}`,
            email: `llm-${lang}@mercury.internal`,
            languages: [lang],
            ratePerWord: 0.05,
            currency: 'USD',
            createdAt: new Date(),
        };
        await freelancerCol.updateOne({ freelancerId: freelancer.freelancerId }, { $set: freelancer }, { upsert: true });
    }
    console.log('Seed complete: customers, templates, freelancers upserted.');
}
if (process.argv[1] && process.argv[1].includes('seed')) {
    (0, connection_js_1.connectMongo)()
        .then((db) => runSeed(db))
        .then(() => process.exit(0))
        .catch((err) => {
        console.error('Seed failed:', err);
        process.exit(1);
    });
}
