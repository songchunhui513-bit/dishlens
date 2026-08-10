#!/usr/bin/env node

/**
 * Generate missing knowledge-base dish images with the same Wan/DashScope prompt
 * stack used by production menu image generation.
 *
 * Default is a dry run. Use --apply to call Wan, save /public/dishes/<id>.webp,
 * and update public/dish-knowledge-db.json.
 *
 * Usage:
 *   node scripts/backfill-knowledge-images-with-wan.mjs --limit=10
 *   node scripts/backfill-knowledge-images-with-wan.mjs --ids=mango-lassi,naan --apply
 *   node scripts/backfill-knowledge-images-with-wan.mjs --limit=20 --apply --item-timeout-ms=90000
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import ts from "typescript";

const ROOT = join(import.meta.dirname, "..");
const DB_PATH = join(ROOT, "public", "dish-knowledge-db.json");
const DISHES_DIR = join(ROOT, "public", "dishes");
const TMP_MODULE_DIR = join(ROOT, ".cache", "script-modules");
const IMAGE_GEN_TS = join(ROOT, "src", "lib", "ai", "image-gen.ts");
const IMAGE_GEN_MJS = join(TMP_MODULE_DIR, "image-gen.generated.mjs");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const idsArg = args.find((arg) => arg.startsWith("--ids="));
const delayArg = args.find((arg) => arg.startsWith("--delay-ms="));
const itemTimeoutArg = args.find((arg) => arg.startsWith("--item-timeout-ms="));
const LIMIT = Number.parseInt(limitArg?.split("=")[1] || "10", 10) || 10;
const DELAY_MS = Number.parseInt(delayArg?.split("=")[1] || "1200", 10) || 1200;
const ITEM_TIMEOUT_MS = Math.max(
  10_000,
  Math.min(180_000, Number.parseInt(itemTimeoutArg?.split("=")[1] || "90000", 10) || 90_000),
);
const TARGET_IDS = new Set(
  (idsArg?.split("=")[1] || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

const MAX_DIM = Number.parseInt(process.env.KNOWLEDGE_DISH_MAX_DIM || "768", 10) || 768;
const WEBP_QUALITY = Number.parseInt(process.env.KNOWLEDGE_DISH_WEBP_QUALITY || "82", 10) || 82;

function readLocalEnvFile() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function isRemotePollinations(value) {
  return typeof value === "string" && value.includes("pollinations.ai");
}

function isLocalImage(value) {
  return typeof value === "string" && value.startsWith("/dishes/");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[€$£¥₹]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:€|eur|euros?|usd|gbp|元|円|₹)/gi, " ")
    .replace(/[«»"“”'’`´.,;:!?()[\]{}+*/\\|_~^=<>-]/g, " ")
    .replace(/\b(?:la|le|les|l|il|lo|gli|i|el|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function safeLocalDishFilename(value) {
  const slug = normalizeName(value)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || `dish-${stableHash(value)}`}.webp`;
}

function localDishImagePath(entry) {
  return `/dishes/${safeLocalDishFilename(entry.id)}`;
}

function isNeedsBackfill(entry) {
  return !isLocalImage(entry.card) && !isLocalImage(entry.hero) &&
    (isRemotePollinations(entry.card) || isRemotePollinations(entry.hero));
}

function hasLocalFile(entry) {
  return existsSync(join(DISHES_DIR, safeLocalDishFilename(entry.id)));
}

function preferredEnglishName(entry) {
  const names = Array.isArray(entry.names) ? entry.names : [];
  return names.find((name) => /[A-Za-z]/.test(name) && !/[一-鿿]/.test(name)) || names[0] || entry.id;
}

function preferredChineseName(entry) {
  const names = Array.isArray(entry.names) ? entry.names : [];
  return names.find((name) => /[一-鿿]/.test(name)) || "";
}

const SPECIAL_BACKFILL_IMAGE_HINTS = {
  "aji-de-gallina": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Peruvian aji de gallina as a creamy yellow chili chicken stew.",
    "Use shredded chicken in aji amarillo, walnut, bread, and cheese sauce, plated with white rice, boiled potato, black olives, and a halved boiled egg.",
    "The sauce should be thick, warm yellow, and clearly Peruvian, not a thin soup.",
    "Do not show curry, fried chicken, plain chicken breast, chicken noodle soup, pasta, risotto, or generic yellow stew without rice and egg.",
  ].join(" "),
  amatriciana: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian amatriciana pasta with guanciale and tomato sauce.",
    "Use bucatini, spaghetti, or rigatoni coated in red tomato sauce with visible crisp guanciale pieces, pecorino cheese, and black pepper.",
    "The dish must clearly be Roman red-sauce pasta, hearty but not creamy.",
    "Do not show bolognese meat sauce, carbonara cream sauce, plain arrabbiata penne, pizza, lasagna, or noodle soup.",
  ].join(" "),
  "arancini-di-riso": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Sicilian arancini as golden fried rice balls.",
    "Use round or conical breadcrumb-crusted rice balls, with at least one cut open if possible to reveal rice, ragu, peas, or melted mozzarella.",
    "The exterior should look crisp, deep golden, and clearly breadcrumb fried.",
    "Do not show meatballs, falafel, croquettes, doughnut holes, takoyaki, hush puppies, or plain rice balls without a fried crust.",
  ].join(" "),
  arrabbiata: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian arrabbiata pasta in spicy tomato sauce.",
    "Use penne or rigatoni coated in bright red tomato sauce with garlic, red chili flakes, parsley, and olive oil.",
    "The dish should look spicy and tomato-forward, with no meat as the main visual subject.",
    "Do not show amatriciana with guanciale chunks, bolognese meat sauce, carbonara cream, pizza, lasagna, or noodle soup.",
  ].join(" "),
  "bruschetta-ai-funghi": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian mushroom bruschetta with sautéed mushrooms on toasted bread.",
    "Use rustic crostini or toasted bread slices topped with browned mushrooms, garlic, herbs, olive oil, and optional parmesan or parsley.",
    "The mushrooms and toasted bread must be the clear subject.",
    "Do not show tomato bruschetta, avocado toast, pizza, sandwich, mushroom soup, pasta, or a mushroom risotto.",
  ].join(" "),
  "cacio-e-pepe": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian cacio e pepe pasta with black pepper and pecorino cheese.",
    "Use spaghetti, tonnarelli, or bucatini coated in a glossy pale ivory pecorino sauce with lots of cracked black pepper.",
    "The entire pasta should look white, cream, or light beige, never red or orange; black pepper flecks must be the strongest visual cue.",
    "The plate should read as simple Roman cheese-and-pepper pasta, creamy from pecorino cheese and pasta water, with no visible meat.",
    "STRICT NEGATIVE: no tomato sauce, no red sauce, no orange sauce, no amatriciana, no arrabbiata, no carbonara bacon or egg, no alfredo cream sauce, no pesto, no bolognese meat sauce, no pizza, no noodle soup.",
  ].join(" "),
  "chicken-lollipop": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian chicken lollipop as frenched chicken winglets with the meat pushed to one end of the bone.",
    "The pieces should be deep fried or Indo-Chinese sauced, red-orange, glossy, and arranged like small drumettes with exposed bone handles.",
    "Serve with onion, lime, cilantro, or chili sauce in an Indian restaurant appetizer presentation.",
    "Do not show regular chicken wings, fried chicken tenders, chicken nuggets, kebab skewers, drumsticks, buffalo wings, or boneless chicken curry.",
  ].join(" "),
  "chole-bhature": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show North Indian chole bhature with dark spiced chickpea curry beside large puffed fried bread.",
    "The bhature should be inflated, golden, round, and blistered; the chole should be a brown chickpea curry in a bowl or section of the plate.",
    "Include onion rings, pickle, green chili, or lemon wedge if useful.",
    "Do not show naan, poori without chickpeas, flat roti, dosa, biryani, hummus, falafel, or plain chickpea salad.",
  ].join(" "),
  "cotoletta-alla-milanese": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Milanese cotoletta as a large golden breaded veal cutlet, shallow-fried and crisp.",
    "The entire surface of the cutlet must be covered in pale-golden breadcrumb crust, flat and thin, with no visible grill marks and no exposed browned meat surface.",
    "A broad flat breaded cutlet with a lemon wedge, arugula, or simple salad on the side is ideal, plated in an Italian trattoria style.",
    "Do not show grilled steak, roasted chop, seared meat, barbecue ribs, schnitzel with fries as the main identity, fried chicken, pork katsu, chicken parmesan, fish fillet, or nuggets.",
  ].join(" "),
  "crostini-toscani": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Tuscan crostini topped with chicken liver pate.",
    "Use several small toasted bread slices with a dark brown rustic chicken liver pate spread, capers, herbs, or olive oil.",
    "The image should read as Italian antipasto crostini, not a sandwich.",
    "Do not show tomato bruschetta, mushroom bruschetta, avocado toast, garlic bread, pizza, liver steak, soup, or dessert toast.",
  ].join(" "),
  "danish-rye-bread": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Danish rye bread as a dense dark rye loaf with visible seeds and a tight crumb.",
    "Include sliced rugbrod pieces beside the loaf, with whole grains, sunflower seeds, or rye kernels visible in the cut face.",
    "The bread should look dark brown, rectangular, compact, and Nordic.",
    "Do not show white sandwich bread, sourdough boule, cake, banana bread, pumpernickel only, open-faced sandwich toppings, or pastries.",
  ].join(" "),
  "dumplings-street": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show street dumplings as a plate or bamboo tray of pleated dumplings.",
    "Use Chinese potstickers or jiaozi: crescent-shaped dumplings lying on their sides, with visible pleated edges and golden pan-fried bottoms.",
    "Show multiple separate crescent dumplings with dipping sauce, chili oil, scallions, or sesame in a casual street-food presentation.",
    "Do not show bao buns, xiao long bao, soup dumplings with high twisted top knots, round steamed buns, shumai, ravioli, pierogi, empanadas, gyoza-only Japanese branding, momo soup, or wonton soup.",
  ].join(" "),
  "fattoush-salad": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Levantine fattoush salad as a fresh chopped salad with crispy pita chips.",
    "Use cucumber, tomato, radish, romaine or parsley, mint, sumac, pomegranate molasses or lemon dressing, and visible toasted pita triangles.",
    "The pita chips should be a clear visual cue, with a bright Middle Eastern salad presentation.",
    "Do not show Greek salad, Caesar salad, tabbouleh only, nachos, tortilla chips, bread salad without greens, or a plain vegetable bowl.",
  ].join(" "),
  gozleme: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Turkish gozleme as a stuffed flatbread folded into large thin rectangular or half-moon pieces.",
    "The flatbread should have browned griddle spots and a visible filling such as spinach, feta, minced meat, or potato at a cut edge.",
    "Serve with lemon wedges, yogurt, or herbs in a Turkish street-food presentation.",
    "Do not show quesadilla, pizza, naan, paratha roll, crepe dessert, pide boat, lahmacun, or an unfilled flatbread.",
  ].join(" "),
  "jeera-rice": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian jeera rice as fluffy basmati rice with cumin seeds.",
    "Use long separate white or lightly golden rice grains, visible toasted cumin seeds, ghee sheen, cilantro, and optional whole spices.",
    "The dish should look like a rice side, not a full curry rice plate.",
    "Do not show biryani, fried rice with vegetables, pulao with many peas, risotto, plain white rice without cumin seeds, or curry mixed into the rice.",
  ].join(" "),
  "kanom-jeen": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai kanom jeen as thin fermented rice noodles served with curry sauce and fresh herbs.",
    "Use several neat nests of delicate white fermented rice noodles with Thai curry sauce poured beside or over part of the noodles.",
    "Add fresh herb and vegetable sides such as bean sprouts, cucumber, long beans, cabbage, basil, banana blossom, and optional boiled egg.",
    "The noodles should be delicate white strands, clearly different from spaghetti or ramen, and the curry should feel Thai rather than generic seafood soup.",
    "Include no large shrimp, prawns, or seafood as the main subject. Do not let seafood dominate the bowl.",
    "Do not show pad thai, ramen soup, spaghetti, plain rice vermicelli salad, curry without noodles, generic noodle stir-fry, or a seafood noodle soup.",
  ].join(" "),
  "kibbeh-me": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Middle Eastern kibbeh as bulgur croquettes, oval torpedo-shaped and deep fried golden brown.",
    "Include several crisp kibbeh pieces, with at least one cut open if possible to show minced meat, onion, pine nut, or bulgur filling.",
    "Serve with lemon, yogurt, tahini, parsley, or salad in a Levantine mezze setting.",
    "Do not show falafel balls, meatballs, arancini, croquettes without bulgur texture, kebab skewers, kofta, or fried dough.",
  ].join(" "),
  kimbap: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean kimbap as seaweed rice rolls cut into many round slices.",
    "Each slice should have dark seaweed outside, white rice, and colorful fillings such as egg, carrot, spinach, pickled radish, cucumber, and beef or ham.",
    "The rolls should look like Korean picnic rolls with sesame seeds and clean cross-sections.",
    "Do not show Japanese maki sushi with raw fish, California roll rice outside, hand rolls, nigiri, sushi platter, or one uncut roll only.",
  ].join(" "),
  "bal-kaymak": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Turkish kaymak as thick clotted cream served in a shallow dish with golden honey drizzled over it.",
    "The kaymak should look like soft folded cream or dense white cream, often served with bread pieces or honeycomb.",
    "Do not show panna cotta, flan, pudding, caramel custard, yogurt parfait, ice cream scoop, or a molded dessert.",
  ].join(" "),
  "gado-gado": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indonesian gado-gado as a composed vegetable salad covered with thick brown peanut sauce.",
    "Visible boiled egg halves, tofu or tempeh, green beans, cabbage, bean sprouts, cucumber, potatoes, and crackers are ideal.",
    "Do not show spring rolls, wraps, burritos, fresh rolls, curry, noodle soup, or a single stuffed crepe.",
  ].join(" "),
  "gyoza": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese gyoza as 6-8 crescent dumplings arranged in a row or circle on a plate.",
    "They should be pan-fried with golden-brown crisp bottoms, pleated wrappers, and a small dipping sauce.",
    "Do not show empanadas, cut-open meat pies, bao buns, soup dumplings, ravioli, pierogi, or a single large pastry.",
  ].join(" "),
  "hotteok": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean hotteok as a flat griddle pancake, round and lightly browned, served as street food.",
    "It may be torn open slightly to show brown sugar, cinnamon, nut, or seed filling inside.",
    "Do not show a cake, tart, lava cake, thick bun, dorayaki, pancake stack, or plated pastry dessert.",
  ].join(" "),
  "jajangmyeon": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean jajangmyeon as thick wheat noodles covered with glossy black bean sauce, very dark brown to black.",
    "Include diced pork or onion in the sauce and julienned cucumber garnish on top, served in one bowl.",
    "Do not show red chili sauce, tomato ragu, ramen soup, spaghetti bolognese, dry yellow noodles, or Italian pasta.",
  ].join(" "),
  "jokbal": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean jokbal, braised pig's feet, as sliced pork trotter meat arranged on a platter, like boneless slices of braised pork shank.",
    "The meat should look glossy brown with visible pork skin, gelatinous layers, and many sliced pieces, served with garlic, chili, or dipping sauce.",
    "No visible toes, no claws, no whole feet shape. Do not show chicken feet, duck feet, ribs, steak, pork belly only, soup, or a dark braising pot.",
  ].join(" "),
  "kanom-krok": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai kanom krok as small coconut rice pancakes cooked in round half-sphere cups.",
    "They should appear as many little round white-and-golden coconut pancakes, often paired into cups or served in a tray with scallion or corn topping.",
    "Do not show cookies, biscuits, macarons, takoyaki, muffins, bread rolls, or flat pancakes.",
  ].join(" "),
  "california-roll": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show exactly 6-8 separate sliced inside-out California roll rounds arranged flat on a plate.",
    "Rice must be on the outside with sesame or orange roe; nori must be inside.",
    "Visible cross-sections must show imitation crab, avocado, and cucumber.",
    "Do not show a single uncut roll, sushi log, hand roll, seaweed cup, or upright cylinder.",
  ].join(" "),
  "black-pepper-crab": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Singapore black pepper crab with crab pieces coated in very dark black-brown pepper sauce.",
    "The crab shell, claws, and coarse black pepper specks must be visible.",
    "Do not use bright red, orange, tomato, or chili crab sauce.",
    "The image should look different from chili crab.",
  ].join(" "),
  "boquerones-fritos": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show crispy golden fried anchovies, Spanish boquerones fritos, as many small whole fish lightly battered and fried.",
    "The fish should look crunchy and golden, served piled on a plate with lemon wedges.",
    "Do not show raw silver anchovies, grilled sardines, canned fish, or a single large fish.",
  ].join(" "),
  "char-kway-teow": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Singapore/Malaysia char kway teow as dark wok-fried flat rice noodles on a plate.",
    "Visible flat rice noodles, bean sprouts, egg, prawns or cockles, Chinese sausage slices, and charred wok hei edges.",
    "Do not show noodle soup, ramen, spaghetti, yellow wheat noodles, or a seafood noodle bowl with broth.",
  ].join(" "),
  "fugu-sashimi": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show translucent pufferfish sashimi, fugu sashimi, as many paper-thin white slices arranged like a chrysanthemum on a round plate.",
    "Include a small ponzu dipping sauce and garnish, elegant Japanese sashimi presentation.",
    "Do not show salmon, tuna, sushi rolls, cooked fish, thick fish fillets, or a whole pufferfish.",
  ].join(" "),
  "ganjang-gejang": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean ganjang gejang, soy-marinated raw crab, with raw crab pieces and shell in glossy dark soy marinade.",
    "The gray-blue or brown raw crab shell and orange crab roe should be visible, served cold in dark soy sauce with chili and scallion garnish.",
    "The crab must not be bright orange-red; do not show chili crab, cooked red crab, black pepper crab, crab soup, or fried crab.",
  ].join(" "),
  "hokkien-mee": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Singapore Hokkien mee as stir-fried yellow egg noodles and rice vermicelli on a plate.",
    "Visible prawns, squid, egg, chives, sambal chili, and lime; noodles should look glossy and lightly sauced.",
    "Do not show noodle soup, ramen, dark char kway teow, spaghetti, or plain fried rice.",
  ].join(" "),
  "hoy-tod": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show crispy Thai oyster omelette, hoy tod, as a lacy golden egg-and-starch pancake with oysters.",
    "Serve with bean sprouts, scallions, and red chili sauce on the side.",
    "Do not show plain omelette, takoyaki, mussel soup, fried chicken, or Korean seafood pancake.",
  ].join(" "),
  "haemul-pajeon": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean seafood scallion pancake, haemul pajeon, as a wide thin pan-fried pancake cut into wedges.",
    "Long green scallions should run through the pancake with visible squid, shrimp, or mussel pieces, served with soy dipping sauce.",
    "Do not show a thick omelette, plain egg pancake, pizza, Thai oyster omelette, or fried seafood fritters.",
  ].join(" "),
  "kra-pao-gai": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai basil chicken stir-fry, kra pao gai, as minced or chopped chicken stir-fried with holy basil and red chilies.",
    "Serve it over white rice with a crispy fried egg on top or beside it, with visible basil leaves and chili pieces.",
    "Do not show curry, noodle stir-fry, chicken soup, grilled chicken, or generic Chinese chicken with broccoli.",
  ].join(" "),
  "maki-roll": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show classic maki sushi roll as 6-8 separate round cut pieces with nori seaweed on the outside and rice/filling inside.",
    "Visible clean cross-sections with cucumber, tuna, salmon, tamagoyaki, or pickled vegetable filling on a plate.",
    "Do not show inside-out California roll, temaki hand roll, dragon roll with sauce, nigiri, or a single uncut sushi log.",
  ].join(" "),
  "mee-goreng": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Malaysian or Indonesian mee goreng as spicy stir-fried yellow noodles on a plate.",
    "Visible yellow wheat noodles, egg, tofu or chicken, vegetables, lime, chili, and a dry glossy reddish-brown sauce.",
    "Do not show noodle soup, spaghetti, char kway teow flat noodles, fried rice, or plain ramen.",
  ].join(" "),
  "mee-krob": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai mee krob as crispy Thai sweet-and-sour noodles, a nest or pile of thin crunchy fried rice noodles.",
    "Noodles should look airy, crisp, lightly glazed, with shrimp, tofu, herbs, lime, and chili garnish.",
    "Do not show soft stir-fried noodles, noodle soup, pad thai, spaghetti, or plain fried rice.",
  ].join(" "),
  "nakji-bokkeum": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean spicy stir-fried baby octopus, nakji bokkeum, as one single plate or bowl with curled octopus tentacles in a glossy red gochujang sauce.",
    "Visible octopus suction cups, onion, scallion, sesame seeds, and Korean red chili paste sauce.",
    "Do not show shrimp, kung pao shrimp, squid rings, noodle stir-fry, takoyaki, seafood soup, collage, split panels, or multiple separate photos.",
  ].join(" "),
  "nam-prik-oong": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Northern Thai tomato and minced pork chili dip, nam prik oong, as a small bowl of chunky red-orange dip.",
    "Serve with fresh cucumber, cabbage, long beans, herbs, and pork cracklings or vegetables arranged around the dip.",
    "Do not show curry, salsa only, soup, pasta sauce, or a generic red chili bowl without Thai vegetable sides.",
  ].join(" "),
  "nasi-lemak": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Malaysian or Singaporean nasi lemak as coconut rice with sambal, fried anchovies, roasted peanuts, cucumber slices, and half a boiled egg.",
    "Banana leaf or plate presentation is fine; optional fried chicken or fish may appear beside the rice.",
    "Do not show plain fried rice, biryani, curry rice, poke bowl, crab, lobster, or nasi goreng.",
  ].join(" "),
  "negitoro-roll": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show scallion tuna maki roll, negitoro roll, as 6-8 cut sushi rounds with nori seaweed on the outside.",
    "The filling should look like minced pink tuna with chopped green scallions, visible in clean cross-sections.",
    "Do not show salmon roll, California roll, nigiri, temaki hand roll, or a single uncut sushi log.",
  ].join(" "),
  "nigiri-assorted": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show assorted nigiri sushi platter with individual rice ovals topped by different fish slices.",
    "Include tuna, salmon, shrimp, egg, or white fish pieces arranged neatly on a plate or wooden board.",
    "Do not show maki rolls, inside-out rolls, sashimi without rice, poke bowl, or one single nigiri only.",
  ].join(" "),
  "or-suan": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai or suan crispy oyster pancake with plump oysters embedded in a glossy egg-and-starch pancake.",
    "The pancake should look crisp at the edges and slightly gooey in the center, served with bean sprouts, cilantro, and chili sauce.",
    "Do not show plain omelette, Korean seafood pancake, hoy tod, takoyaki, mussel soup, or fried seafood fritters.",
  ].join(" "),
  "oyster-omelette": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Singapore or Taiwanese oyster omelette as a street-food plate with oysters, soft egg, and translucent sweet potato starch.",
    "Include green herbs, crispy browned egg edges, and red chili sauce on or beside the omelette.",
    "Do not show Thai hoy tod, Korean pancake, plain omelette, scrambled eggs, mussel soup, or pizza.",
  ].join(" "),
  "pad-kra-pao": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai pad kra pao as minced pork or chicken stir-fried with holy basil, garlic, and red chilies over white rice.",
    "Include a crispy fried egg on top or beside the rice, visible basil leaves, chili pieces, and dark savory stir-fry sauce.",
    "Do not show curry, noodle stir-fry, fried rice, soup, grilled chicken, or generic Chinese stir-fry.",
  ].join(" "),
  "paella-de-marisco": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Spanish seafood paella in a shallow paella pan with saffron-yellow rice spread flat.",
    "Visible mussels, shrimp, squid, clams, peas, lemon wedges, and toasted socarrat edges.",
    "Do not show risotto, biryani, fried rice, seafood pasta, curry rice, or a deep soup bowl.",
  ].join(" "),
  "pasta-frutti-di-mare": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian seafood pasta, spaghetti ai frutti di mare, with long spaghetti or linguine tossed with seafood.",
    "Visible mussels, clams, shrimp, squid, parsley, olive oil or light tomato sauce, plated as pasta strands.",
    "Do not show pizza, paella, risotto, fried rice, noodle soup, or a seafood platter without pasta.",
  ].join(" "),
  "pickled-herring": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Scandinavian pickled herring as small silver herring fillets or pieces served cold on a plate.",
    "Include onion rings, dill, potatoes or rye bread, and a light vinegar or mustard marinade.",
    "Do not show fried fish, grilled salmon, sardine cans, sushi, ceviche, or a whole raw fish.",
  ].join(" "),
  "pulpo-a-la-gallega": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Galician octopus, pulpo a la gallega, as sliced octopus tentacle rounds on a wooden plate.",
    "Visible paprika, olive oil, coarse salt, and boiled potato slices under or beside the octopus.",
    "Do not show takoyaki, squid rings, octopus pasta, seafood soup, or a whole uncut octopus.",
  ].join(" "),
  "puttanesca": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian puttanesca pasta as spaghetti tossed in tomato sauce with black olives, capers, anchovies, garlic, and parsley.",
    "The dish must clearly be long pasta strands in a red tomato sauce with visible olives and capers.",
    "Do not show pizza, seafood pasta, plain tomato spaghetti, risotto, paella, or noodle soup.",
  ].join(" "),
  "risotto-ai-frutti-di-mare": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian seafood risotto as creamy short-grain rice with seafood mixed through the rice.",
    "Visible shrimp, mussels, clams, squid, parsley, and glossy creamy risotto texture on a shallow plate.",
    "Do not show paella, seafood pasta, fried rice, pizza, curry rice, or a deep soup bowl.",
  ].join(" "),
  "risotto-al-nero-di-seppia": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian squid ink risotto as glossy black short-grain rice with squid or cuttlefish pieces.",
    "The rice should be creamy and jet black, plated shallow with parsley or lemon garnish.",
    "Do not show black pasta, paella, fried rice, soup, sushi, or a plain black sauce puddle.",
  ].join(" "),
  "norwegian-salmon": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Norwegian salmon as a thick pink-orange salmon fillet, grilled or pan-seared, plated with lemon, dill, and simple vegetables.",
    "The fish should clearly be a single salmon fillet with flaky flesh and browned skin or seared surface.",
    "Do not show sushi, sashimi, smoked salmon slices, tuna steak, whole fish, or generic white fish.",
  ].join(" "),
  "pla-rad-prik": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai pla rad prik as a whole crispy fried fish covered with glossy red chili sauce.",
    "The fish should remain whole with head and tail visible, topped with Thai sweet-spicy chili sauce, herbs, and lime.",
    "Do not show fish curry, grilled fillet, fish soup, sushi, or generic fried fish without red chili sauce.",
  ].join(" "),
  "prawn-masala": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian prawn masala as prawns in a thick orange-red masala curry sauce.",
    "Visible whole prawns, tomato-onion masala, spices, cilantro garnish, and a bowl or plate presentation with naan or rice nearby.",
    "Do not show plain grilled shrimp, Thai curry, shrimp pasta, fried prawns, or seafood soup.",
  ].join(" "),
  "rainbow-roll": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese rainbow roll as ONLY inside-out sushi roll pieces, cut into 6 to 8 round slices arranged together on one plate.",
    "Every piece should have rice on the outside, avocado or crab inside, and different colorful toppings of salmon, tuna, white fish, shrimp, or avocado across the top.",
    "The fish or avocado toppings should be draped over the outside/top of the roll pieces like colorful blankets, not hidden only inside the filling.",
    "The camera should clearly show the circular roll cross-sections plus rainbow-colored layers on top of each roll slice.",
    "Do not show nigiri, sashimi, individual fish over rice, plain maki with only interior filling, dragon roll with eel sauce, or a single uncut sushi log.",
  ].join(" "),
  "risotto-ai-gamberi": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian shrimp risotto as creamy short-grain rice with large pink shrimp mixed in and on top.",
    "The risotto should look glossy and creamy, with parsley, parmesan, or lemon garnish on a shallow plate.",
    "Do not show paella, shrimp pasta, fried rice, curry rice, seafood soup, or plain boiled rice.",
  ].join(" "),
  "mie-goreng-indonesian": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indonesian mie goreng as dry stir-fried yellow noodles in a glossy reddish-brown sweet soy and chili sauce.",
    "Visible yellow noodles, fried egg or egg strips, chicken or shrimp, cabbage, scallions, fried shallots, lime, and cucumber garnish.",
    "Do not show noodle soup, spaghetti, pad thai, char kway teow flat noodles, fried rice, or plain ramen.",
  ].join(" "),
  "nasi-goreng-indonesian": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indonesian nasi goreng as dark brown fried rice seasoned with kecap manis, served on a plate.",
    "Visible fried egg on top, cucumber slices, tomato, shrimp crackers, fried shallots, and small chicken or shrimp pieces mixed into the rice.",
    "Do not show biryani, plain white rice, curry rice, paella, poke bowl, nasi lemak, or Chinese pale fried rice.",
  ].join(" "),
  "smorrebrod": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Danish smorrebrod as at least three separate open-faced sandwiches arranged on one plate.",
    "Each sandwich must have a visible rectangular dark rye bread base underneath the toppings.",
    "Top the rye bread with pickled herring or smoked salmon, sliced egg, shrimp, radish, dill, cucumber, or creamy sauce.",
    "Do not show a bowl, salad, closed sandwich, burger, toast stack, pizza, bruschetta, or a generic charcuterie board.",
  ].join(" "),
  "spaghetti-alle-vongole": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian spaghetti alle vongole as long spaghetti tossed with many open clams in shells.",
    "Use a light olive oil, garlic, white wine, parsley, and chili flake style sauce, with clams clearly mixed through the pasta.",
    "Do not show mussels, seafood risotto, paella, clam chowder, tomato-heavy seafood pasta, or noodle soup.",
  ].join(" "),
  "takoyaki": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese takoyaki as round octopus balls arranged on a tray or plate.",
    "Visible bonito flakes, aonori seaweed powder, mayonnaise zigzags, takoyaki sauce, and toothpicks or skewers nearby.",
    "Do not show sushi, meatballs, arancini, donut holes, squid rings, okonomiyaki, or octopus tentacle slices.",
  ].join(" "),
  "sashimi": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese sashimi as sliced raw fish without rice, arranged neatly on a plate.",
    "Use a simple selection of salmon, tuna, and white fish slices with shiso leaf, daikon radish, wasabi, and soy sauce.",
    "Do not show sushi rice, nigiri, maki rolls, fugu chrysanthemum arrangement, poke bowl, cooked fish, or whole fish.",
  ].join(" "),
  "sashimi-platter": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese sashimi platter as a generous assorted raw fish platter without rice.",
    "Include multiple fish types such as salmon, tuna, white fish, shrimp or scallop, arranged on a large plate with shiso, daikon, wasabi, and lemon.",
    "Do not show nigiri, sushi rolls, poke bowl, seafood salad, fugu-only chrysanthemum slices, or cooked seafood.",
  ].join(" "),
  "spicy-tuna-roll": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese spicy tuna roll as 6 to 8 cut sushi roll pieces with spicy chopped tuna filling.",
    "The roll should show rice and nori structure, pink-red minced tuna inside, spicy mayo or chili flecks, sesame, and scallion garnish.",
    "Do not show nigiri, sashimi slices, California roll, rainbow roll, tuna steak, poke bowl, or a single uncut sushi log.",
  ].join(" "),
  "sushi-nigiri-salmon": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show salmon nigiri sushi as individual oval rice pieces topped with glossy orange salmon slices.",
    "Each piece should clearly have white sushi rice underneath the salmon, with wasabi, ginger, or soy sauce nearby.",
    "Do not show sashimi without rice, maki rolls, rainbow roll, smoked salmon toast, grilled salmon, or a salmon fillet.",
  ].join(" "),
  "taiyaki": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese taiyaki as fish-shaped waffle pastries with a crisp golden exterior.",
    "At least one pastry can be split open to reveal red bean custard or cream filling, served as a sweet street snack.",
    "Do not show Korean bungeoppang in a paper bag, real fish, takoyaki balls, waffles without fish shape, dorayaki, or savory seafood.",
  ].join(" "),
  "sushi-nigiri-tuna": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show tuna nigiri sushi as individual oval rice pieces topped with deep red tuna slices.",
    "Each piece should clearly have white sushi rice underneath the tuna, with wasabi, pickled ginger, or soy sauce nearby.",
    "Do not show sashimi without rice, maki rolls, spicy tuna roll, tuna steak, poke bowl, or seared beef sushi.",
  ].join(" "),
  "sushi-nigiri-shrimp": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show shrimp nigiri sushi as individual oval rice pieces topped with cooked pink-orange shrimp.",
    "Each shrimp should be butterflied over white sushi rice, with clean nigiri shapes arranged on a plate.",
    "Do not show tempura shrimp, shrimp cocktail, sashimi without rice, maki rolls, fried prawns, or curry shrimp.",
  ].join(" "),
  "sushi-nigiri-eel": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show eel nigiri sushi as oval rice pieces topped with glossy grilled eel slices and dark tare sauce.",
    "The eel should sit on white sushi rice with a light nori band or sauce sheen, arranged neatly on a plate.",
    "Do not show unagi don rice bowl, sashimi, maki rolls, grilled fish fillet, eel noodles, or barbecue meat.",
  ].join(" "),
  "sushi-nigiri-octopus": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show octopus nigiri sushi as individual oval rice pieces topped with white and purple octopus slices.",
    "Each octopus slice should sit on white sushi rice, with visible suction-cup texture and clean nigiri presentation.",
    "Do not show takoyaki, sliced octopus tapas, sashimi without rice, maki rolls, octopus pasta, or squid rings.",
  ].join(" "),
  "tempura-shrimp": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese shrimp tempura as long whole shrimp coated in light golden crispy tempura batter.",
    "Serve several straight fried shrimp with tentsuyu dipping sauce, grated daikon, lemon, or shredded paper liner.",
    "Do not show shrimp nigiri, sushi rolls, fried chicken, breaded prawns with heavy crumbs, curry shrimp, or shrimp cocktail.",
  ].join(" "),
  "polpo-alla-lucchese": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian polpo alla Lucchese as tender octopus pieces in a rustic Tuscan tomato, olive, caper, and herb sauce.",
    "The octopus tentacles should be visibly curled with suction cups, served as a warm seafood main or appetizer.",
    "Do not show sushi, takoyaki, plain grilled octopus, squid rings, seafood pasta, paella, or a generic red stew without octopus.",
  ].join(" "),
  "rojak": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Singaporean or Malaysian rojak as a mixed fruit and vegetable salad coated in dark glossy shrimp-paste dressing.",
    "Include cucumber, pineapple, jicama or turnip, bean sprouts, tofu puffs or fried dough, crushed peanuts, and sesame.",
    "Do not show Western green salad, fruit salad with yogurt, Thai papaya salad, poke bowl, curry, noodles, or plain chopped fruit.",
  ].join(" "),
  "smorgasbord": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Scandinavian smorgasbord as a generous cold buffet-style platter with multiple small Nordic items.",
    "Include pickled herring, gravlax or smoked salmon, rye bread, cheeses, cured meats, boiled potatoes, dill, and small bowls.",
    "Do not show a single sandwich, burger, charcuterie only, sushi platter, breakfast buffet, salad bowl, or one large hot entree.",
  ].join(" "),
  "spaghetti-alle-cozze": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian spaghetti alle cozze as long spaghetti tossed with many opened mussels in their dark shells.",
    "Use a light garlic, white wine, olive oil, parsley, or tomato-tinged sauce, served in a pasta bowl.",
    "Do not show clam vongole, seafood paella, seafood risotto, mussel soup, ramen, black squid ink pasta, or generic seafood pasta without mussel shells.",
  ].join(" "),
  "tandoori-prawns": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian tandoori prawns as large prawns coated in bright red-orange yogurt spice marinade and charred from a tandoor grill.",
    "Serve with lemon wedges, onion rings, mint chutney, cilantro, and light grill marks on a plate or sizzling platter.",
    "Do not show shrimp curry, tempura, prawn masala gravy, shrimp cocktail, sushi, noodles, or plain grilled prawns without tandoori spice color.",
  ].join(" "),
  "tteokbokki": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean tteokbokki as thick cylindrical rice cakes coated in glossy bright red gochujang sauce.",
    "Include fish cake sheets, scallions, sesame seeds, and optionally a halved boiled egg in a shallow bowl or street-food pan.",
    "Do not show soup tteokguk, pasta, gnocchi, curry, stir-fried noodles, sushi, or plain white rice cakes without red sauce.",
  ].join(" "),
  "yakisoba": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese yakisoba as stir-fried wheat noodles with brown yakisoba sauce, cabbage, carrots, bean sprouts, and pork or seafood.",
    "Top with beni shoga red pickled ginger, aonori green seaweed powder, and bonito flakes if useful.",
    "Do not show ramen soup, soba in broth, spaghetti, pad thai, chow mein with dark soy sauce only, or plain fried rice.",
  ].join(" "),
  "yam-pla-muk": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai yam pla muk as a spicy squid salad with sliced white squid rings and tentacles, lime dressing, chili, red onion, celery, mint, and cilantro.",
    "The dish should look like a bright Thai salad, lightly dressed, with visible squid pieces and fresh herbs.",
    "Do not show fried calamari, grilled whole squid, seafood pasta, papaya salad without squid, octopus tapas, or soup.",
  ].join(" "),
  "tempeh-indonesian": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indonesian tempeh as sliced or cubed fermented soybean cake, golden fried or sauteed, with a clearly visible mosaic of whole soybeans in the cut faces.",
    "The soybean-grain texture must be obvious so it reads as tempeh, not smooth tofu or paneer.",
    "Serve with sambal, kecap manis glaze, cucumber, lime, or rice on the side, but keep tempeh as the clear subject.",
    "Do not show tofu cubes, paneer, chicken nuggets, fried potatoes, falafel, bread, or generic vegetable stir-fry.",
  ].join(" "),
  "aebleskiver": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Danish aebleskiver as round golden pancake balls dusted with powdered sugar.",
    "Serve several spherical pancakes with jam, berry compote, or a small dipping bowl, in a cozy Scandinavian dessert presentation.",
    "Do not show meatballs, takoyaki, doughnut holes with glaze, waffles, pancakes stacks, or savory fried balls.",
  ].join(" "),
  rakfisk: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Norwegian rakfisk as thin slices or pieces of fermented trout served cold on flatbread or lefse.",
    "Include sour cream, red onion, boiled potatoes, dill, and Scandinavian plating cues so it reads as Nordic preserved fish.",
    "Do not show cooked salmon fillets, sushi, sashimi platter, pickled herring, fish and chips, or generic smoked fish.",
  ].join(" "),
  "albondigas-espanolas": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Spanish albondigas as several round meatballs simmered in a rustic tomato sauce.",
    "Use a Spanish tapas-style clay dish or shallow bowl, with parsley and crusty bread if useful.",
    "Do not show Italian spaghetti meatballs, Swedish meatballs in cream sauce, kofta skewers, burger patties, or plain meatballs without sauce.",
  ].join(" "),
  anmitsu: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese anmitsu as a composed dessert bowl with agar jelly cubes, sweet red bean paste, shiratama mochi balls, fruit, and black sugar syrup.",
    "The dish should look colorful, chilled, and neatly arranged in a Japanese dessert bowl.",
    "Do not show shaved ice, bubble tea, fruit salad only, western pudding, mochi alone, or red bean soup.",
  ].join(" "),
  baghrir: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Moroccan baghrir as thin spongy semolina pancakes with many tiny holes across the surface.",
    "Serve stacked or folded with honey-butter syrup, mint tea, or a small Moroccan breakfast setting.",
    "Do not show American pancakes, crepes, naan, injera, waffles, flatbread without holes, or savory omelette.",
  ].join(" "),
  "bebek-bengil": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Balinese crispy duck, Bebek Bengil, as golden deep-fried duck with very crisp skin, served with sambal, rice, cucumber, and Indonesian garnish.",
    "The duck should be the clear subject, with a recognizable leg or half-duck shape and Balinese restaurant plating.",
    "Do not show Peking duck pancakes, duck confit, roast chicken, generic fried chicken, curry duck, or duck noodle soup.",
  ].join(" "),
  "bibim-guksu": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean bibim guksu as thin mixed noodles coated in vivid red gochujang sauce, served cold or room temperature.",
    "Include cucumber, sesame seeds, boiled egg, shredded vegetables, and a glossy spicy sauce so it reads as Korean spicy mixed noodles.",
    "Do not show soup noodles, naengmyeon buckwheat noodles in broth, ramen, spaghetti, pad thai, or plain stir-fried noodles.",
  ].join(" "),
  "bibim-naengmyeon": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean bibim naengmyeon as chewy dark buckwheat cold noodles mixed with red spicy sauce.",
    "Include sliced cucumber, Korean pear, boiled egg, sesame, and a stainless or cold noodle bowl presentation.",
    "Do not show noodle soup, bibim guksu wheat noodles, ramen, soba dipping noodles, spaghetti, or generic stir-fried noodles.",
  ].join(" "),
  bingsu: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean bingsu as a tall bowl of finely shaved milk ice, fluffy snow-like texture, topped with red beans, fruit, mochi, or condensed milk.",
    "The shaved ice mound should be the clear subject and look cold, airy, and dessert-like.",
    "Do not show ice cream scoops only, bubble tea, fruit smoothie, western parfait, panna cotta, or plain crushed ice.",
  ].join(" "),
  patbingsu: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean patbingsu as a generous mound of fluffy shaved milk ice in a wide dessert bowl.",
    "The red bean paste should be clearly visible on top or around the ice, with optional mochi cubes, condensed milk, fruit, and a spoon.",
    "It should read as a cold Korean shaved-ice dessert bowl, not a drink cup, not bubble tea, not a parfait glass, not an ice cream sundae, and not a smoothie.",
  ].join(" "),
  picarones: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Peruvian picarones as squash and sweet potato ring fritters, irregular golden-brown doughnut rings with a rustic handmade shape.",
    "They should be drizzled with dark chancaca syrup or served with syrup pooling on the plate, as a Peruvian street dessert.",
    "Do not show onion rings, churros, bagels, plain doughnuts, calamari rings, or savory fried rings without syrup.",
  ].join(" "),
  "princess-cake": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Swedish princess cake, prinsesstarta, as a smooth green marzipan dome cake dusted lightly with powdered sugar.",
    "The entire outside must be pastel green marzipan, with the green dome as the dominant first-read shape.",
    "Include a clean slice or whole dome with visible cream, sponge, and raspberry jam layers, plus a small pink marzipan rose if useful.",
    "Do not show a sandwich bun, burger, macaron, cream puff, plain sponge cake, cheesecake, or a white dome without green marzipan.",
  ].join(" "),
  "roti-prata": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Singapore roti prata as flaky layered flatbread, golden and blistered, torn into pieces or folded on a plate.",
    "Include a small bowl of curry dipping sauce nearby so it reads as Singapore/Malaysian prata, not Western breakfast.",
    "Do not show pancakes, waffles, omelette, egg stacks, crepes with syrup, naan only, paratha roll, or sweet dessert flatbread.",
  ].join(" "),
  semifreddo: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian semifreddo as a clean slice of semi-frozen dessert, mousse-like and creamy, served cold on a dessert plate.",
    "The slice should have visible structure such as chocolate, pistachio, berry, or nougat layers, with a chilled plated-dessert feel.",
    "Do not show whipped cream, soft-serve, panna cotta, tiramisu, cheesecake, ice cream scoops, meringue, or a plain cream swirl.",
  ].join(" "),
  "bo-luc-lac": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Vietnamese bo luc lac, shaking beef, as seared cubes of beef with browned edges, onions, bell peppers, tomato, and watercress or lettuce.",
    "Serve with lime-pepper dipping salt or rice in a Vietnamese restaurant plating.",
    "Do not show beef stew, steak slices, kebab skewers, bulgogi, curry beef, or generic stir-fried beef strips.",
  ].join(" "),
  "bruschetta-al-pomodoro": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian tomato bruschetta as toasted rustic bread topped with diced fresh tomatoes, basil, garlic, olive oil, and a little balsamic glaze.",
    "The crisp bread slices and bright tomato topping must be the clear subject, in an Italian appetizer presentation.",
    "Do not show pizza, caprese salad without bread, generic toast, crostini with cheese only, garlic bread, or sandwich.",
  ].join(" "),
  bulgogi: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean bulgogi as thin slices of marinated grilled beef, glossy and caramelized, with onions, scallions, sesame seeds, and lettuce or rice side.",
    "The beef should look like Korean BBQ marinated slices, not cubes or steak.",
    "Do not show bo luc lac beef cubes, steak, kebab, beef stew, yakiniku platter without marinade, or generic stir-fry.",
  ].join(" "),
  "cao-lau": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Vietnamese cao lau from Hoi An as thick chewy noodles with slices of char siu-style pork, fresh herbs, bean sprouts, crispy rice crackers, and a small amount of savory sauce.",
    "The dish should look dry or lightly sauced, not a soup, with Hoi An noodle bowl cues.",
    "Do not show pho, ramen, bun bo hue, generic stir-fried noodles, pad thai, or plain pork noodle soup.",
  ].join(" "),
  "cassata-siciliana": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Sicilian cassata as a colorful ricotta sponge cake with green marzipan, candied fruit, icing, and a neat sliced or whole cake presentation.",
    "It should look like an Italian celebration dessert with visible layers or decorated top.",
    "Do not show gelato, cheesecake, tiramisu, fruit tart, panna cotta, or plain sponge cake.",
  ].join(" "),
  chebakia: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Moroccan chebakia as flower-shaped fried sesame cookies coated in honey syrup and sprinkled with sesame seeds.",
    "Use a Moroccan tea-time dessert setting with several twisted flower pastries.",
    "Do not show churros, baklava, doughnuts, pretzels, cookies without honey glaze, or generic fried pastry.",
  ].join(" "),
  chendol: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Southeast Asian cendol as an iced dessert bowl or glass with green pandan jelly noodles, coconut milk, shaved ice, palm sugar syrup, and red beans if useful.",
    "The green jelly strands and coconut-palm sugar layers must be clearly visible.",
    "Do not show bubble tea, matcha latte, bingsu, halo-halo without green jelly, smoothie, or plain ice cream.",
  ].join(" "),
  "chicken-korma": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian chicken korma as tender chicken pieces in a pale creamy cashew or yogurt curry sauce, garnished with almonds, cilantro, and served with naan or basmati rice.",
    "The sauce should look mild, creamy, and golden-beige, not red or dark.",
    "Do not show butter chicken, tikka masala, biryani, Thai curry, fried chicken, or plain grilled chicken.",
  ].join(" "),
  "chiles-en-nogada": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Mexican chiles en nogada as stuffed poblano peppers covered with white walnut cream sauce, topped with red pomegranate seeds and green parsley.",
    "The Mexican flag colors white, red, and green should be obvious, with the poblano pepper shape visible.",
    "Do not show nachos, generic stuffed bell peppers, chile relleno with tomato sauce, tacos, curry, or plain roasted peppers.",
  ].join(" "),
  "churros-con-chocolate": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Spanish churros con chocolate as long ridged fried churros dusted with sugar, served with a small cup of thick dark hot chocolate for dipping.",
    "Use a Spanish cafe dessert setting; the churros should be straight or looped sticks with crisp ridges.",
    "Do not show doughnuts, eclairs, breadsticks, pretzels, churros without chocolate, waffles, or generic fried pastry.",
  ].join(" "),
  "cinnamon-roll-scandinavian": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Swedish cinnamon roll, kanelbulle, as twisted or spiral cardamom-cinnamon buns with pearl sugar on top.",
    "Use a Scandinavian bakery or fika setting, with several golden brown buns and visible cinnamon swirls.",
    "Do not show American iced cinnamon rolls, croissants, Danish pastries, bread rolls, muffins, or plain buns.",
  ].join(" "),
  "cochinillo-asado": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Spanish cochinillo asado as roast suckling pig with crisp golden skin, carved pieces or a small whole section on a rustic platter.",
    "Include Spanish roast presentation cues such as potatoes, herbs, or a Castilian serving plate.",
    "Do not show roast duck, pork ribs, generic roast pork slices, lechon kawali cubes, barbecue ribs, or pulled pork.",
  ].join(" "),
  "crema-catalana": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Catalan crema catalana as a shallow terracotta ramekin with a glassy caramelized sugar crust over yellow custard.",
    "Include a cinnamon stick, citrus peel, or small Spanish dessert setting to distinguish it from generic creme brulee.",
    "Do not show flan, panna cotta, creme brulee in a deep white ramekin, pudding cup, cheesecake, or caramel sauce dessert.",
  ].join(" "),
  "crostata-di-marmellata": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian crostata di marmellata as a rustic jam tart with a visible lattice pastry top and glossy red or apricot jam filling.",
    "Use a sliced tart or whole round tart on a bakery plate, with crumbly shortcrust pastry.",
    "Do not show fruit tart with fresh fruit, cheesecake, pie without lattice, crostata with cream, pizza, or generic cookies.",
  ].join(" "),
  dakgalbi: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean dakgalbi as spicy stir-fried chicken pieces in red gochujang sauce with cabbage, sweet potato, rice cakes, scallions, and sesame.",
    "It should look like a hot Korean pan stir-fry, not deep-fried chicken.",
    "Do not show Korean fried chicken, bulgogi beef, curry chicken, chicken teriyaki, chicken stew, or generic stir-fried chicken without red sauce.",
  ].join(" "),
  karniyarik: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Turkish karnıyarık as whole eggplants split lengthwise and stuffed with minced meat, tomato, onion, and green pepper.",
    "The eggplants should be dark purple-black and roasted, served in a shallow tomato sauce with Turkish rice or yogurt optional.",
    "Do not show moussaka, baba ganoush dip, stuffed peppers, curry, generic grilled vegetables, or sliced eggplant casserole.",
  ].join(" "),
  "kaya-toast": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Singapore kaya toast as crisp rectangular toast slices cut into halves, with pale green kaya coconut jam and distinct cold butter slabs between the toast layers.",
    "Include soft-boiled eggs only in a separate small bowl and a kopi coffee cup if possible, like a kopitiam breakfast tray.",
    "No avocado, no green avocado mash, no salad leaves, no eggs on top of the toast, no poached egg topping.",
    "Do not show avocado toast, French toast, jam tart, sandwich with meat, pancakes, or plain buttered toast.",
  ].join(" "),
  kazandibi: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Turkish kazandibi as caramelized milk pudding with a dark browned bottom layer rolled or folded on a plate.",
    "The dessert should look creamy white with a burnt golden-brown surface, often dusted lightly with cinnamon.",
    "Do not show creme brulee in a ramekin, flan, panna cotta, baklava, cheesecake, rice pudding bowl, or chocolate cake.",
  ].join(" "),
  "keema-matar": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian keema matar as minced meat curry with green peas in a thick reddish-brown masala sauce.",
    "Serve in a bowl with visible ground meat texture, peas, cilantro garnish, and naan or basmati rice nearby.",
    "Do not show dal, chickpea curry, biryani, meatballs, kebab skewers, soup, or plain peas.",
  ].join(" "),
  "khanom-buang": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai khanom buang as small thin crispy folded crepes, like taco-shaped wafers, filled with white meringue cream.",
    "Include orange sweet egg yolk threads or green scallion/coconut toppings on multiple folded crepes.",
    "Do not show kanom krok coconut cup pancakes, flat pancakes, tacos with meat, cookies, macarons, or rolled crepes.",
  ].join(" "),
  "khao-man-gai-thai": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai khao man gai as sliced poached chicken laid over fragrant chicken rice with cucumber slices and cilantro.",
    "Include a small bowl of clear chicken soup and a dark fermented soybean ginger chili dipping sauce.",
    "Do not show fried chicken rice, biryani, curry rice, roast duck rice, chicken teriyaki bowl, or generic Hainanese chicken without Thai dipping sauce.",
  ].join(" "),
  "khao-mok-gai": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai khao mok gai as yellow turmeric-spiced rice with a whole chicken leg or large chicken piece on top.",
    "Include fried shallots, cucumber slices, cilantro or mint, and green chili dipping sauce in Thai Muslim biryani style.",
    "Do not show Indian biryani pot, plain chicken rice, curry, fried chicken meal, kebab plate, or generic yellow rice without chicken.",
  ].join(" "),
  kheer: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian kheer as creamy white rice pudding in a small bowl, garnished with pistachios, almonds, saffron strands, or rose petals.",
    "The texture should be thick, milky, and spoonable, with visible rice grains and nuts.",
    "Do not show Western rice pudding with berries, porridge, panna cotta, ice cream, custard flan, or soup.",
  ].join(" "),
  "knafeh-me": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Middle Eastern knafeh as an orange-golden shredded kataifi pastry dessert with melted cheese or cream inside.",
    "Serve a square or round slice with syrup sheen and crushed pistachios on top, showing stringy cheese if possible.",
    "Do not show baklava layers, cheesecake, noodle stir-fry, omelette, pizza, or Turkish kazandibi pudding.",
  ].join(" "),
  "korean-bbq-platter": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show a Korean BBQ platter on or beside a table grill with sliced marinated beef, pork belly, lettuce wraps, kimchi, garlic, ssamjang, and banchan side dishes.",
    "It should look like shared Korean barbecue with multiple meats and side dishes, not one single steak.",
    "Do not show Western barbecue ribs, burger platter, yakitori skewers, hot pot, bibimbap, or generic grilled meat without banchan.",
  ].join(" "),
  "korean-fried-chicken": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean fried chicken as crispy double-fried chicken pieces coated in glossy red gochujang sweet-spicy sauce, with sesame seeds and scallions.",
    "A mix of wings and boneless chunks in a Korean chicken bowl or basket is ideal, with pickled radish nearby.",
    "Do not show plain American fried chicken, karaage, chicken nuggets, grilled chicken, chicken curry, or buffalo wings with blue cheese.",
  ].join(" "),
  kulfi: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian kulfi as dense frozen ice cream on a stick or sliced into thick pieces, pale cream or pistachio-green, garnished with pistachios and saffron.",
    "It should look like traditional kulfi, richer and denser than Western ice cream, served on a small dessert plate.",
    "Do not show gelato scoops, popsicles with fruit, falooda drink, pudding, cheesecake, or soft-serve ice cream.",
  ].join(" "),
  "kulfi-falooda": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian kulfi falooda as a tall glass or bowl dessert with kulfi, falooda vermicelli, rose syrup, basil seeds, milk, and pistachios.",
    "Visible thin vermicelli strands, pink rose syrup, creamy kulfi pieces, and nuts should make it unmistakable.",
    "Do not show plain kulfi on a stick, milkshake, bubble tea, fruit parfait, spaghetti dessert, or ice cream sundae without falooda vermicelli.",
  ].join(" "),
  kunefe: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Turkish künefe as a round orange-golden shredded kataifi pastry with melted cheese inside, served in a shallow metal pan or on a plate.",
    "Include syrup sheen, crushed pistachios, and stretchy cheese if cut; it should feel Turkish rather than generic Middle Eastern.",
    "Do not show baklava, kazandibi pudding, cheesecake, pizza, omelette, or a plain square cake.",
  ].join(" "),
  "lod-chong": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai lod chong as green pandan jelly noodles in coconut milk with crushed ice, palm sugar syrup, and a dessert bowl or glass.",
    "The green pandan jelly noodles must be visible and short, soft, and glossy in white coconut milk.",
    "Do not show savory green noodles, ramen, pasta, cendol with red beans, matcha latte, bubble tea, or plain coconut pudding.",
  ].join(" "),
  "lokum-turkish": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Turkish lokum, Turkish delight, as small pastel cubes dusted with powdered sugar, some with pistachios or rose color.",
    "Arrange the cubes on a small Turkish dessert plate with tea or ornate serving cues.",
    "Do not show mochi, marshmallows, jelly beans, baklava, cake, or a bowl of ice cream.",
  ].join(" "),
  "lomo-saltado": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Peruvian lomo saltado as stir-fried beef strips with onions, tomatoes, cilantro, and French fries, served with white rice.",
    "The dish should look like a wok-fried beef plate with fries mixed in or alongside, classic Chifa Peruvian style.",
    "Do not show steak with fries, beef stew, fajitas, curry, kebab, or plain fried rice.",
  ].join(" "),
  "malai-kofta": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian malai kofta as paneer-potato dumpling balls in a rich creamy orange or pale cream sauce, garnished with cream and cilantro.",
    "The kofta balls should be visible in the cream sauce, with naan or basmati rice nearby.",
    "Do not show meatballs in tomato sauce, butter chicken, dal, chickpea curry, soup, or dry potato balls without sauce.",
  ].join(" "),
  "massaman-curry": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai massaman curry as a rich brown-orange curry with tender beef or chicken chunks, peanuts and potatoes clearly visible.",
    "Serve it in a bowl with jasmine rice nearby, showing a thick coconut curry sauce and Thai garnish.",
    "Do not show Indian curry, plain red curry, soup, satay, biryani, or generic stew without peanuts and potatoes.",
  ].join(" "),
  "mazamorra-morada": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Peruvian mazamorra morada as a deep purple corn pudding in a glass or bowl, thick and glossy, sprinkled with cinnamon.",
    "Include small fruit pieces such as pineapple or apple if possible, with a Peruvian dessert presentation.",
    "Do not show purple smoothie, berry yogurt, acai bowl, chocolate pudding, black sesame soup, or a drink.",
  ].join(" "),
  "mole-negro": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Mexican mole negro as chicken or turkey covered in a very dark black-brown mole sauce, with sesame seeds and Mexican rice.",
    "The dark black-brown mole sauce should look rich and glossy, not like chocolate dessert sauce.",
    "Do not show plain beef stew, curry, barbecue sauce, chocolate cake, black bean soup, or mole poblano with red sauce.",
  ].join(" "),
  "mole-poblano": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Mexican mole poblano as chicken covered in reddish-brown mole sauce, topped with sesame seeds, served with rice or tortillas.",
    "The sauce should look complex and savory, with Mexican plating cues, not a dessert or barbecue glaze.",
    "Do not show mole negro, chocolate pudding, curry, beef stew, tacos, or plain grilled chicken.",
  ].join(" "),
  "moo-ping": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai moo ping as grilled pork skewers, small caramelized pork pieces on bamboo sticks, slightly charred and glossy.",
    "Serve with sticky rice and Thai chili dipping sauce, like a Thai street-food breakfast.",
    "Do not show satay with peanut sauce, yakitori, kebab cubes, pork ribs, grilled steak, or generic barbecue platter.",
  ].join(" "),
  "muhammara-lebanese": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Lebanese muhammara as a red pepper walnut dip in a shallow bowl, topped with olive oil, walnuts, pomegranate molasses, and herbs.",
    "It should look like a thick red pepper walnut dip served with pita bread.",
    "Do not show hummus, tomato salsa, harissa paste, soup, curry, baba ganoush, or plain red sauce.",
  ].join(" "),
  "muhammara-me": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Middle Eastern muhammara as a red pepper walnut dip in a rustic bowl with olive oil, walnuts, pomegranate molasses, and pita.",
    "The dip must be thick, orange-red, and textured with nuts or breadcrumbs.",
    "Do not show hummus, tomato salsa, harissa paste, soup, curry, baba ganoush, or plain red sauce.",
  ].join(" "),
  mujadara: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Middle Eastern mujadara as lentils and rice topped with lots of crispy caramelized onions.",
    "The plate should show brown lentils mixed with rice or bulgur, onion garnish, yogurt or salad optional.",
    "Do not show biryani, pilaf with meat, fried rice, plain lentil soup, beans in sauce, or curry.",
  ].join(" "),
  "mutter-paneer": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian mutter paneer as paneer cubes and green peas in a red-orange tomato curry sauce.",
    "Paneer cubes and green peas should be clearly visible, with naan or basmati rice nearby.",
    "Do not show palak paneer, malai kofta, butter chicken, chickpea curry, dal, or plain pea soup.",
  ].join(" "),
  "swedish-meatballs": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Swedish meatballs as many small browned meatballs on a plate with creamy gravy, mashed potatoes, lingonberry jam, and cucumber pickle.",
    "The meatballs should be round bite-size pieces, not one large steak or burger patty, with a Scandinavian home-style presentation.",
    "Do not show Italian meatballs in tomato sauce, kofta curry, hamburger, sausage, beef stew, or pasta with red sauce.",
  ].join(" "),
  "tempura-vegetable": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese vegetable tempura as a pile of assorted battered vegetables fried pale golden and crisp, arranged on a plate or bamboo tray with tentsuyu dipping sauce.",
    "All vegetables must be coated in lumpy pale-gold batter with irregular crispy edges; only small glimpses of sweet potato, pumpkin, eggplant, shiso leaf, mushroom, lotus root, or green beans may show through the batter.",
    "The image should look like deep-fried tempura pieces, not a vegetable bento or salad.",
    "Do not show shrimp tempura, no shrimp or seafood, French fries, onion rings, pakora, spring rolls, fried chicken, raw vegetable salad, no raw vegetable sticks, steamed vegetables, fresh colorful vegetables, or mixed salad.",
  ].join(" "),
  "thai-spring-rolls": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai fried spring rolls as several small crisp golden rolls cut or stacked on a plate with sweet chili dipping sauce.",
    "They should look like thin cylindrical fried rolls with visible flaky wrappers, Thai herbs or lettuce garnish optional.",
    "Do not show fresh Vietnamese rice paper rolls, burritos, egg rolls with thick wrappers, samosas, sushi rolls, or fried mozzarella sticks.",
  ].join(" "),
  "tortellini-panna": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian tortellini alla panna as ring-shaped stuffed pasta coated in a pale creamy sauce.",
    "The tortellini should be small folded pasta rings or navel shapes, with parmesan, black pepper, and a shallow white cream sauce.",
    "Do not show ravioli squares, penne, spaghetti, gnocchi, soup tortellini in broth, or tomato sauce pasta.",
  ].join(" "),
  "tortilla-espanola": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Spanish potato omelette, tortilla espanola, as a thick golden egg-and-potato omelette served as a wedge or round slice.",
    "The cut face should show layered potato slices inside the egg, tapas-style on a simple plate.",
    "Do not show Mexican tortillas, wraps, flatbread, tamagoyaki, Western omelette with fillings, frittata with vegetables, or pancakes.",
  ].join(" "),
  "tostada-con-tomate": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Spanish tomato toast, tostada con tomate, as toasted rustic bread topped with grated tomato, olive oil, and a pinch of salt.",
    "It should look like pan con tomate breakfast tapas, with red crushed tomato spread on toasted bread, not diced bruschetta.",
    "Do not show Italian bruschetta with tomato cubes, no diced tomato cubes, avocado toast, pizza, sandwich, plain toast, or sweet jam toast.",
  ].join(" "),
  "shahi-paneer": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Indian shahi paneer as paneer cubes in a rich creamy royal curry sauce, pale orange or golden beige.",
    "Include visible paneer cubes, cream swirl, cashews or nuts, cilantro garnish, and naan or basmati rice nearby.",
    "Do not show palak paneer, mutter paneer with many peas, butter chicken, dal, chickpea curry, or plain soup.",
  ].join(" "),
  "tacos-al-pastor": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Mexican tacos al pastor as 2-3 open-face small corn tortillas, not rolled or wrapped shut.",
    "Each tortilla should be visibly open with reddish marinated pork shaved from a spit, pineapple chunks, diced onion, cilantro, lime wedge, and charred pork edges.",
    "Do not show ground beef tacos, burritos, closed wraps, rolled tortillas, quesadillas, pizza, shawarma wrap, or generic hard-shell tacos.",
  ].join(" "),
  tamagoyaki: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese tamagoyaki as a neat rectangular rolled omelette cut into thick golden slices.",
    "The layered egg roll structure should be visible, served on a simple plate with grated daikon or soy sauce optional.",
    "Do not show Western omelette, scrambled eggs, egg roll wrapper, sushi roll, pancake, or tortilla.",
  ].join(" "),
  tebasaki: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Nagoya tebasaki as Japanese fried chicken wings with glossy soy-sesame pepper glaze.",
    "Wings should be whole wing pieces, golden-brown, sprinkled with sesame seeds and black pepper, served as izakaya appetizer.",
    "Do not show Buffalo wings with red sauce, Korean fried chicken chunks, grilled yakitori skewers, nuggets, or plain roast chicken.",
  ].join(" "),
  "teriyaki-chicken": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese teriyaki chicken as sliced grilled chicken thigh glazed with glossy dark sweet soy teriyaki sauce.",
    "Serve with white rice or shredded cabbage, sesame seeds, scallions, and visible caramelized glaze.",
    "Do not show fried chicken, curry chicken, orange chicken, chicken wings, soup, or generic grilled chicken without glossy teriyaki sauce.",
  ].join(" "),
  sfiha: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Mediterranean sfiha as several small open-faced meat pies with thin golden dough and spiced minced meat topping.",
    "The pies should look like flat mini pastries, sometimes oval or boat-shaped, with tomato, onion, parsley, and browned ground meat visible.",
    "Do not show pizza slices, closed empanadas, pita pockets, lahmacun folded shut, tacos, burgers, or a single large pie.",
  ].join(" "),
  "sigeumchi-namul": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean sigeumchi namul as a blanched spinach side dish piled neatly in a small banchan bowl or plate.",
    "The spinach should be deep green, lightly glossy with sesame oil, sprinkled with toasted sesame seeds, and served as a small Korean side dish.",
    "Do not show raw spinach salad, creamed spinach, stir-fried mixed vegetables, pesto pasta, seaweed salad, or a green smoothie.",
  ].join(" "),
  sunomono: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese sunomono as thin cucumber slices in a small dish with clear vinegar dressing, sesame seeds, and optional wakame.",
    "The dish should look crisp, light, and chilled, with translucent cucumber rounds or ribbons arranged in a small Japanese bowl.",
    "Do not show green salad, pickles in a jar, cucumber sticks, coleslaw, seaweed-only salad, soup, or a Western plated salad.",
  ].join(" "),
  sutlac: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Turkish sutlac as baked rice pudding served in a small clay or ceramic bowl with a browned caramelized top.",
    "The rice pudding should look creamy white under the caramelized surface, with cinnamon dusting optional.",
    "Do not show creme brulee, flan, panna cotta, cheesecake, ice cream, porridge, or plain rice in a bowl.",
  ].join(" "),
  yakitori: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese yakitori as grilled chicken skewers on bamboo sticks, glazed with tare sauce and lightly charred.",
    "Several skewers should be lined up on a plate or grill, with bite-size chicken pieces, scallion pieces optional, and glossy caramelized sauce.",
    "Do not show chicken breast steak, satay with peanut sauce, kebab cubes, fried chicken, chicken wings, barbecue ribs, or generic grilled chicken platter.",
  ].join(" "),
  "tavuk-gogsu": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Turkish tavuk gogsu as a pale white milk pudding made with shredded chicken breast, served as a smooth rectangular slice or soft mound.",
    "The dessert should look creamy and delicate, lightly dusted with cinnamon or powdered sugar on a small plate.",
    "Do not show grilled chicken breast, chicken soup, custard flan, creme brulee, cheesecake, rice pudding, or savory chicken.",
  ].join(" "),
  "tres-leches-cake": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Latin American tres leches cake as a moist soaked sponge cake slice topped with whipped cream.",
    "The cake should look milky and soft, with visible sponge texture, a little milk syrup on the plate, and strawberries or cinnamon optional.",
    "Do not show cheesecake, layer birthday cake, tiramisu, flan, pound cake, dry sponge cake, or ice cream cake.",
  ].join(" "),
  "tub-tim-grob": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Thai tub tim grob as a red ruby water chestnut dessert served in a bowl with coconut milk and crushed ice.",
    "The dessert must include bright translucent red cubes or pearls, white coconut milk, ice, and tropical garnish optional.",
    "Do not show bubble tea, fruit punch, jelly cubes alone, red bean soup, strawberry parfait, shaved ice without red rubies, or cocktail.",
  ].join(" "),
  "umm-ali": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Middle Eastern Umm Ali as a warm bread pudding baked in a shallow dish or bowl.",
    "It should have flaky pastry pieces soaked in milk or cream, toasted nuts, raisins, coconut, and a golden baked top.",
    "Do not show rice pudding, creme brulee, baklava pieces, cheesecake, custard flan, oatmeal, or plain bread.",
  ].join(" "),
  uttapam: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show South Indian uttapam as a thick savory rice pancake cooked on a griddle, topped with diced onion, tomato, green chili, and cilantro.",
    "The pancake should be round, lightly browned, spongy, and served with coconut chutney and sambar on the side.",
    "Do not show dosa roll, naan, pizza, sweet pancakes, omelette, flatbread wrap, or paratha.",
  ].join(" "),
  "yangnyeom-chicken": [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Korean yangnyeom chicken as bite-size fried chicken pieces coated in glossy red sweet spicy sauce.",
    "The chicken should look crispy under the glaze, garnished with sesame seeds or scallions, served in a bowl or plate.",
    "Do not show buffalo wings, plain fried chicken, grilled chicken, orange chicken, chicken curry, nuggets, or yakitori skewers.",
  ].join(" "),
  Sellou: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Moroccan sellou as a sesame almond sweet made from toasted flour, ground almonds, sesame seeds, honey, and warm spices.",
    "It should look like a brown crumbly or molded mound on a small plate, dusted with powdered sugar or sesame, often served with tea.",
    "Do not show cake slices, brownies, halva bars, cookies, couscous, granola, baklava, or chocolate pudding.",
  ].join(" "),
  yokan: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Japanese yokan as a smooth red bean jelly cut into neat rectangular slices or bars.",
    "The jelly should be glossy dark red-brown, dense, clean-edged, and served with green tea or on a minimal plate.",
    "Do not show mochi, wagashi balls, cake, pudding cup, gelatin cubes in syrup, chocolate fudge, or red bean soup.",
  ].join(" "),
  zeppole: [
    "CRITICAL LOCAL LIBRARY IMAGE:",
    "Show Italian zeppole as golden fried dough pastries, small round fritters or piped rings, dusted with powdered sugar.",
    "They may include pastry cream or cherry garnish, served as a pile of warm fried pastries on a plate.",
    "Do not show doughnuts with holes only, churros, cream puffs, pancakes, cookies, onion rings, or savory fried seafood.",
  ].join(" "),
};

function dishInputForEntry(entry) {
  return {
    name_original: preferredEnglishName(entry),
    name_translated: {
      zh: preferredChineseName(entry),
      en: preferredEnglishName(entry),
    },
    description: entry.description || {},
    ingredients: Array.isArray(entry.ingredients) ? entry.ingredients : [],
    category: entry.category || "",
    image_prompt_hint: SPECIAL_BACKFILL_IMAGE_HINTS[entry.id],
  };
}

function categoryWeight(entry) {
  const text = [entry.category, ...(entry.names || []), entry.description?.en, entry.description?.zh]
    .join(" ")
    .toLowerCase();
  if (/drink|coffee|tea|lassi|smoothie|juice|beverage|饮/.test(text)) return 34;
  if (/soup|broth|stew|pho|ramen|汤/.test(text)) return 32;
  if (/pizza|burger|sandwich|wrap|meal|combo/.test(text)) return 30;
  if (/seafood|fish|shrimp|prawn|crab|oyster|scallop|clam|鱼|虾|蟹|蚝|贝/.test(text)) return 28;
  if (/dessert|cake|pudding|ice cream|gelato|sweet|甜/.test(text)) return 22;
  if (/noodle|rice|pasta|面|饭|粉/.test(text)) return 20;
  return 16;
}

function commonStapleWeight(entry) {
  const text = (entry.names || []).join(" ").toLowerCase();
  if (/\b(?:naan|garlic naan|pho|ramen|tikka masala|biryani|pad thai|mango lassi|masala chai|tiramisu|carbonara|margherita|burger|sandwich)\b/.test(text)) {
    return 25;
  }
  return 0;
}

function rankEntries(entries) {
  return entries
    .map((entry) => ({
      entry,
      score: commonStapleWeight(entry) + categoryWeight(entry),
    }))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .map(({ entry }) => entry);
}

function entryNameKeys(entry) {
  return new Set((entry.names || []).map(normalizeName).filter(Boolean));
}

function findEquivalentLocalImage(db, entry) {
  const keys = entryNameKeys(entry);
  if (keys.size === 0) return null;
  for (const other of db) {
    if (other.id === entry.id) continue;
    if (!isLocalImage(other.card) || !isLocalImage(other.hero)) continue;
    const otherKeys = entryNameKeys(other);
    for (const key of keys) {
      if (otherKeys.has(key)) {
        return {
          source_id: other.id,
          card: other.card,
          hero: other.hero,
          matched_name: key,
        };
      }
    }
  }
  return null;
}

async function loadImageGenModule() {
  mkdirSync(TMP_MODULE_DIR, { recursive: true });
  const source = await readFile(IMAGE_GEN_TS, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    fileName: IMAGE_GEN_TS,
  }).outputText;
  await writeFile(IMAGE_GEN_MJS, compiled);
  return import(`${pathToFileURL(IMAGE_GEN_MJS).href}?t=${Date.now()}`);
}

async function saveOptimizedWebp(imageUrl, entryId) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`fetch generated image failed (${response.status})`);
  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const output = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_DIM,
      height: MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    })
      .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer();
  await mkdir(DISHES_DIR, { recursive: true });
  await writeFile(join(DISHES_DIR, safeLocalDishFilename(entryId)), output);
  return output.length;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withItemTimeout(promise, entryId) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Wan backfill item timed out after ${ITEM_TIMEOUT_MS}ms: ${entryId}`));
    }, ITEM_TIMEOUT_MS);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

