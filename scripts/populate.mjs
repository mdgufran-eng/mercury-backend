#!/usr/bin/env node
/**
 * populate.mjs — seeds the DB and creates realistic projects + files
 * mimicking exactly how rosetta calls Babel's XTM-compatible API.
 *
 * Usage: node scripts/populate.mjs
 * Requires Node 18+ (native fetch + FormData)
 */

const BASE = 'http://localhost:3000';
const XTM  = `${BASE}/project-manager-api-rest/projects`;

// ── Rosetta-style JSON payload ─────────────────────────────────────────────────
function makeFile(filename, content, metadata) {
  return { filename, body: JSON.stringify({ content, metadata }) };
}

// ── Projects to create (mirrors real rosetta createProject calls) ─────────────
const PROJECTS = [
  {
    name: '12345 - Eiffel Tower Tour Group Content - ES',
    customerId: 14716606,   // MACHINE customer
    templateId: 15713587,   // MACHINE ES
    referenceId: 'EXP-12345',
    files: [
      makeFile('12345 - Tour Group Content - ES.json',
        {
          title: 'Eiffel Tower Guided Tour',
          description: 'Skip the line and enjoy a fully guided tour of the iconic Eiffel Tower with stunning panoramic views of Paris.',
          highlights: ['Skip-the-line access', 'Expert English guide', 'Panoramic views from the top'],
          inclusions: 'Entrance ticket, Audio guide, Hotel pickup',
          exclusions: 'Gratuities, Meals, Transport',
        },
        { experienceId: 12345, cityCode: 'paris', variant: 'group', lang: 'es' }
      ),
      makeFile('12345 - Variant Content - VarID - 98731 - ES.json',
        {
          variantTitle: 'Private Eiffel Tower Tour',
          variantDescription: 'Exclusive private tour for up to 6 guests.',
          duration: '2 hours',
          maxGroupSize: 6,
        },
        { experienceId: 12345, variantId: 98731, cityCode: 'paris', lang: 'es' }
      ),
    ],
  },
  {
    name: '67890 - Colosseum Fast Track - DE',
    customerId: 14716606,
    templateId: 15713574,   // MACHINE DE
    referenceId: 'EXP-67890',
    files: [
      makeFile('67890 - Tour Group Content - DE.json',
        {
          title: 'Colosseum Fast Track Entry',
          description: 'Explore the ancient Roman Colosseum with fast-track entry and an expert local guide.',
          highlights: ['Fast-track entry', 'Certified guide', 'Access to the Arena floor'],
          inclusions: 'Fast-track ticket, Guide, Forum entry',
          exclusions: 'Underground and Attic areas (upgrade available)',
        },
        { experienceId: 67890, cityCode: 'rome', variant: 'standard', lang: 'de' }
      ),
      makeFile('67890 - Variant Content - VarID - 103662 - DE.json',
        {
          variantTitle: 'Colosseum Underground & Arena Floor',
          variantDescription: 'Exclusive access to the underground chambers and original Arena floor.',
          duration: '3 hours',
          maxGroupSize: 15,
        },
        { experienceId: 67890, variantId: 103662, cityCode: 'rome', lang: 'de' }
      ),
      makeFile('67890 - Variant Content - VarID - 103663 - DE.json',
        {
          variantTitle: 'Colosseum at Sunset',
          variantDescription: 'Experience the Colosseum bathed in golden evening light.',
          duration: '2.5 hours',
          maxGroupSize: 20,
        },
        { experienceId: 67890, variantId: 103663, cityCode: 'rome', lang: 'de' }
      ),
    ],
  },
  {
    name: '24601 - Sagrada Familia Skip The Line - FR',
    customerId: 14716606,
    templateId: 14757570,   // MACHINE FR
    referenceId: 'EXP-24601',
    files: [
      makeFile('24601 - Tour Group Content - FR.json',
        {
          title: 'Sagrada Familia: Guided Tour with Tower Access',
          description: "Discover Gaudí's masterpiece with a guided tour and access to the towers for breathtaking views of Barcelona.",
          highlights: ['Skip-the-line tickets', 'Expert guide', 'Tower access included'],
          inclusions: 'Entry ticket, Tower lift, Audio guide',
          exclusions: 'Hotel transfers, Meals',
        },
        { experienceId: 24601, cityCode: 'barcelona', variant: 'towers', lang: 'fr' }
      ),
    ],
  },
  {
    name: '99001 - Tokyo Teamlab Borderless - JA',
    customerId: 6740,       // HUMAN customer
    templateId: 155018326,  // HUMAN JA
    referenceId: 'EXP-99001',
    files: [
      makeFile('99001 - Tour Group Content - JA.json',
        {
          title: 'teamLab Borderless Tokyo: Entry Ticket',
          description: 'Immerse yourself in a world of borderless art at the teamLab Borderless digital art museum in Tokyo.',
          highlights: ['World-famous digital art', 'No fixed route', 'Instagram-worthy experience'],
          inclusions: 'Entry ticket',
          exclusions: 'Transport, Food',
        },
        { experienceId: 99001, cityCode: 'tokyo', variant: 'standard', lang: 'ja' }
      ),
      makeFile('99001 - Variant Content - VarID - 200100 - JA.json',
        {
          variantTitle: 'teamLab Borderless + Planets Combo',
          variantDescription: 'Visit both teamLab Borderless and teamLab Planets with one combo ticket.',
          duration: 'Full day',
          maxGroupSize: 999,
        },
        { experienceId: 99001, variantId: 200100, cityCode: 'tokyo', lang: 'ja' }
      ),
    ],
  },
  {
    name: '55432 - NYC Central Park Bike Tour - IT',
    customerId: 14716606,
    templateId: 15713599,   // MACHINE IT
    referenceId: 'EXP-55432',
    files: [
      makeFile('55432 - Tour Group Content - IT.json',
        {
          title: 'Central Park Bike Tour',
          description: 'Explore the best of Central Park on a guided bike tour with an expert local guide.',
          highlights: ['Bike rental included', 'Expert guide', 'See 40+ landmarks'],
          inclusions: 'Bike, Helmet, Guide',
          exclusions: 'Gratuities',
        },
        { experienceId: 55432, cityCode: 'new-york', variant: 'standard', lang: 'it' }
      ),
    ],
  },
];

