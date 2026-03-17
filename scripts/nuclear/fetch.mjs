#!/usr/bin/env node

/**
 * Nuclear Facilities Dataset Generator
 *
 * Curated worldwide dataset of nuclear facilities — reactors, weapons labs,
 * test sites, enrichment plants, research centers, and decommissioned sites.
 *
 * Usage:
 *   node scripts/nuclear/fetch.mjs --out public/data/nuclear-facilities.json
 *
 * Source: IAEA PRIS, NRC, public government records, and open datasets.
 * Coordinates verified against Google Maps / OpenStreetMap.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// ─── CLI ────────────────────────────────────────────────────────────

function parseArgs () {
  const args = process.argv.slice(2)
  let out = ''
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') out = args[++i] || ''
  }
  if (!out) {
    console.error('Usage: node scripts/nuclear/fetch.mjs --out <path>')
    process.exit(1)
  }
  return { out }
}

// ─── Facility types ─────────────────────────────────────────────────
// reactor, weapons_lab, test_site, enrichment, research, reprocessing, storage, decommissioned

// ─── Dataset ────────────────────────────────────────────────────────
// Each entry: [name, type, status, country, lat, lng]
// status: operational | decommissioned | shutdown | under_construction

const RAW = [
  // ── United States ────────────────────────────────────────────────
  ['Palo Verde Nuclear Generating Station', 'reactor', 'operational', 'USA', 33.3886, -112.8617],
  ['Diablo Canyon Power Plant', 'reactor', 'operational', 'USA', 35.2112, -120.8548],
  ['San Onofre Nuclear Generating Station', 'reactor', 'decommissioned', 'USA', 33.3682, -117.5570],
  ['Indian Point Energy Center', 'reactor', 'decommissioned', 'USA', 41.2698, -73.9523],
  ['Three Mile Island', 'reactor', 'decommissioned', 'USA', 40.1531, -76.7253],
  ['Calvert Cliffs Nuclear Power Plant', 'reactor', 'operational', 'USA', 38.4346, -76.4417],
  ['South Texas Nuclear Generating Station', 'reactor', 'operational', 'USA', 28.7959, -96.0489],
  ['Vogtle Electric Generating Plant', 'reactor', 'operational', 'USA', 33.1423, -81.7634],
  ['Watts Bar Nuclear Plant', 'reactor', 'operational', 'USA', 35.6033, -84.7883],
  ['Browns Ferry Nuclear Plant', 'reactor', 'operational', 'USA', 34.7042, -87.1186],
  ['Sequoyah Nuclear Plant', 'reactor', 'operational', 'USA', 35.2266, -85.0888],
  ['Comanche Peak Nuclear Power Plant', 'reactor', 'operational', 'USA', 32.2981, -97.7853],
  ['Columbia Generating Station', 'reactor', 'operational', 'USA', 46.4712, -119.3331],
  ['Grand Gulf Nuclear Station', 'reactor', 'operational', 'USA', 32.0070, -91.0483],
  ['Surry Nuclear Power Plant', 'reactor', 'operational', 'USA', 37.1658, -76.6981],
  ['North Anna Nuclear Generating Station', 'reactor', 'operational', 'USA', 38.0608, -77.7898],
  ['Perry Nuclear Power Plant', 'reactor', 'operational', 'USA', 41.8007, -81.1442],
  ['Davis-Besse Nuclear Power Station', 'reactor', 'operational', 'USA', 41.5969, -83.0876],
  ['Limerick Generating Station', 'reactor', 'operational', 'USA', 40.2242, -75.5886],
  ['Peach Bottom Atomic Power Station', 'reactor', 'operational', 'USA', 39.7589, -76.2689],
  // US weapons / research
  ['Los Alamos National Laboratory', 'weapons_lab', 'operational', 'USA', 35.8444, -106.2867],
  ['Lawrence Livermore National Laboratory', 'weapons_lab', 'operational', 'USA', 37.6889, -121.7056],
  ['Sandia National Laboratories', 'weapons_lab', 'operational', 'USA', 35.0586, -106.5375],
  ['Oak Ridge National Laboratory', 'research', 'operational', 'USA', 35.9308, -84.3106],
  ['Idaho National Laboratory', 'research', 'operational', 'USA', 43.5152, -112.9305],
  ['Hanford Site', 'reprocessing', 'decommissioned', 'USA', 46.5508, -119.4888],
  ['Savannah River Site', 'reprocessing', 'operational', 'USA', 33.3483, -81.7389],
  ['Pantex Plant', 'weapons_lab', 'operational', 'USA', 35.3172, -101.9558],
  ['Y-12 National Security Complex', 'weapons_lab', 'operational', 'USA', 35.9847, -84.2536],
  ['Nevada National Security Site', 'test_site', 'decommissioned', 'USA', 37.0000, -116.0500],
  ['Yucca Mountain', 'storage', 'shutdown', 'USA', 36.8386, -116.4258],
  ['Portsmouth Gaseous Diffusion Plant', 'enrichment', 'decommissioned', 'USA', 38.9939, -83.2289],
  ['Paducah Gaseous Diffusion Plant', 'enrichment', 'decommissioned', 'USA', 37.1097, -88.8089],
  ['URENCO USA (Eunice)', 'enrichment', 'operational', 'USA', 32.4272, -103.3192],
  // ── Russia ───────────────────────────────────────────────────────
  ['Kursk Nuclear Power Plant', 'reactor', 'operational', 'Russia', 51.6714, 35.6025],
  ['Novovoronezh Nuclear Power Plant', 'reactor', 'operational', 'Russia', 51.2722, 39.2139],
  ['Leningrad Nuclear Power Plant', 'reactor', 'operational', 'Russia', 59.8331, 29.0442],
  ['Kalinin Nuclear Power Plant', 'reactor', 'operational', 'Russia', 57.7750, 36.2639],
  ['Balakovo Nuclear Power Plant', 'reactor', 'operational', 'Russia', 52.0917, 47.9550],
  ['Beloyarsk Nuclear Power Plant', 'reactor', 'operational', 'Russia', 56.8422, 61.3219],
  ['Kola Nuclear Power Plant', 'reactor', 'operational', 'Russia', 67.4631, 32.4744],
  ['Rostov Nuclear Power Plant', 'reactor', 'operational', 'Russia', 47.5272, 42.0958],
  ['Smolensk Nuclear Power Plant', 'reactor', 'operational', 'Russia', 54.1508, 33.2275],
  ['Sarov (Arzamas-16)', 'weapons_lab', 'operational', 'Russia', 54.9350, 43.3150],
  ['Snezhinsk (Chelyabinsk-70)', 'weapons_lab', 'operational', 'Russia', 56.0853, 60.7319],
  ['Semipalatinsk Test Site', 'test_site', 'decommissioned', 'Kazakhstan', 50.0700, 78.4300],
  ['Novaya Zemlya Test Site', 'test_site', 'decommissioned', 'Russia', 73.3600, 55.1900],
  ['Mayak Production Association', 'reprocessing', 'operational', 'Russia', 55.7133, 60.7797],
  ['Tomsk-7 (Seversk)', 'enrichment', 'operational', 'Russia', 56.6003, 84.8517],
  // ── France ───────────────────────────────────────────────────────
  ['Gravelines Nuclear Power Plant', 'reactor', 'operational', 'France', 51.0156, 2.1067],
  ['Cattenom Nuclear Power Plant', 'reactor', 'operational', 'France', 49.4061, 6.2192],
  ['Paluel Nuclear Power Plant', 'reactor', 'operational', 'France', 49.8586, 0.6306],
  ['Tricastin Nuclear Power Plant', 'reactor', 'operational', 'France', 44.3308, 4.7317],
  ['Flamanville Nuclear Power Plant', 'reactor', 'operational', 'France', 49.5376, -1.8808],
  ['Fessenheim Nuclear Power Plant', 'reactor', 'decommissioned', 'France', 47.9083, 7.5628],
  ['La Hague Reprocessing Plant', 'reprocessing', 'operational', 'France', 49.6800, -1.8800],
  ['CEA Cadarache', 'research', 'operational', 'France', 43.6870, 5.7625],
  ['Marcoule Nuclear Site', 'reprocessing', 'operational', 'France', 44.1450, 4.7053],
  ['Pierrelatte Enrichment Plant', 'enrichment', 'operational', 'France', 44.3486, 4.7169],
  ['Moruroa Test Site', 'test_site', 'decommissioned', 'France', -21.8500, -138.9000],
  // ── United Kingdom ───────────────────────────────────────────────
  ['Hinkley Point C', 'reactor', 'under_construction', 'United Kingdom', 51.2084, -3.1314],
  ['Sizewell B', 'reactor', 'operational', 'United Kingdom', 52.2155, 1.6198],
  ['Torness Nuclear Power Station', 'reactor', 'operational', 'United Kingdom', 55.9690, -2.3975],
  ['Sellafield', 'reprocessing', 'operational', 'United Kingdom', 54.4203, -3.4977],
  ['AWE Aldermaston', 'weapons_lab', 'operational', 'United Kingdom', 51.3558, -1.1498],
  ['Dounreay', 'research', 'decommissioned', 'United Kingdom', 58.5775, -3.7454],
  // ── China ────────────────────────────────────────────────────────
  ['Daya Bay Nuclear Power Plant', 'reactor', 'operational', 'China', 22.5983, 114.5419],
  ['Qinshan Nuclear Power Plant', 'reactor', 'operational', 'China', 30.4361, 120.9606],
  ['Tianwan Nuclear Power Plant', 'reactor', 'operational', 'China', 34.6867, 119.4536],
  ['Fuqing Nuclear Power Plant', 'reactor', 'operational', 'China', 25.4417, 119.4478],
  ['Taishan Nuclear Power Plant', 'reactor', 'operational', 'China', 21.9167, 112.9833],
  ['Lop Nur Test Site', 'test_site', 'decommissioned', 'China', 41.5483, 88.7281],
  ['China Academy of Engineering Physics (Mianyang)', 'weapons_lab', 'operational', 'China', 31.4678, 104.7419],
  ['Lanzhou Gaseous Diffusion Plant', 'enrichment', 'operational', 'China', 36.0300, 103.8000],
  // ── Japan ────────────────────────────────────────────────────────
  ['Fukushima Daiichi', 'reactor', 'decommissioned', 'Japan', 37.4207, 141.0328],
  ['Fukushima Daini', 'reactor', 'decommissioned', 'Japan', 37.3168, 141.0251],
  ['Kashiwazaki-Kariwa', 'reactor', 'shutdown', 'Japan', 37.4263, 138.5970],
  ['Takahama Nuclear Power Plant', 'reactor', 'operational', 'Japan', 35.5219, 135.4500],
  ['Sendai Nuclear Power Plant', 'reactor', 'operational', 'Japan', 31.8336, 130.1899],
  ['Ōi Nuclear Power Plant', 'reactor', 'operational', 'Japan', 35.5413, 135.6596],
  ['Ikata Nuclear Power Plant', 'reactor', 'operational', 'Japan', 33.4905, 132.3131],
  ['Tokai Reprocessing Plant', 'reprocessing', 'operational', 'Japan', 36.4594, 140.6013],
  ['Rokkasho Reprocessing Plant', 'reprocessing', 'under_construction', 'Japan', 40.9597, 141.3258],
  // ── India ────────────────────────────────────────────────────────
  ['Kudankulam Nuclear Power Plant', 'reactor', 'operational', 'India', 8.1674, 77.7116],
  ['Tarapur Atomic Power Station', 'reactor', 'operational', 'India', 19.8305, 72.6696],
  ['Rawatbhata Nuclear Power Plant', 'reactor', 'operational', 'India', 24.8811, 75.5858],
  ['Kaiga Nuclear Power Plant', 'reactor', 'operational', 'India', 14.8522, 74.4378],
  ['Bhabha Atomic Research Centre', 'research', 'operational', 'India', 19.0113, 72.9261],
  ['Pokhran Test Range', 'test_site', 'decommissioned', 'India', 26.7300, 71.7500],
  // ── Pakistan ─────────────────────────────────────────────────────
  ['Karachi Nuclear Power Plant', 'reactor', 'operational', 'Pakistan', 24.8423, 66.7861],
  ['Chashma Nuclear Power Plant', 'reactor', 'operational', 'Pakistan', 32.3781, 71.4592],
  ['Kahuta Research Laboratories', 'enrichment', 'operational', 'Pakistan', 33.5886, 73.3864],
  ['Ras Koh Test Site', 'test_site', 'decommissioned', 'Pakistan', 28.8300, 64.9500],
  // ── South Korea ──────────────────────────────────────────────────
  ['Kori Nuclear Power Plant', 'reactor', 'operational', 'South Korea', 35.3208, 129.2953],
  ['Hanbit Nuclear Power Plant', 'reactor', 'operational', 'South Korea', 35.4142, 126.4211],
  ['Hanul Nuclear Power Plant', 'reactor', 'operational', 'South Korea', 37.0928, 129.3828],
  ['Wolsong Nuclear Power Plant', 'reactor', 'operational', 'South Korea', 35.7122, 129.4739],
  // ── Germany ──────────────────────────────────────────────────────
  ['Grohnde Nuclear Power Plant', 'reactor', 'decommissioned', 'Germany', 52.0350, 9.4133],
  ['Brokdorf Nuclear Power Plant', 'reactor', 'decommissioned', 'Germany', 53.8500, 9.3453],
  ['Emsland Nuclear Power Plant', 'reactor', 'decommissioned', 'Germany', 52.4742, 7.3186],
  ['Isar Nuclear Power Plant', 'reactor', 'decommissioned', 'Germany', 48.6063, 12.2917],
  // ── Ukraine ──────────────────────────────────────────────────────
  ['Chernobyl Nuclear Power Plant', 'reactor', 'decommissioned', 'Ukraine', 51.3891, 30.0986],
  ['Zaporizhzhia Nuclear Power Plant', 'reactor', 'operational', 'Ukraine', 47.5088, 34.5859],
  ['Rivne Nuclear Power Plant', 'reactor', 'operational', 'Ukraine', 51.3266, 25.8986],
  ['South Ukraine Nuclear Power Plant', 'reactor', 'operational', 'Ukraine', 47.8159, 31.2238],
  ['Khmelnytskyi Nuclear Power Plant', 'reactor', 'operational', 'Ukraine', 50.3000, 26.6500],
  // ── Canada ───────────────────────────────────────────────────────
  ['Bruce Nuclear Generating Station', 'reactor', 'operational', 'Canada', 44.3253, -81.5983],
  ['Darlington Nuclear Generating Station', 'reactor', 'operational', 'Canada', 43.8726, -78.7199],
  ['Pickering Nuclear Generating Station', 'reactor', 'operational', 'Canada', 43.8112, -79.0665],
  ['Chalk River Laboratories', 'research', 'operational', 'Canada', 46.0536, -77.3614],
  // ── Other ────────────────────────────────────────────────────────
  ['Bushehr Nuclear Power Plant', 'reactor', 'operational', 'Iran', 28.8313, 50.8845],
  ['Natanz Enrichment Facility', 'enrichment', 'operational', 'Iran', 33.7247, 51.7272],
  ['Fordow Enrichment Facility', 'enrichment', 'operational', 'Iran', 34.8833, 51.2250],
  ['Dimona Nuclear Research Center', 'reactor', 'operational', 'Israel', 31.0033, 35.1457],
  ['Yongbyon Nuclear Complex', 'reactor', 'operational', 'North Korea', 39.7964, 125.7552],
  ['Barakah Nuclear Power Plant', 'reactor', 'operational', 'UAE', 23.9600, 52.2600],
  ['Koeberg Nuclear Power Station', 'reactor', 'operational', 'South Africa', -33.6769, 18.4342],
  ['Atucha Nuclear Power Plant', 'reactor', 'operational', 'Argentina', -34.0600, -59.2100],
  ['Angra Nuclear Power Plant', 'reactor', 'operational', 'Brazil', -23.0078, -44.4572],
  ['CANDU Cernavodă', 'reactor', 'operational', 'Romania', 44.3203, 28.0578],
  ['Paks Nuclear Power Plant', 'reactor', 'operational', 'Hungary', 46.5700, 18.8500],
  ['Temelín Nuclear Power Station', 'reactor', 'operational', 'Czech Republic', 49.1814, 14.3767],
  ['Dukovany Nuclear Power Station', 'reactor', 'operational', 'Czech Republic', 49.0850, 16.1478],
  ['Mochovce Nuclear Power Plant', 'reactor', 'operational', 'Slovakia', 48.2778, 18.4397],
  ['Bohunice Nuclear Power Plant', 'reactor', 'decommissioned', 'Slovakia', 48.4894, 17.7214],
  ['Olkiluoto Nuclear Power Plant', 'reactor', 'operational', 'Finland', 61.2353, 21.4478],
  ['Loviisa Nuclear Power Plant', 'reactor', 'operational', 'Finland', 60.3733, 26.3561],
  ['Forsmark Nuclear Power Plant', 'reactor', 'operational', 'Sweden', 60.4083, 18.1681],
  ['Ringhals Nuclear Power Plant', 'reactor', 'operational', 'Sweden', 57.2639, 12.1128],
  ['Ignalina Nuclear Power Plant', 'reactor', 'decommissioned', 'Lithuania', 55.6047, 26.5575],
  ['Kudankulam Nuclear Power Plant II', 'reactor', 'under_construction', 'India', 8.1674, 77.7116],
  ['Akkuyu Nuclear Power Plant', 'reactor', 'under_construction', 'Turkey', 36.1444, 33.5344],
  ['ITER', 'research', 'under_construction', 'France', 43.7075, 5.7775],
  ['Bikini Atoll Test Site', 'test_site', 'decommissioned', 'Marshall Islands', 11.5833, 165.3833],
  ['Enewetak Atoll Test Site', 'test_site', 'decommissioned', 'Marshall Islands', 11.5000, 162.2500],
  ['Christmas Island Test Site', 'test_site', 'decommissioned', 'Australia', -10.4475, 105.6904],
  ['Maralinga Test Site', 'test_site', 'decommissioned', 'Australia', -30.1636, 131.5819],
  ['Monte Bello Islands Test Site', 'test_site', 'decommissioned', 'Australia', -20.4100, 115.5600],
  ['Reggane Test Site', 'test_site', 'decommissioned', 'Algeria', 26.3167, 0.0667],
  ['In Ekker Test Site', 'test_site', 'decommissioned', 'Algeria', 24.0500, 5.0500]
]

// ─── Build + write ──────────────────────────────────────────────────

function main () {
  const opts = parseArgs()

  const facilities = RAW.map(([name, type, status, country, lat, lng], i) => ({
    id: `nf-${String(i + 1).padStart(3, '0')}`,
    name,
    type,
    status,
    country,
    lat,
    lng
  }))

  const output = {
    generatedAt: new Date().toISOString(),
    totalResults: facilities.length,
    facilities
  }

  mkdirSync(dirname(opts.out), { recursive: true })
  writeFileSync(opts.out, JSON.stringify(output, null, 2), 'utf-8')

  console.log('Nuclear facilities: ' + facilities.length)
  console.log('Types: ' + [...new Set(facilities.map(f => f.type))].join(', '))
  console.log('Countries: ' + [...new Set(facilities.map(f => f.country))].length)
  console.log('Wrote -> ' + opts.out)
}

main()