function saveKnowledgeDb(db) {
  writeFileSync(DB_PATH, `${JSON.stringify(db)}\n`, "utf8");
}

function shouldIncludeCandidate(entry) {
  const isTargeted = TARGET_IDS.size === 0 || TARGET_IDS.has(entry.id);
  if (!isTargeted) return false;
  if (FORCE && TARGET_IDS.has(entry.id)) return true;
  return isNeedsBackfill(entry) && !hasLocalFile(entry);
}

readLocalEnvFile();
process.env.IMAGE_PROVIDER = "wan";

const db = JSON.parse(readFileSync(DB_PATH, "utf8"));
const candidates = rankEntries(
  db.filter((entry) => shouldIncludeCandidate(entry)),
).slice(0, TARGET_IDS.size > 0 ? Number.MAX_SAFE_INTEGER : Math.max(1, LIMIT));

const report = {
  ok: true,
  dry_run: !APPLY,
  model: process.env.WAN_MODEL || "wanx2.1-t2i-turbo",
  candidates: candidates.map((entry) => ({
    id: entry.id,
    names: entry.names,
    category: entry.category,
    output_path: localDishImagePath(entry),
  })),
  summary: {
    generated: 0,
    reused: 0,
    updated_json: 0,
    failed: 0,
  },
  item_timeout_ms: ITEM_TIMEOUT_MS,
  events: [],
  reused: [],
  failures: [],
};

