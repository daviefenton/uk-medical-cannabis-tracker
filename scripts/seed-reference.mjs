// Generates data/regulations.json and data/cups.json (curated reference data; edit the arrays and re-run).
import { writeFileSync } from 'node:fs';
const R = (country, region, medical, adult, summary, source, opts = {}) => ({ country, region, medical, adult, summary, source, ...opts });
// medical: legal | limited | pilot | none    adult: legal | decriminalised | tolerated | illegal
const regulations = [
 R('United Kingdom', 'Europe', 'limited', 'illegal', 'Cannabis-based products for medicinal use (CBPMs) can be prescribed by specialist doctors since November 2018, mostly through private clinics. Recreational cannabis is a Class B drug.', 'https://www.nhs.uk/conditions/medical-cannabis/', { focus: true }),
 R('Jersey', 'Crown Dependencies', 'legal', 'illegal', 'Medicinal cannabis has been prescribable since 2019, and the island licenses local cultivation. Recreational use is illegal.', 'https://www.gov.je/', { focus: true }),
 R('Guernsey', 'Crown Dependencies', 'legal', 'illegal', 'Medicinal cannabis can be prescribed. Recreational use is illegal.', 'https://www.gov.gg/', { focus: true }),
 R('Isle of Man', 'Crown Dependencies', 'legal', 'illegal', 'Medicinal cannabis prescribing and licensed cultivation are permitted. Recreational use is illegal.', 'https://www.gov.im/', { focus: true }),
 R('Ireland', 'Europe', 'limited', 'illegal', 'Medical Cannabis Access Programme (from 2019) covers a short list of conditions; other access needs a ministerial licence.', 'https://www.hpra.ie/'),
 R('Germany', 'Europe', 'legal', 'legal', 'Medical cannabis since 2017, taken out of narcotics law in April 2024 (MedCanG). Adults may possess limited amounts, grow at home and join non-profit cultivation clubs; no commercial shops.', 'https://www.bfarm.de/', { supplier: true }),
 R('Netherlands', 'Europe', 'legal', 'tolerated', 'Medical cannabis via the Office of Medicinal Cannabis since 2003. Coffeeshop sales are tolerated; a regulated supply trial is running.', 'https://www.cannabisbureau.nl/', { supplier: true }),
 R('Portugal', 'Europe', 'legal', 'decriminalised', 'Medical cannabis legal since 2018 and a major exporter to the UK. Personal possession of all drugs is decriminalised (2001).', 'https://www.infarmed.pt/', { supplier: true }),
 R('Spain', 'Europe', 'limited', 'decriminalised', 'A narrow medical framework for standardised preparations was approved in 2025. Private personal use is not a criminal offence; public use is fined.', 'https://www.aemps.gob.es/'),
 R('Malta', 'Europe', 'legal', 'legal', 'Medical cannabis since 2018. In 2021 Malta became the first EU country to legalise adult home growing and non-profit associations.', 'https://arucc.gov.mt/'),
 R('Luxembourg', 'Europe', 'legal', 'legal', 'Medical cannabis since 2019. Adults may grow up to four plants at home since 2023; public use remains restricted.', 'https://sante.public.lu/'),
 R('Switzerland', 'Europe', 'legal', 'decriminalised', 'Doctors can prescribe medical cannabis without special permission since 2022. City-run adult-use pilot trials operate; minor possession is fined.', 'https://www.bag.admin.ch/'),
 R('Czechia', 'Europe', 'legal', 'decriminalised', 'Medical cannabis available since 2013. Small-quantity possession is an administrative offence; further reform has been debated.', 'https://www.sukl.cz/'),
 R('France', 'Europe', 'pilot', 'illegal', 'A state medical cannabis pilot has run since 2021 while a permanent framework is finalised.', 'https://ansm.sante.fr/'),
 R('Italy', 'Europe', 'limited', 'illegal', 'Medical cannabis since 2007, largely supplied by the state pharmaceutical institute and imports. Personal use is an administrative offence.', 'https://www.salute.gov.it/'),
 R('Denmark', 'Europe', 'pilot', 'illegal', 'Medical cannabis pilot programme since 2018.', 'https://laegemiddelstyrelsen.dk/', { supplier: true }),
 R('Poland', 'Europe', 'legal', 'illegal', 'Pharmacy-dispensed medical cannabis since 2017.', 'https://www.urpl.gov.pl/'),
 R('Canada', 'Americas', 'legal', 'legal', 'Medical access since 2001; adult-use legal nationally since 2018. A leading source of flower imported to the UK.', 'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis.html', { supplier: true }),
 R('United States', 'Americas', 'limited', 'illegal', 'Federally controlled (rescheduling has been under review). Most states run medical programmes and about half allow adult use under state law.', 'https://www.ncsl.org/health/state-medical-cannabis-laws'),
 R('Uruguay', 'Americas', 'legal', 'legal', 'First country to legalise adult use nationally (2013), via pharmacies, clubs and home growing.', 'https://www.ircca.gub.uy/'),
 R('Colombia', 'Americas', 'legal', 'decriminalised', 'Medical licensing since 2016 with a large export industry; a small personal dose is decriminalised.', 'https://www.minjusticia.gov.co/', { supplier: true }),
 R('Australia', 'Oceania', 'legal', 'illegal', 'Medical cannabis via TGA prescribing pathways since 2016. The ACT decriminalised small personal amounts.', 'https://www.tga.gov.au/', { supplier: true }),
 R('New Zealand', 'Oceania', 'legal', 'illegal', 'Medicinal Cannabis Scheme since 2020; a 2020 referendum rejected adult-use legalisation. NZ flower now reaches the UK.', 'https://www.health.govt.nz/', { supplier: true }),
 R('South Africa', 'Africa', 'legal', 'decriminalised', 'Private adult use and growing decriminalised (2018 ruling; Cannabis for Private Purposes Act 2024). Medical products regulated by SAHPRA.', 'https://www.sahpra.org.za/', { supplier: true }),
 R('Uganda', 'Africa', 'limited', 'illegal', 'Licensed cultivation for export; domestic use remains illegal. Ugandan flower reaches the UK via importers.', null, { supplier: true }),
 R('Israel', 'Middle East', 'legal', 'decriminalised', 'Long-running national medical programme; personal use decriminalised.', 'https://www.health.gov.il/'),
 R('Thailand', 'Asia', 'legal', 'illegal', 'Delisted as a narcotic in 2022, then restricted in 2025 so that buying requires a prescription.', 'https://www.fda.moph.go.th/'),
 R('Japan', 'Asia', 'limited', 'illegal', 'A 2024 law change allows approved cannabis-derived medicines; use is a criminal offence.', null),
 R('United Arab Emirates', 'Middle East', 'none', 'illegal', 'Strictly illegal, including prescribed cannabis from abroad. Check before travelling with a UK prescription.', null),
 R('Singapore', 'Asia', 'none', 'illegal', 'Strictly illegal with severe penalties, including for residents using it abroad.', null),
];
const C = (cup, edition, year, category, place, strain, entrant, source) => ({ cup, edition, year, category, place, strain, entrant, source });
const cups = [
 C('Spannabis Champions Cup', 'Barcelona', 2025, 'Indica flower', 1, 'Banana Cooler', 'Selva Club', 'https://cannabiscupwinners.com/blog/2025/03/18/spannabis-champions-cup-2025/'),
 C('Spannabis Champions Cup', 'Barcelona', 2025, 'Indica flower', 2, 'Zxz', 'Fantazy', 'https://cannabiscupwinners.com/blog/2025/03/18/spannabis-champions-cup-2025/'),
 C('Spannabis Champions Cup', 'Barcelona', 2025, 'Indica flower', 3, 'Big Z', 'Selva Club', 'https://cannabiscupwinners.com/blog/2025/03/18/spannabis-champions-cup-2025/'),
 C('Spannabis Champions Cup', 'Barcelona', 2025, 'Sativa flower', 1, 'Cherrymosa', 'Perfect Tree', 'https://cannabiscupwinners.com/blog/2025/03/18/spannabis-champions-cup-2025/'),
 C('Spannabis Champions Cup', 'Barcelona', 2025, 'Sativa flower', 2, 'Gelonade', 'Feliz', 'https://cannabiscupwinners.com/blog/2025/03/18/spannabis-champions-cup-2025/'),
 C('Spannabis Champions Cup', 'Barcelona', 2025, 'CBD flower', 1, 'Legendary', 'Loud', 'https://cannabiscupwinners.com/blog/2025/03/18/spannabis-champions-cup-2025/'),
 C('Spannabis Champions Cup', 'Barcelona', 2025, 'CBD flower', 2, 'Ferrari OG', 'Gemelli Forte', 'https://cannabiscupwinners.com/blog/2025/03/18/spannabis-champions-cup-2025/'),
 C('Spannabis Champions Cup', 'Barcelona', 2025, 'CBD flower', 3, 'Grapefruit', 'Flowgardens', 'https://cannabiscupwinners.com/blog/2025/03/18/spannabis-champions-cup-2025/'),
 C('Spannabis Champions Cup', 'Bilbao', 2024, 'Indica flower', 1, 'Banana Cooler', 'Selva Club', 'https://cannabiscupwinners.com/blog/2024/09/28/spannabis-bilbao-awards-2024/'),
 C('Spannabis Champions Cup', 'Bilbao', 2024, 'CBD flower', 1, 'Ferrari OG', 'Gemelli Forte', 'https://cannabiscupwinners.com/blog/2024/09/28/spannabis-bilbao-awards-2024/'),
 C('Spannabis Champions Cup', 'Bilbao', 2026, 'Indica flower', 1, 'Black', 'Terps Army', 'https://www.newsweed.fr/en/spannabis-champions-cup-2026-results-from-bilbao/'),
 C('The Emerald Cup', 'California', 2024, 'Indoor Flower Breeder\'s Cup', 1, 'Roswell 47', 'Decibel Gardens', 'https://www.leafly.com/wp-home/?p=265657'),
 C('The Emerald Cup', 'California', 2023, 'Sungrown Flower', 1, 'Double OG Chem', 'Rebel Grown', 'https://cannabiscupwinners.com/blog/category/all-events/usa-canada/emerald-cannabis-cup/'),
];
writeFileSync('data/regulations.json', JSON.stringify({ reviewed: '2026-10-15', note: 'Plain-English summaries compiled from public sources. Laws change: always check the official source before acting, especially before travelling with medication.', countries: regulations }, null, 1));
writeFileSync('data/cups.json', JSON.stringify({ reviewed: '2026-10-15', note: 'Flower results compiled from published results coverage. Cup wins are for specific growers and batches; a UK product sharing a strain name is not the same plant.', results: cups }, null, 1));
console.log(regulations.length, 'countries,', cups.length, 'cup results');