// ── POST one project via rosetta-style multipart form-data ────────────────────
async function createProject(proj) {
  const form = new FormData();
  form.append('customerId', String(proj.customerId));
  form.append('name', proj.name);
  form.append('templateId', String(proj.templateId));
  if (proj.referenceId) form.append('referenceId', proj.referenceId);

  for (let i = 0; i < proj.files.length; i++) {
    const f = proj.files[i];
    form.append(
      `files[${i}].file`,
      new Blob([f.body], { type: 'application/octet-stream' }),
      f.filename,
    );
  }

  const res = await fetch(XTM, { method: 'POST', body: form });
  const body = await res.json();

  if (!res.ok) {
    console.error(`  ✗ Failed (${res.status}):`, JSON.stringify(body).slice(0, 120));
    return null;
  }

  console.log(`  ✓ projectId=${body.projectId}  jobs=${body.jobs?.length ?? 0}  "${proj.name}"`);
  return body;
}

async function activateProject(projectId) {
  const res = await fetch(`${XTM}/${projectId}/activate`, { method: 'POST' });
  if (res.ok) console.log(`  ✓ activated ${projectId}`);
}

// ── Run seed via core package directly ────────────────────────────────────────
async function runSeed() {
  const { connectMongo, runSeed } = await import('../packages/core/dist/index.js');
  const db = await connectMongo(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/mercury');
  await runSeed(db);
  console.log('✓ Seed complete');
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n── Mercury Populate ──────────────────────────────────────');

  try {
    await runSeed();
  } catch (e) {
    console.warn('Seed warning (may already be seeded):', e.message);
  }

  console.log('\nCreating projects via XTM API (as rosetta would)…');
  for (const proj of PROJECTS) {
    console.log(`\n→ ${proj.name}`);
    const result = await createProject(proj);
    if (result?.projectId) {
      await activateProject(result.projectId);
    }
  }

  console.log('\n── Done ──────────────────────────────────────────────────\n');
  process.exit(0);
})();