function recordEvent(event) {
  const enriched = {
    at: new Date().toISOString(),
    ...event,
  };
  report.events.push(enriched);
  console.error(`[Backfill progress] ${JSON.stringify(enriched)}`);
}

if (!APPLY) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (!process.env.QWEN_API_KEY) {
  console.log(JSON.stringify({
    ok: false,
    error: "QWEN_API_KEY is required for Wan backfill generation",
  }, null, 2));
  process.exit(1);
}

const { generateDishImageWithError } = await loadImageGenModule();

for (const [index, entry] of candidates.entries()) {
  const dish = dishInputForEntry(entry);
  recordEvent({ status: "started", index: index + 1, total: candidates.length, id: entry.id });
  try {
    if (!FORCE && !SPECIAL_BACKFILL_IMAGE_HINTS[entry.id]) {
      const equivalent = findEquivalentLocalImage(db, entry);
      if (equivalent) {
        entry.card = equivalent.card;
        entry.hero = equivalent.hero;
        report.summary.reused++;
        report.summary.updated_json++;
        report.reused.push({
          id: entry.id,
          source_id: equivalent.source_id,
          matched_name: equivalent.matched_name,
          url: equivalent.card,
        });
        saveKnowledgeDb(db);
        recordEvent({ status: "reused", index: index + 1, total: candidates.length, id: entry.id, source_id: equivalent.source_id });
        continue;
      }
    }

    const { url, error } = await withItemTimeout(generateDishImageWithError(dish), entry.id);
    if (!url) throw new Error(error || "Wan returned no image URL");
    await saveOptimizedWebp(url, entry.id);
    const localPath = localDishImagePath(entry);
    entry.card = localPath;
    entry.hero = localPath;
    report.summary.generated++;
    report.summary.updated_json++;
    saveKnowledgeDb(db);
    recordEvent({ status: "generated", index: index + 1, total: candidates.length, id: entry.id, url: localPath });
    await sleep(DELAY_MS);
  } catch (error) {
    report.ok = false;
    report.summary.failed++;
    const message = error instanceof Error ? error.message : String(error);
    report.failures.push({
      id: entry.id,
      error: message,
    });
    recordEvent({ status: "failed", index: index + 1, total: candidates.length, id: entry.id, error: message });
  }
}

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
