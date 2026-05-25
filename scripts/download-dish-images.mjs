#!/usr/bin/env node
// Download dish images from Unsplash (and Pexels if key provided)
// Usage: node scripts/download-dish-images.mjs
// Set PEXELS_API_KEY env var to also search Pexels

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
const PEXELS_KEY = process.env.PEXELS_API_KEY || "";
const OUT_DIR = join(import.meta.dirname, "..", "public", "dishes");
const DB_OUT = join(import.meta.dirname, "..", "src", "lib", "dish-image-db.ts");
const DELAY = 1200; // ms between requests

// ── 500 Dish Database ──────────────────────────────────────────────
const dishes = [
  // ═══ FRENCH (70) ═══
  { id:"foie-gras",en:"Foie Gras",zh:"鹅肝酱",cuisine:"french" },
  { id:"escargots",en:"Escargots de Bourgogne",zh:"勃艮第蜗牛",cuisine:"french" },
  { id:"croque-monsieur",en:"Croque Monsieur",zh:"法式火腿芝士三明治",cuisine:"french" },
  { id:"creme-brulee",en:"Crème Brûlée",zh:"焦糖布丁",cuisine:"french" },
  { id:"coq-au-vin",en:"Coq au Vin",zh:"红酒炖鸡",cuisine:"french" },
  { id:"bouillabaisse",en:"Bouillabaisse",zh:"马赛鱼汤",cuisine:"french" },
  { id:"steak-frites",en:"Steak Frites",zh:"牛排配薯条",cuisine:"french" },
  { id:"ratatouille",en:"Ratatouille",zh:"普罗旺斯炖菜",cuisine:"french" },
  { id:"quiche-lorraine",en:"Quiche Lorraine",zh:"洛林乳蛋饼",cuisine:"french" },
  { id:"french-onion-soup",en:"French Onion Soup",zh:"法式洋葱汤",cuisine:"french" },
  { id:"confit-de-canard",en:"Confit de Canard",zh:"油封鸭",cuisine:"french" },
  { id:"tarte-tatin",en:"Tarte Tatin",zh:"反转苹果挞",cuisine:"french" },
  { id:"souffle",en:"Soufflé",zh:"舒芙蕾",cuisine:"french" },
  { id:"beef-bourguignon",en:"Bœuf Bourguignon",zh:"勃艮第红酒炖牛肉",cuisine:"french" },
  { id:"salad-nicoise",en:"Salade Niçoise",zh:"尼斯沙拉",cuisine:"french" },
  { id:"pot-au-feu",en:"Pot-au-Feu",zh:"法式炖肉锅",cuisine:"french" },
  { id:"blanquette-de-veau",en:"Blanquette de Veau",zh:"小牛肉白汁炖锅",cuisine:"french" },
  { id:"sole-meuniere",en:"Sole Meunière",zh:"黄油煎比目鱼",cuisine:"french" },
  { id:"cassoulet",en:"Cassoulet",zh:"卡酥莱砂锅",cuisine:"french" },
  { id:"tartare-de-boeuf",en:"Steak Tartare",zh:"生牛肉塔塔",cuisine:"french" },
  { id:"gratin-dauphinois",en:"Gratin Dauphinois",zh:"多菲内焗土豆",cuisine:"french" },
  { id:"profiteroles",en:"Profiteroles",zh:"奶油泡芙",cuisine:"french" },
  { id:"moules-mariniere",en:"Moules Marinières",zh:"白葡萄酒蒸青口贝",cuisine:"french" },
  { id:"duck-magret",en:"Magret de Canard",zh:"煎鸭胸",cuisine:"french" },
  { id:"croissant",en:"Croissant",zh:"牛角面包",cuisine:"french" },
  { id:"eclair",en:"Éclair",zh:"闪电泡芙",cuisine:"french" },
  { id:"macaron",en:"Macaron",zh:"马卡龙",cuisine:"french" },
  { id:"crêpe",en:"Crêpe",zh:"法式薄饼",cuisine:"french" },
  { id:"galette",en:"Buckwheat Galette",zh:"荞麦薄饼",cuisine:"french" },
  { id:"panna-cotta",en:"Panna Cotta",zh:"意式奶冻",cuisine:"french" },
  { id:"bavette",en:"Bavette Steak",zh:"裙边牛排",cuisine:"french" },
  { id:"entrecote",en:"Entrecôte",zh:"肋眼牛排",cuisine:"french" },
  { id:"filet-mignon",en:"Filet Mignon",zh:"菲力牛排",cuisine:"french" },
  { id:"hachis-parmentier",en:"Hachis Parmentier",zh:"法式牧羊人派",cuisine:"french" },
  { id:"quenelle",en:"Quenelle",zh:"法式鱼肉饺",cuisine:"french" },
  { id:"brandade",en:"Brandade de Morue",zh:"鳕鱼泥",cuisine:"french" },
  { id:"tapenade",en:"Tapenade",zh:"橄榄酱",cuisine:"french" },
  { id:"pissaladiere",en:"Pissaladière",zh:"洋葱鳀鱼披萨",cuisine:"french" },
  { id:"soupe-a-loignon",en:"Soupe à l'Oignon",zh:"洋葱汤",cuisine:"french" },
  { id:"tarte-au-citron",en:"Tarte au Citron",zh:"柠檬挞",cuisine:"french" },
  { id:"mille-feuille",en:"Mille-Feuille",zh:"千层酥",cuisine:"french" },
  { id:"ile-flottante",en:"Île Flottante",zh:"漂浮岛甜点",cuisine:"french" },
  { id:"poire-belle-helene",en:"Poire Belle Hélène",zh:"巧克力梨甜品",cuisine:"french" },
  { id:"choucroute",en:"Choucroute Garnie",zh:"酸菜炖肉",cuisine:"french" },
  { id:"boudin-noir",en:"Boudin Noir",zh:"血肠",cuisine:"french" },
  { id:"terrine",en:"Terrine",zh:"肉酱冻",cuisine:"french" },
  { id:"paté",en:"Pâté",zh:"肉酱",cuisine:"french" },
  { id:"charcuterie",en:"Charcuterie Board",zh:"法式冷切拼盘",cuisine:"french" },
  { id:"fromage",en:"Cheese Board",zh:"法式奶酪拼盘",cuisine:"french" },
  { id:"oeuf-mayo",en:"Œuf Mayonnaise",zh:"蛋黄酱水煮蛋",cuisine:"french" },
  { id:"salad-lyonnaise",en:"Salade Lyonnaise",zh:"里昂沙拉",cuisine:"french" },
  { id:"fondue-savoyarde",en:"Fondue Savoyarde",zh:"萨瓦奶酪火锅",cuisine:"french" },
  { id:"raclette",en:"Raclette",zh:"拉克雷特奶酪",cuisine:"french" },
  { id:"tartiflette",en:"Tartiflette",zh:"奶酪土豆焗",cuisine:"french" },
  { id:"croute-au-fromage",en:"Croûte au Fromage",zh:"奶酪吐司",cuisine:"french" },
  { id:"gougere",en:"Gougère",zh:"奶酪泡芙",cuisine:"french" },
  { id:"œuf-cocotte",en:"Œuf en Cocotte",zh:"焗蛋盅",cuisine:"french" },
  { id:"flamiche",en:"Flamiche",zh:"韭葱派",cuisine:"french" },
  { id:"far-breton",en:"Far Breton",zh:"布列塔尼李子蛋糕",cuisine:"french" },
  { id:"kouign-amann",en:"Kouign-Amann",zh:"焦糖黄油酥饼",cuisine:"french" },
  { id:"canape",en:"Canapé",zh:"法式小点",cuisine:"french" },
  { id:"petit-four",en:"Petit Four",zh:"法式小蛋糕",cuisine:"french" },
  { id:"madeleine",en:"Madeleine",zh:"玛德琳蛋糕",cuisine:"french" },
  { id:"beignets",en:"Beignets",zh:"法式炸面团",cuisine:"french" },
  { id:"agneau-gigot",en:"Gigot d'Agneau",zh:"烤羊腿",cuisine:"french" },
  { id:"cote-d-agneau",en:"Côte d'Agneau",zh:"羊排",cuisine:"french" },
  { id:"tripe-a-la-mode",en:"Tripes à la Mode",zh:"苹果炖牛肚",cuisine:"french" },
  { id:"andalouse",en:"Sauce Andalouse",zh:"安达卢斯酱",cuisine:"french" },
  { id:"bearnaise",en:"Sauce Béarnaise",zh:"蛋黄酱",cuisine:"french" },
  { id:"hollandaise",en:"Sauce Hollandaise",zh:"荷兰酱",cuisine:"french" },
  { id:"beurre-blanc",en:"Beurre Blanc",zh:"白黄油酱",cuisine:"french" },

  // ═══ ITALIAN (60) ═══
  { id:"carbonara",en:"Carbonara",zh:"卡邦尼意面",cuisine:"italian" },
  { id:"margherita-pizza",en:"Pizza Margherita",zh:"玛格丽特披萨",cuisine:"italian" },
  { id:"risotto",en:"Risotto",zh:"意式烩饭",cuisine:"italian" },
  { id:"tiramisu",en:"Tiramisu",zh:"提拉米苏",cuisine:"italian" },
  { id:"bruschetta",en:"Bruschetta",zh:"意式烤面包",cuisine:"italian" },
  { id:"osso-buco",en:"Osso Buco",zh:"炖小牛膝",cuisine:"italian" },
  { id:"lasagna",en:"Lasagna",zh:"千层面",cuisine:"italian" },
  { id:"ravioli",en:"Ravioli",zh:"意式饺子",cuisine:"italian" },
  { id:"gelato",en:"Gelato",zh:"意式冰淇淋",cuisine:"italian" },
  { id:"cannoli",en:"Cannoli",zh:"奶油煎卷",cuisine:"italian" },
  { id:"minestrone",en:"Minestrone",zh:"意式蔬菜汤",cuisine:"italian" },
  { id:"penne-arrabbiata",en:"Penne all'Arrabbiata",zh:"辣味通心粉",cuisine:"italian" },
  { id:"spaghetti-bolognese",en:"Spaghetti Bolognese",zh:"肉酱意面",cuisine:"italian" },
  { id:"fettuccine-alfredo",en:"Fettuccine Alfredo",zh:"奶油宽面",cuisine:"italian" },
  { id:"gnocchi",en:"Gnocchi",zh:"土豆面团",cuisine:"italian" },
  { id:"prosciutto",en:"Prosciutto",zh:"帕尔马火腿",cuisine:"italian" },
  { id:"buratta",en:"Burrata",zh:"布拉塔奶酪",cuisine:"italian" },
  { id:"caprese",en:"Caprese Salad",zh:"卡普雷塞沙拉",cuisine:"italian" },
  { id:"panna-cotta-ita",en:"Panna Cotta",zh:"意式奶冻",cuisine:"italian" },
  { id:"calzone",en:"Calzone",zh:"折叠披萨",cuisine:"italian" },
  { id:"cacio-e-pepe",en:"Cacio e Pepe",zh:"芝士黑椒面",cuisine:"italian" },
  { id:"pepperoni-pizza",en:"Pepperoni Pizza",zh:"辣香肠披萨",cuisine:"italian" },
  { id:"amatriciana",en:"Amatriciana",zh:"番茄培根意面",cuisine:"italian" },
  { id:"vongole",en:"Spaghetti alle Vongole",zh:"蛤蜊意面",cuisine:"italian" },
  { id:"puttanesca",en:"Pasta Puttanesca",zh:"番茄橄榄意面",cuisine:"italian" },
  { id:"carpaccio",en:"Carpaccio",zh:"生牛肉薄片",cuisine:"italian" },
  { id:"arancini",en:"Arancini",zh:"炸饭团",cuisine:"italian" },
  { id:"suppli",en:"Supplì",zh:"炸饭团芝心",cuisine:"italian" },
  { id:"truffle-risotto",en:"Truffle Risotto",zh:"松露烩饭",cuisine:"italian" },
  { id:"seafood-risotto",en:"Seafood Risotto",zh:"海鲜烩饭",cuisine:"italian" },
  { id:"vitello-tonnato",en:"Vitello Tonnato",zh:"金枪鱼酱小牛肉",cuisine:"italian" },
  { id:"saltimbocca",en:"Saltimbocca",zh:"跳嘴肉卷",cuisine:"italian" },
  { id:"piccata",en:"Chicken Piccata",zh:"柠檬 caper 鸡排",cuisine:"italian" },
  { id:"marsala",en:"Chicken Marsala",zh:"玛莎拉酒鸡排",cuisine:"italian" },
  { id:"parmigiana",en:"Eggplant Parmigiana",zh:"帕尔马茄子",cuisine:"italian" },
  { id:"mozzarella-sticks",en:"Mozzarella Sticks",zh:"炸马苏里拉条",cuisine:"italian" },
  { id:"antipasto",en:"Antipasto Platter",zh:"意式开胃拼盘",cuisine:"italian" },
  { id:"focaccia",en:"Focaccia",zh:"佛卡夏面包",cuisine:"italian" },
  { id:"ciabatta",en:"Ciabatta",zh:"拖鞋面包",cuisine:"italian" },
  { id:"branzino",en:"Branzino",zh:"地中海鲈鱼",cuisine:"italian" },
  { id:"polenta",en:"Polenta",zh:"玉米糊",cuisine:"italian" },
  { id:"panzanella",en:"Panzanella",zh:"意式面包沙拉",cuisine:"italian" },
  { id:"biscotti",en:"Biscotti",zh:"意式脆饼",cuisine:"italian" },
  { id:"affogato",en:"Affogato",zh:"阿芙佳朵",cuisine:"italian" },
  { id:"limoncello",en:"Limoncello",zh:"柠檬酒",cuisine:"italian" },
  { id:"negroni",en:"Negroni",zh:"尼格罗尼鸡尾酒",cuisine:"italian" },
  { id:"espresso",en:"Espresso",zh:"浓缩咖啡",cuisine:"italian" },
  { id:"tortellini",en:"Tortellini",zh:"意式小馄饨",cuisine:"italian" },
  { id:"pappardelle",en:"Pappardelle",zh:"宽扁面",cuisine:"italian" },
  { id:"trofie-pesto",en:"Trofie al Pesto",zh:"罗勒松子面",cuisine:"italian" },
  { id:"pesto-pasta",en:"Pesto Pasta",zh:"青酱意面",cuisine:"italian" },
  { id:"stracciatella",en:"Stracciatella",zh:"碎巧克力冰淇淋",cuisine:"italian" },
  { id:" semifreddo",en:"Semifreddo",zh:"半冻甜品",cuisine:"italian" },
  { id:"crostini",en:"Crostini",zh:"脆面包片",cuisine:"italian" },
  { id:"insalata-mista",en:"Insalata Mista",zh:"混合沙拉",cuisine:"italian" },
  { id:"zuppa-di-pesce",en:"Zuppa di Pesce",zh:"意式海鲜汤",cuisine:"italian" },
  { id:"ribollita",en:"Ribollita",zh:"意式面包蔬菜汤",cuisine:"italian" },
  { id:"bistecca-fiorentina",en:"Bistecca alla Fiorentina",zh:"佛罗伦萨牛排",cuisine:"italian" },
  { id:"frutti-di-mare",en:"Frutti di Mare Pizza",zh:"海鲜披萨",cuisine:"italian" },
  { id:"diavola",en:"Pizza Diavola",zh:"辣味披萨",cuisine:"italian" },

  // ═══ JAPANESE (50) ═══
  { id:"sushi-platter",en:"Sushi Platter",zh:"寿司拼盘",cuisine:"japanese" },
  { id:"ramen",en:"Ramen",zh:"拉面",cuisine:"japanese" },
  { id:"tempura",en:"Tempura",zh:"天妇罗",cuisine:"japanese" },
  { id:"sashimi",en:"Sashimi",zh:"刺身",cuisine:"japanese" },
  { id:"miso-soup",en:"Miso Soup",zh:"味噌汤",cuisine:"japanese" },
  { id:"gyoza",en:"Gyoza",zh:"日式煎饺",cuisine:"japanese" },
  { id:"tonkatsu",en:"Tonkatsu",zh:"日式炸猪排",cuisine:"japanese" },
  { id:"udon",en:"Udon",zh:"乌冬面",cuisine:"japanese" },
  { id:"soba",en:"Soba Noodles",zh:"荞麦面",cuisine:"japanese" },
  { id:"teriyaki",en:"Teriyaki Chicken",zh:"照烧鸡",cuisine:"japanese" },
  { id:"yakitori",en:"Yakitori",zh:"日式烤串",cuisine:"japanese" },
  { id:"okonomiyaki",en:"Okonomiyaki",zh:"大阪烧",cuisine:"japanese" },
  { id:"takoyaki",en:"Takoyaki",zh:"章鱼烧",cuisine:"japanese" },
  { id:"katsu-curry",en:"Katsu Curry",zh:"咖喱炸猪排饭",cuisine:"japanese" },
  { id:"bento",en:"Bento Box",zh:"日式便当",cuisine:"japanese" },
  { id:"onigiri",en:"Onigiri",zh:"饭团",cuisine:"japanese" },
  { id:"edamame",en:"Edamame",zh:"毛豆",cuisine:"japanese" },
  { id:"karaage",en:"Karaage",zh:"日式炸鸡",cuisine:"japanese" },
  { id:"unagi",en:"Unagi Don",zh:"鳗鱼饭",cuisine:"japanese" },
  { id:"shabu-shabu",en:"Shabu-Shabu",zh:"日式火锅",cuisine:"japanese" },
  { id:"sukiyaki",en:"Sukiyaki",zh:"寿喜烧",cuisine:"japanese" },
  { id:"teppanyaki",en:"Teppanyaki",zh:"铁板烧",cuisine:"japanese" },
  { id:"maki-roll",en:"Maki Roll",zh:"寿司卷",cuisine:"japanese" },
  { id:"chirashi",en:"Chirashi Bowl",zh:"散寿司饭",cuisine:"japanese" },
  { id:"tamagoyaki",en:"Tamagoyaki",zh:"日式煎蛋卷",cuisine:"japanese" },
  { id:"agedashi-tofu",en:"Agedashi Tofu",zh:"炸豆腐",cuisine:"japanese" },
  { id:"wagyu",en:"Wagyu Steak",zh:"和牛牛排",cuisine:"japanese" },
  { id:"matcha-dessert",en:"Matcha Dessert",zh:"抹茶甜品",cuisine:"japanese" },
  { id:"mochi",en:"Mochi",zh:"麻薯",cuisine:"japanese" },
  { id:"dorayaki",en:"Dorayaki",zh:"铜锣烧",cuisine:"japanese" },
  { id:"yakiniku",en:"Yakiniku",zh:"日式烤肉",cuisine:"japanese" },
  { id:"omurice",en:"Omurice",zh:"蛋包饭",cuisine:"japanese" },
  { id:"kaiseki",en:"Kaiseki",zh:"怀石料理",cuisine:"japanese" },
  { id:"donburi",en:"Donburi",zh:"日式盖饭",cuisine:"japanese" },
  { id:"gyudon",en:"Gyudon",zh:"牛肉盖饭",cuisine:"japanese" },
  { id:"oyakodon",en:"Oyakodon",zh:"亲子丼",cuisine:"japanese" },
  { id:"katsudon",en:"Katsudon",zh:"猪排丼",cuisine:"japanese" },
  { id:"natto",en:"Natto",zh:"纳豆",cuisine:"japanese" },
  { id:"miso-ramen",en:"Miso Ramen",zh:"味噌拉面",cuisine:"japanese" },
  { id:"shoyu-ramen",en:"Shoyu Ramen",zh:"酱油拉面",cuisine:"japanese" },
  { id:"tonkotsu-ramen",en:"Tonkotsu Ramen",zh:"豚骨拉面",cuisine:"japanese" },
  { id:"hamachi",en:"Hamachi Sashimi",zh:"鰤鱼刺身",cuisine:"japanese" },
  { id:"tuna-tataki",en:"Tuna Tataki",zh:"金枪鱼炙烤",cuisine:"japanese" },
  { id:"ikura",en:"Ikura",zh:"鲑鱼子",cuisine:"japanese" },
  { id:"toro",en:"Toro Sushi",zh:"金枪鱼腹寿司",cuisine:"japanese" },
  { id:"matcha-ice-cream",en:"Matcha Ice Cream",zh:"抹茶冰淇淋",cuisine:"japanese" },
  { id:"taiyaki",en:"Taiyaki",zh:"鲷鱼烧",cuisine:"japanese" },
  { id:"senbei",en:"Senbei",zh:"仙贝",cuisine:"japanese" },
  { id:"oden",en:"Oden",zh:"关东煮",cuisine:"japanese" },
  { id:"nabe",en:"Nabe Hot Pot",zh:"日式锅物",cuisine:"japanese" },

  // ═══ THAI (35) ═══
  { id:"pad-thai",en:"Pad Thai",zh:"泰式炒河粉",cuisine:"thai" },
  { id:"tom-yum",en:"Tom Yum Goong",zh:"冬阴功汤",cuisine:"thai" },
  { id:"green-curry",en:"Green Curry",zh:"绿咖喱",cuisine:"thai" },
  { id:"red-curry",en:"Red Curry",zh:"红咖喱",cuisine:"thai" },
  { id:"massaman-curry",en:"Massaman Curry",zh:"马萨曼咖喱",cuisine:"thai" },
  { id:"som-tam",en:"Som Tam",zh:"青木瓜沙拉",cuisine:"thai" },
  { id:"mango-sticky-rice",en:"Mango Sticky Rice",zh:"芒果糯米饭",cuisine:"thai" },
  { id:"pad-see-ew",en:"Pad See Ew",zh:"酱油炒宽粉",cuisine:"thai" },
  { id:"larb",en:"Larb",zh:"泰式肉末沙拉",cuisine:"thai" },
  { id:"satay",en:"Chicken Satay",zh:"沙爹串",cuisine:"thai" },
  { id:"spring-rolls-thai",en:"Thai Spring Rolls",zh:"泰式春卷",cuisine:"thai" },
  { id:"khao-pad",en:"Khao Pad",zh:"泰式炒饭",cuisine:"thai" },
  { id:"panang-curry",en:"Panang Curry",zh:"帕纳恩咖喱",cuisine:"thai" },
  { id:"yellow-curry",en:"Yellow Curry",zh:"黄咖喱",cuisine:"thai" },
  { id:"tom-kha-gai",en:"Tom Kha Gai",zh:"椰汁鸡汤",cuisine:"thai" },
  { id:"basil-stir-fry",en:"Pad Kra Pao",zh:"打抛猪",cuisine:"thai" },
  { id:"crab-fried-rice",en:"Crab Fried Rice",zh:"蟹肉炒饭",cuisine:"thai" },
  { id:"coconut-soup",en:"Coconut Soup",zh:"椰子汤",cuisine:"thai" },
  { id:"fish-cakes",en:"Tod Mun Pla",zh:"泰式鱼饼",cuisine:"thai" },
  { id:"sticky-rice-mango",en:"Sticky Rice with Mango",zh:"糯米饭配芒果",cuisine:"thai" },
  { id:"banana-pancake",en:"Banana Pancake",zh:"香蕉煎饼",cuisine:"thai" },
  { id:"pineapple-fried-rice",en:"Pineapple Fried Rice",zh:"菠萝炒饭",cuisine:"thai" },
  { id:"drunken-noodles",en:"Drunken Noodles",zh:"醉面",cuisine:"thai" },
  { id:"glass-noodle-salad",en:"Glass Noodle Salad",zh:"粉丝沙拉",cuisine:"thai" },
  { id:"cashew-chicken",en:"Cashew Chicken",zh:"腰果鸡丁",cuisine:"thai" },
  { id:"beef-noodle-soup",en:"Beef Noodle Soup",zh:"牛肉河粉汤",cuisine:"thai" },
  { id:"khao-soi",en:"Khao Soi",zh:"泰北咖喱面",cuisine:"thai" },
  { id:"roti",en:"Thai Roti",zh:"泰式煎饼",cuisine:"thai" },
  { id:"coconut-ice-cream",en:"Coconut Ice Cream",zh:"椰子冰淇淋",cuisine:"thai" },
  { id:"thai-iced-tea",en:"Thai Iced Tea",zh:"泰式奶茶",cuisine:"thai" },
  { id:"papaya-salad",en:"Papaya Salad",zh:"木瓜沙拉",cuisine:"thai" },
  { id:"shrimp-cake",en:"Shrimp Cake",zh:"虾饼",cuisine:"thai" },
  { id:"oyster-oyster",en:"Oyster Omelette",zh:"牡蛎煎蛋",cuisine:"thai" },
  { id:"boat-noodles",en:"Boat Noodles",zh:"船面",cuisine:"thai" },
  { id:"kuay-teow",en:"Kuay Teow",zh:"粿条汤",cuisine:"thai" },

  // ═══ KOREAN (35) ═══
  { id:"bibimbap",en:"Bibimbap",zh:"韩式拌饭",cuisine:"korean" },
  { id:"kimchi-jjigae",en:"Kimchi Jjigae",zh:"泡菜汤",cuisine:"korean" },
  { id:"bulgogi",en:"Bulgogi",zh:"韩式烤肉",cuisine:"korean" },
  { id:"tteokbokki",en:"Tteokbokki",zh:"辣炒年糕",cuisine:"korean" },
  { id:"japchae",en:"Japchae",zh:"韩式炒粉丝",cuisine:"korean" },
  { id:"korean-fried-chicken",en:"Korean Fried Chicken",zh:"韩式炸鸡",cuisine:"korean" },
  { id:"samgyeopsal",en:"Samgyeopsal",zh:"韩式烤五花肉",cuisine:"korean" },
  { id:"korean-bbq",en:"Korean BBQ",zh:"韩式烤肉拼盘",cuisine:"korean" },
  { id:"kimchi",en:"Kimchi",zh:"泡菜",cuisine:"korean" },
  { id:"haemul-pajeon",en:"Haemul Pajeon",zh:"海鲜煎饼",cuisine:"korean" },
  { id:"sundubu-jjigae",en:"Sundubu Jjigae",zh:"嫩豆腐汤",cuisine:"korean" },
  { id:"galbi",en:"Galbi",zh:"韩式牛排骨",cuisine:"korean" },
  { id:"doenjang-jjigae",en:"Doenjang Jjigae",zh:"大酱汤",cuisine:"korean" },
  { id:"samgyetang",en:"Samgyetang",zh:"参鸡汤",cuisine:"korean" },
  { id:"kimbap",en:"Kimbap",zh:"韩式紫菜包饭",cuisine:"korean" },
  { id:"ramyeon",en:"Ramyeon",zh:"韩式拉面",cuisine:"korean" },
  { id:"bingsu",en:"Bingsu",zh:"韩式刨冰",cuisine:"korean" },
  { id:"hotteok",en:"Hotteok",zh:"韩式糖饼",cuisine:"korean" },
  { id:"mandu",en:"Mandu",zh:"韩式饺子",cuisine:"korean" },
  { id:"odeng",en:"Odeng Eomuk",zh:"鱼饼串",cuisine:"korean" },
  { id:"jajangmyeon",en:"Jajangmyeon",zh:"炸酱面",cuisine:"korean" },
  { id:"jjamppong",en:"Jjamppong",zh:"海鲜辣面",cuisine:"korean" },
  { id:"naengmyeon",en:"Naengmyeon",zh:"冷面",cuisine:"korean" },
  { id:"galbitang",en:"Galbitang",zh:"牛排骨汤",cuisine:"korean" },
  { id:"yukgaejang",en:"Yukgaejang",zh:"辣牛肉汤",cuisine:"korean" },
  { id:"bindaetteok",en:"Bindaetteok",zh:"绿豆煎饼",cuisine:"korean" },
  { id:"tteokguk",en:"Tteokguk",zh:"年糕汤",cuisine:"korean" },
  { id:"gamjatang",en:"Gamjatang",zh:"土豆排骨汤",cuisine:"korean" },
  { id:"dakgalbi",en:"Dakgalbi",zh:"辣炒鸡排",cuisine:"korean" },
  { id:"bossam",en:"Bossam",zh:"韩式包肉",cuisine:"korean" },
  { id:"yangnyeom-chicken",en:"Yangnyeom Chicken",zh:"调味炸鸡",cuisine:"korean" },
  { id:"gochujang",en:"Gochujang",zh:"韩式辣酱",cuisine:"korean" },
  { id:"soju",en:"Soju",zh:"烧酒",cuisine:"korean" },
  { id:"makgeolli",en:"Makgeolli",zh:"米酒",cuisine:"korean" },
  { id:"yakgwa",en:"Yakgwa",zh:"韩式 cookies",cuisine:"korean" },

  // ═══ SPANISH (30) ═══
  { id:"paella",en:"Paella",zh:"西班牙海鲜饭",cuisine:"spanish" },
  { id:"gazpacho",en:"Gazpacho",zh:"冷番茄汤",cuisine:"spanish" },
  { id:"patatas-bravas",en:"Patatas Bravas",zh:"辣土豆块",cuisine:"spanish" },
  { id:"jamon-iberico",en:"Jamón Ibérico",zh:"伊比利亚火腿",cuisine:"spanish" },
  { id:"tapas",en:"Tapas",zh:"塔帕斯小食",cuisine:"spanish" },
  { id:"tortilla-espanola",en:"Tortilla Española",zh:"西班牙土豆蛋饼",cuisine:"spanish" },
  { id:"croquetas",en:"Croquetas",zh:"西班牙炸丸子",cuisine:"spanish" },
  { id:"chorizo",en:"Chorizo",zh:"西班牙辣肠",cuisine:"spanish" },
  { id:"gambas-al-ajillo",en:"Gambas al Ajillo",zh:"蒜香虾",cuisine:"spanish" },
  { id:"pulpo-gallega",en:"Pulpo a la Gallega",zh:"加利西亚章鱼",cuisine:"spanish" },
  { id:"calamari",en:"Calamari",zh:"炸鱿鱼圈",cuisine:"spanish" },
  { id:"churros",en:"Churros",zh:"吉拿棒",cuisine:"spanish" },
  { id:"crema-catalana",en:"Crema Catalana",zh:"加泰罗尼亚焦糖布丁",cuisine:"spanish" },
  { id:"pan-con-tomate",en:"Pan con Tomate",zh:"番茄面包",cuisine:"spanish" },
  { id:"alioli",en:"Alioli",zh:"蒜泥蛋黄酱",cuisine:"spanish" },
  { id:"pimientos-padron",en:"Pimientos de Padrón",zh:"帕德隆辣椒",cuisine:"spanish" },
  { id:"albóndigas",en:"Albóndigas",zh:"西班牙肉丸",cuisine:"spanish" },
  { id:"fabada",en:"Fabada Asturiana",zh:"阿斯图里亚斯炖豆",cuisine:"spanish" },
  { id:"coejoncitos",en:"Callos a la Madrileña",zh:"马德里炖牛肚",cuisine:"spanish" },
  { id:"tinto-de-verano",en:"Tinto de Verano",zh:"夏日红酒",cuisine:"spanish" },
  { id:"sangria",en:"Sangría",zh:"桑格利亚",cuisine:"spanish" },
  { id:"ensaladilla-rusa",en:"Ensaladilla Rusa",zh:"俄式沙拉",cuisine:"spanish" },
  { id:"bacalao",en:"Bacalao",zh:"鳕鱼",cuisine:"spanish" },
  { id:"flan",en:"Flan",zh:"焦糖蛋奶冻",cuisine:"spanish" },
  { id:"turron",en:"Turrón",zh:"牛轧糖",cuisine:"spanish" },
  { id:"huevos-rotos",en:"Huevos Rotos",zh:"碎蛋配火腿",cuisine:"spanish" },
  { id:"serranito",en:"Serranito",zh:"安达卢西亚三明治",cuisine:"spanish" },
  { id:"taco-de-cerdo",en:"Cochinillo",zh:"烤乳猪",cuisine:"spanish" },
  { id:"salmorejo",en:"Salmorejo",zh:"浓番茄冷汤",cuisine:"spanish" },
  { id:"navajas",en:"Navajas",zh:"竹蛏",cuisine:"spanish" },

  // ═══ MEXICAN (30) ═══
  { id:"taco",en:"Taco",zh:"塔可",cuisine:"mexican" },
  { id:"burrito",en:"Burrito",zh:"墨西哥卷饼",cuisine:"mexican" },
  { id:"quesadilla",en:"Quesadilla",zh:"墨西哥芝士饼",cuisine:"mexican" },
  { id:"guacamole",en:"Guacamole",zh:"牛油果酱",cuisine:"mexican" },
  { id:"enchiladas",en:"Enchiladas",zh:"墨西哥卷",cuisine:"mexican" },
  { id:"tamales",en:"Tamales",zh:"墨西哥粽子",cuisine:"mexican" },
  { id:"nachos",en:"Nachos",zh:"玉米片",cuisine:"mexican" },
  { id:"ceviche",en:"Ceviche",zh:"柠汁腌鱼",cuisine:"mexican" },
  { id:"chiles-rellenos",en:"Chiles Rellenos",zh:"酿辣椒",cuisine:"mexican" },
  { id:"pozole",en:"Pozole",zh:"墨西哥炖汤",cuisine:"mexican" },
  { id:"mole",en:"Mole",zh:"巧克力辣酱鸡",cuisine:"mexican" },
  { id:"huevos-rancheros",en:"Huevos Rancheros",zh:"墨西哥煎蛋",cuisine:"mexican" },
  { id:"salsa",en:"Salsa",zh:"莎莎酱",cuisine:"mexican" },
  { id:"pico-de-gallo",en:"Pico de Gallo",zh:"碎莎莎酱",cuisine:"mexican" },
  { id:"elote",en:"Elote",zh:"墨西哥烤玉米",cuisine:"mexican" },
  { id:"churros-mexican",en:"Churros Mexicanos",zh:"墨西哥吉拿棒",cuisine:"mexican" },
  { id:"flan-mexican",en:"Flan Napolitano",zh:"墨西哥焦糖布丁",cuisine:"mexican" },
  { id:"fajitas",en:"Fajitas",zh:"法希塔",cuisine:"mexican" },
  { id:"carnitas",en:"Carnitas",zh:"慢炖猪肉",cuisine:"mexican" },
  { id:"al-pastor",en:"Tacos al Pastor",zh:"旋转烤肉塔可",cuisine:"mexican" },
  { id:"barbacoa",en:"Barbacoa",zh:"巴巴科亚炖肉",cuisine:"mexican" },
  { id:"carne-asada",en:"Carne Asada",zh:"炭烤牛肉",cuisine:"mexican" },
  { id:"horchata",en:"Horchata",zh:"米浆饮品",cuisine:"mexican" },
  { id:"margarita",en:"Margarita",zh:"玛格丽特鸡尾酒",cuisine:"mexican" },
  { id:"tostada",en:"Tostada",zh:"脆饼",cuisine:"mexican" },
  { id:"sopa-de-lima",en:"Sopa de Lima",zh:"青柠汤",cuisine:"mexican" },
  { id:"chilaquiles",en:"Chilaquiles",zh:"玉米片炖",cuisine:"mexican" },
  { id:"michelada",en:"Michelada",zh:"辣味啤酒",cuisine:"mexican" },
  { id:"empanada",en:"Empanada",zh:"馅饼",cuisine:"mexican" },
  { id:"tres-leches",en:"Tres Leches Cake",zh:"三奶蛋糕",cuisine:"mexican" },

  // ═══ INDIAN (30) ═══
  { id:"butter-chicken",en:"Butter Chicken",zh:"黄油鸡",cuisine:"indian" },
  { id:"tikka-masala",en:"Chicken Tikka Masala",zh:"提卡马萨拉",cuisine:"indian" },
  { id:"biryani",en:"Biryani",zh:"印度香饭",cuisine:"indian" },
  { id:"naan",en:"Naan Bread",zh:"印度烤饼",cuisine:"indian" },
  { id:"samosa",en:"Samosa",zh:"咖喱角",cuisine:"indian" },
  { id:"palak-paneer",en:"Palak Paneer",zh:"菠菜奶酪",cuisine:"indian" },
  { id:"dal",en:"Dal Tadka",zh:"黄豆汤",cuisine:"indian" },
  { id:"tandoori",en:"Tandoori Chicken",zh:"唐杜里鸡",cuisine:"indian" },
  { id:"masala-dosa",en:"Masala Dosa",zh:"土豆薄饼",cuisine:"indian" },
  { id:"chai",en:"Masala Chai",zh:"印度香料奶茶",cuisine:"indian" },
  { id:"curry",en:"Curry",zh:"咖喱",cuisine:"indian" },
  { id:"rogan-josh",en:"Rogan Josh",zh:"克什米尔羊肉咖喱",cuisine:"indian" },
  { id:" vindaloo",en:"Vindaloo",zh:"文达卢咖喱",cuisine:"indian" },
  { id:"aloo-gobi",en:"Aloo Gobi",zh:"土豆花菜",cuisine:"indian" },
  { id:"chole",en:"Chole Bhature",zh:"鹰嘴豆配炸饼",cuisine:"indian" },
  { id:"paneer-tikka",en:"Paneer Tikka",zh:"烤奶酪",cuisine:"indian" },
  { id:"lamb-keema",en:"Keema",zh:"肉末咖喱",cuisine:"indian" },
  { id:"fish-curry",en:"Fish Curry",zh:"咖喱鱼",cuisine:"indian" },
  { id:"pappadum",en:"Pappadum",zh:"脆饼",cuisine:"indian" },
  { id:"raita",en:"Raita",zh:"酸奶黄瓜酱",cuisine:"indian" },
  { id:"gulab-jamun",en:"Gulab Jamun",zh:"玫瑰奶球",cuisine:"indian" },
  { id:"kulfi",en:"Kulfi",zh:"印度冰淇淋",cuisine:"indian" },
  { id:"jalebi",en:"Jalebi",zh:"蜜汁煎饼",cuisine:"indian" },
  { id:"lassi",en:"Mango Lassi",zh:"芒果酸奶",cuisine:"indian" },
  { id:"pakora",en:"Pakora",zh:"印度炸蔬菜",cuisine:"indian" },
  { id:"idli",en:"Idli",zh:"蒸米糕",cuisine:"indian" },
  { id:"puri",en:"Puri",zh:"炸薄饼",cuisine:"indian" },
  { id:"korma",en:"Korma",zh:"奶油咖喱",cuisine:"indian" },
  { id:"saag",en:"Saag",zh:"芥菜咖喱",cuisine:"indian" },
  { id:"lamb-chops-indian",en:"Indian Lamb Chops",zh:"印度羊排",cuisine:"indian" },

  // ═══ VIETNAMESE (25) ═══
  { id:"pho",en:"Pho",zh:"越南河粉",cuisine:"vietnamese" },
  { id:"banh-mi",en:"Bánh Mì",zh:"越式法棍三明治",cuisine:"vietnamese" },
  { id:"spring-rolls-vn",en:"Vietnamese Spring Rolls",zh:"越南春卷",cuisine:"vietnamese" },
  { id:"bun-cha",en:"Bún Chả",zh:"烤肉米线",cuisine:"vietnamese" },
  { id:"banh-xeo",en:"Bánh Xèo",zh:"越南煎饼",cuisine:"vietnamese" },
  { id:"goi-cuon",en:"Gỏi Cuốn",zh:"鲜虾卷",cuisine:"vietnamese" },
  { id:"ca-phe",en:"Vietnamese Iced Coffee",zh:"越南冰咖啡",cuisine:"vietnamese" },
  { id:"com-tam",en:"Cơm Tấm",zh:"碎米饭",cuisine:"vietnamese" },
  { id:"bun-bo-hue",en:"Bún Bò Huế",zh:"顺化牛肉粉",cuisine:"vietnamese" },
  { id:"mi-quang",en:"Mì Quảng",zh:"广南面条",cuisine:"vietnamese" },
  { id:"cao-lau",en:"Cao Lầu",zh:"会安面",cuisine:"vietnamese" },
  { id:"pho-ga",en:"Phở Gà",zh:"鸡肉河粉",cuisine:"vietnamese" },
  { id:"che",en:"Chè",zh:"越南甜汤",cuisine:"vietnamese" },
  { id:"egg-coffee",en:"Egg Coffee",zh:"蛋咖啡",cuisine:"vietnamese" },
  { id:"hu-tieu",en:"Hủ Tiếu",zh:"柬埔寨面",cuisine:"vietnamese" },
  { id:"nem-nuong",en:"Nem Nướng",zh:"烤肉卷",cuisine:"vietnamese" },
  { id:"bo-kho",en:"Bò Kho",zh:"越南炖牛肉",cuisine:"vietnamese" },
  { id:"cha-gio",en:"Chả Giò",zh:"炸春卷",cuisine:"vietnamese" },
  { id:"thit-nuong",en:"Thịt Nướng",zh:"越南烤肉",cuisine:"vietnamese" },
  { id:"pho-bo",en:"Phở Bò",zh:"牛肉河粉",cuisine:"vietnamese" },
  { id:"bahn-cuon",en:"Bánh Cuốn",zh:"越南蒸卷粉",cuisine:"vietnamese" },
  { id:"ca-kho-to",en:"Cá Kho Tộ",zh:"陶罐鱼",cuisine:"vietnamese" },
  { id:"seafood-pho",en:"Hải Sản",zh:"越南海鲜",cuisine:"vietnamese" },
  { id:"avocado-shake",en:"Sinh Tố Bơ",zh:"牛油果奶昔",cuisine:"vietnamese" },
  { id:"xi-muoi",en:"Nước Chấm",zh:"鱼露蘸酱",cuisine:"vietnamese" },

  // ═══ GERMAN (20) ═══
  { id:"schnitzel",en:"Schnitzel",zh:"德式炸猪排",cuisine:"german" },
  { id:"bratwurst",en:"Bratwurst",zh:"德式烤肠",cuisine:"german" },
  { id:"pretzel",en:"Pretzel",zh:"德国碱水结",cuisine:"german" },
  { id:"sauerbraten",en:"Sauerbraten",zh:"酸味炖牛肉",cuisine:"german" },
  { id:"spatzle",en:"Spätzle",zh:"德式面疙瘩",cuisine:"german" },
  { id:"bratkartoffeln",en:"Bratkartoffeln",zh:"德式煎土豆",cuisine:"german" },
  { id:"eisbein",en:"Eisbein",zh:"德式猪脚",cuisine:"german" },
  { id:"rinderroulade",en:"Rinderroulade",zh:"牛肉卷",cuisine:"german" },
  { id:"kartoffelsuppe",en:"Kartoffelsuppe",zh:"土豆汤",cuisine:"german" },
  { id:"apfelstrudel",en:"Apfelstrudel",zh:"苹果卷",cuisine:"german" },
  { id:"schwarzwalder",en:"Schwarzwälder Kirschtorte",zh:"黑森林蛋糕",cuisine:"german" },
  { id:"brezel",en:"Brezel",zh:"碱水面包",cuisine:"german" },
  { id:"weisswurst",en:"Weisswurst",zh:"白肠",cuisine:"german" },
  { id:"currywurst",en:"Currywurst",zh:"咖喱香肠",cuisine:"german" },
  { id:"kasespatzle",en:"Käsespätzle",zh:"芝士面疙瘩",cuisine:"german" },
  { id:"flammenkuchen",en:"Flammkuchen",zh:"火焰薄饼",cuisine:"german" },
  { id:"bienenstich",en:"Bienenstich",zh:"蜜蜂蛰蛋糕",cuisine:"german" },
  { id:"stollen",en:"Stollen",zh:"圣诞面包",cuisine:"german" },
  { id:"kartoffel-kloesse",en:"Kartoffelknödel",zh:"土豆丸子",cuisine:"german" },
  { id:"beer",en:"German Beer",zh:"德国啤酒",cuisine:"german" },

  // ═══ BRITISH (20) ═══
  { id:"fish-and-chips",en:"Fish and Chips",zh:"炸鱼薯条",cuisine:"british" },
  { id:"full-breakfast",en:"Full English Breakfast",zh:"英式全套早餐",cuisine:"british" },
  { id:"shepherds-pie",en:"Shepherd's Pie",zh:"牧羊人派",cuisine:"british" },
  { id:"roast-beef",en:"Sunday Roast Beef",zh:"周日烤牛肉",cuisine:"british" },
  { id:"bangers-mash",en:"Bangers and Mash",zh:"香肠土豆泥",cuisine:"british" },
  { id:"steak-kidney-pie",en:"Steak and Kidney Pie",zh:"牛排腰子派",cuisine:"british" },
  { id:"scotch-egg",en:"Scotch Egg",zh:"苏格兰蛋",cuisine:"british" },
  { id:"scones",en:"Scones with Cream",zh:"奶油司康",cuisine:"british" },
  { id:"sticky-toffee-pudding",en:"Sticky Toffee Pudding",zh:"太妃布丁",cuisine:"british" },
  { id:"trifle",en:"Trifle",zh:"英式冷甜点",cuisine:"british" },
  { id:"crumpet",en:"Crumpet",zh:"英式松饼",cuisine:"british" },
  { id:"haggis",en:"Haggis",zh:"苏格兰羊杂",cuisine:"british" },
  { id:"beef-wellington",en:"Beef Wellington",zh:"惠灵顿牛排",cuisine:"british" },
  { id:"cottage-pie",en:"Cottage Pie",zh:"农舍派",cuisine:"british" },
  { id:"ploughmans",en:"Ploughman's Lunch",zh:"农夫午餐",cuisine:"british" },
  { id:"yorkshire-pudding",en:"Yorkshire Pudding",zh:"约克郡布丁",cuisine:"british" },
  { id:"eton-mess",en:"Eton Mess",zh:"伊顿混乱甜点",cuisine:"british" },
  { id:"cornish-pasty",en:"Cornish Pasty",zh:"康沃尔馅饼",cuisine:"british" },
  { id:"high-tea",en:"Afternoon Tea",zh:"英式下午茶",cuisine:"british" },
  { id:"ale",en:"British Ale",zh:"英式艾尔啤酒",cuisine:"british" },

  // ═══ AMERICAN (25) ═══
  { id:"hamburger",en:"Hamburger",zh:"汉堡",cuisine:"american" },
  { id:"hot-dog",en:"Hot Dog",zh:"热狗",cuisine:"american" },
  { id:"mac-cheese",en:"Mac and Cheese",zh:"芝士通心粉",cuisine:"american" },
  { id:"bbq-ribs",en:"BBQ Ribs",zh:"美式烤肋排",cuisine:"american" },
  { id:"buffalo-wings",en:"Buffalo Wings",zh:"布法罗辣翅",cuisine:"american" },
  { id:"clam-chowder",en:"Clam Chowder",zh:"蛤蜊浓汤",cuisine:"american" },
  { id:"lobster-roll",en:"Lobster Roll",zh:"龙虾卷",cuisine:"american" },
  { id:"pancakes",en:"Pancakes",zh:"美式松饼",cuisine:"american" },
  { id:"waffles",en:"Waffles",zh:"华夫饼",cuisine:"american" },
  { id:"grilled-cheese",en:"Grilled Cheese",zh:"芝士三明治",cuisine:"american" },
  { id:"caesar-salad",en:"Caesar Salad",zh:"凯撒沙拉",cuisine:"american" },
  { id:"coleslaw",en:"Coleslaw",zh:"凉拌卷心菜",cuisine:"american" },
  { id:"apple-pie",en:"Apple Pie",zh:"苹果派",cuisine:"american" },
  { id:"brownie",en:"Brownie",zh:"布朗尼",cuisine:"american" },
  { id:"cheesecake",en:"Cheesecake",zh:"芝士蛋糕",cuisine:"american" },
  { id:"donut",en:"Donut",zh:"甜甜圈",cuisine:"american" },
  { id:"fried-chicken",en:"Fried Chicken",zh:"炸鸡",cuisine:"american" },
  { id:"steak-ribeye",en:"Ribeye Steak",zh:"肋眼牛排",cuisine:"american" },
  { id:"pulled-pork",en:"Pulled Pork",zh:"手撕猪肉",cuisine:"american" },
  { id:"cornbread",en:"Cornbread",zh:"玉米面包",cuisine:"american" },
  { id:"bagel",en:"Bagel",zh:"贝果",cuisine:"american" },
  { id:"tuna-melt",en:"Tuna Melt",zh:"金枪鱼芝士三明治",cuisine:"american" },
  { id:"nachos-american",en:"Loaded Nachos",zh:"玉米片拼盘",cuisine:"american" },
  { id:"smashburger",en:"Smashburger",zh:"压扁汉堡",cuisine:"american" },
  { id:"milkshake",en:"Milkshake",zh:"奶昔",cuisine:"american" },

  // ═══ GREEK (20) ═══
  { id:"moussaka",en:"Moussaka",zh:"茄子肉酱千层",cuisine:"greek" },
  { id:"souvlaki",en:"Souvlaki",zh:"希腊烤肉串",cuisine:"greek" },
  { id:"greek-salad",en:"Greek Salad",zh:"希腊沙拉",cuisine:"greek" },
  { id:"tzatziki",en:"Tzatziki",zh:"酸奶黄瓜酱",cuisine:"greek" },
  { id:"gyros",en:"Gyros",zh:"旋转烤肉卷",cuisine:"greek" },
  { id:"spanakopita",en:"Spanakopita",zh:"菠菜派",cuisine:"greek" },
  { id:"dolmades",en:"Dolmades",zh:"葡萄叶包饭",cuisine:"greek" },
  { id:"baklava",en:"Baklava",zh:"果仁蜜饼",cuisine:"greek" },
  { id:"saganaki",en:"Saganaki",zh:"炸奶酪",cuisine:"greek" },
  { id:"taramasalata",en:"Taramasalata",zh:"鱼子酱泥",cuisine:"greek" },
  { id:"fava",en:"Fava",zh:"黄豌豆泥",cuisine:"greek" },
  { id:"pastitsio",en:"Pastitsio",zh:"希腊千层面",cuisine:"greek" },
  { id:"loukaniko",en:"Loukaniko",zh:"希腊香肠",cuisine:"greek" },
  { id:"loukoumades",en:"Loukoumades",zh:"希腊蜜球",cuisine:"greek" },
  { id:"fasolada",en:"Fasolada",zh:"白豆汤",cuisine:"greek" },
  { id:"stifado",en:"Stifado",zh:"洋葱炖牛肉",cuisine:"greek" },
  { id:"paidakia",en:"Paidakia",zh:"希腊羊排",cuisine:"greek" },
  { id:"feta",en:"Feta Cheese",zh:"菲达奶酪",cuisine:"greek" },
  { id:"ouzo",en:"Ouzo",zh:"茴香酒",cuisine:"greek" },
  { id:"galaktoboureko",en:"Galaktoboureko",zh:"奶油酥饼",cuisine:"greek" },

  // ═══ MIDDLE EASTERN (25) ═══
  { id:"hummus",en:"Hummus",zh:"鹰嘴豆泥",cuisine:"middle-eastern" },
  { id:"falafel",en:"Falafel",zh:"炸鹰嘴豆饼",cuisine:"middle-eastern" },
  { id:"shawarma",en:"Shawarma",zh:"沙瓦尔玛烤肉卷",cuisine:"middle-eastern" },
  { id:"kebab",en:"Kebab",zh:"烤肉串",cuisine:"middle-eastern" },
  { id:"baba-ganoush",en:"Baba Ganoush",zh:"茄子泥",cuisine:"middle-eastern" },
  { id:"tabbouleh",en:"Tabbouleh",zh:"欧芹沙拉",cuisine:"middle-eastern" },
  { id:"fattoush",en:"Fattoush",zh:"面包沙拉",cuisine:"middle-eastern" },
  { id:"pita",en:"Pita Bread",zh:"口袋饼",cuisine:"middle-eastern" },
  { id:"mansaf",en:"Mansaf",zh:"约旦羊肉饭",cuisine:"middle-eastern" },
  { id:"kibbeh",en:"Kibbeh",zh:"中东肉饼",cuisine:"middle-eastern" },
  { id:"muhammara",en:"Muhammara",zh:"红椒核桃酱",cuisine:"middle-eastern" },
  { id:"labneh",en:"Labneh",zh:"浓缩酸奶",cuisine:"middle-eastern" },
  { id:"zaatar-manakeesh",en:"Manakeesh",zh:"百里香烤饼",cuisine:"middle-eastern" },
  { id:"knafeh",en:"Knafeh",zh:"奶酪酥饼甜点",cuisine:"middle-eastern" },
  { id:"baklava-middle",en:"Middle Eastern Baklava",zh:"中东果仁蜜饼",cuisine:"middle-eastern" },
  { id:"maqlouba",en:"Maqlouba",zh:"倒扣饭",cuisine:"middle-eastern" },
  { id:"shakshouka",en:"Shakshouka",zh:"番茄炖蛋",cuisine:"middle-eastern" },
  { id:"kunafeh",en:"Kunafeh",zh:"库纳法",cuisine:"middle-eastern" },
  { id:"fatayer",en:"Fatayer",zh:"菠菜馅饼",cuisine:"middle-eastern" },
  { id:"sambousek",en:"Sambousek",zh:"中东三角饺",cuisine:"middle-eastern" },
  { id:"turkish-coffee",en:"Turkish Coffee",zh:"土耳其咖啡",cuisine:"middle-eastern" },
  { id:"ayran",en:"Ayran",zh:"咸酸奶",cuisine:"middle-eastern" },
  { id:"turkish-delight",en:"Turkish Delight",zh:"土耳其软糖",cuisine:"middle-eastern" },
  { id:"halva",en:"Halva",zh:"哈瓦酥糖",cuisine:"middle-eastern" },
  { id:"meze",en:"Meze Platter",zh:"中东开胃拼盘",cuisine:"middle-eastern" },

  // ═══ CHINESE (25) ═══
  { id:"kung-pao-chicken",en:"Kung Pao Chicken",zh:"宫保鸡丁",cuisine:"chinese" },
  { id:"peking-duck",en:"Peking Duck",zh:"北京烤鸭",cuisine:"chinese" },
  { id:"dim-sum",en:"Dim Sum",zh:"点心",cuisine:"chinese" },
  { id:"mapo-tofu",en:"Mapo Tofu",zh:"麻婆豆腐",cuisine:"chinese" },
  { id:"char-siu",en:"Char Siu",zh:"叉烧",cuisine:"chinese" },
  { id:"wonton",en:"Wonton Soup",zh:"云吞汤",cuisine:"chinese" },
  { id:"spring-rolls-cn",en:"Spring Rolls",zh:"春卷",cuisine:"chinese" },
  { id:"sweet-sour-pork",en:"Sweet and Sour Pork",zh:"糖醋里脊",cuisine:"chinese" },
  { id:"fried-rice",en:"Fried Rice",zh:"炒饭",cuisine:"chinese" },
  { id:"chow-mein",en:"Chow Mein",zh:"炒面",cuisine:"chinese" },
  { id:"hot-pot",en:"Hot Pot",zh:"火锅",cuisine:"chinese" },
  { id:"xiao-long-bao",en:"Xiao Long Bao",zh:"小笼包",cuisine:"chinese" },
  { id:"dumplings",en:"Dumplings",zh:"饺子",cuisine:"chinese" },
  { id:"beef-noodle",en:"Beef Noodle Soup",zh:"牛肉面",cuisine:"chinese" },
  { id:"congee",en:"Congee",zh:"粥",cuisine:"chinese" },
  { id:"lo-mein",en:"Lo Mein",zh:"捞面",cuisine:"chinese" },
  { id:"general-tso",en:"General Tso's Chicken",zh:"左宗棠鸡",cuisine:"chinese" },
  { id:"egg-fried-rice",en:"Egg Fried Rice",zh:"蛋炒饭",cuisine:"chinese" },
  { id:"ma-la-xiang-guo",en:"Mala Xiangguo",zh:"麻辣香锅",cuisine:"chinese" },
  { id:"sichuan-hotpot",en:"Sichuan Hotpot",zh:"四川火锅",cuisine:"chinese" },
  { id:"baos",en:"Baozi",zh:"包子",cuisine:"chinese" },
  { id:"scallion-pancake",en:"Scallion Pancake",zh:"葱油饼",cuisine:"chinese" },
  { id:"mooncake",en:"Mooncake",zh:"月饼",cuisine:"chinese" },
  { id:"tangyuan",en:"Tangyuan",zh:"汤圆",cuisine:"chinese" },
  { id:"bubble-tea",en:"Bubble Tea",zh:"珍珠奶茶",cuisine:"chinese" },
];

// ── Download Logic ──────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function searchUnsplash(query) {
  if (!UNSPLASH_KEY) return [];
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=squarish`;
  const res = await fetch(url, { headers: { "Authorization": `Client-ID ${UNSPLASH_KEY}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(r => ({
    small: r.urls?.small || "",
    regular: r.urls?.regular || "",
    alt: r.alt_description || "",
  }));
}

async function searchPexels(query) {
  if (!PEXELS_KEY) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=squarish`;
  const res = await fetch(url, { headers: { "Authorization": PEXELS_KEY } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.photos || []).map(p => ({
    small: p.src?.medium || "",
    regular: p.src?.large || "",
    alt: p.alt || "",
  }));
}

async function downloadFile(url, dest) {
  if (existsSync(dest)) return true; // skip if exists
  const res = await fetch(url);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return true;
}

async function processDish(dish, index, total) {
  const cardPath = join(OUT_DIR, `${dish.id}.jpg`);
  const heroPath = join(OUT_DIR, `${dish.id}-hero.jpg`);

  if (existsSync(cardPath) && existsSync(heroPath)) {
    console.log(`[${index+1}/${total}] ${dish.en} → ⏭️  already exists`);
    return { ...dish, card: `/dishes/${dish.id}.jpg`, hero: `/dishes/${dish.id}-hero.jpg` };
  }

  const searchQuery = `${dish.en} food dish`;

  // Search both Unsplash and Pexels, pick the best
  const [unsplashResults, pexelsResults] = await Promise.all([
    searchUnsplash(searchQuery),
    searchPexels(searchQuery),
  ]);
  let images = [...unsplashResults, ...pexelsResults];

  // Try broader search if no results
  if (images.length === 0) {
    const broader = dish.en.split(" ")[0] + " food";
    const [broaderUnsplash, broaderPexels] = await Promise.all([
      searchUnsplash(broader),
      searchPexels(broader),
    ]);
    images = [...broaderUnsplash, ...broaderPexels];
  }

  if (images.length === 0) {
    console.log(`[${index+1}/${total}] ${dish.en} → ❌ no results`);
    return { ...dish, card: null, hero: null };
  }

  let cardOk = true, heroOk = true;
  if (!existsSync(cardPath)) {
    cardOk = await downloadFile(images[0].small, cardPath);
  }
  if (!existsSync(heroPath)) {
    heroOk = await downloadFile(images[0].regular || images[0].small, heroPath);
  }

  // Also save an alternate image from the other source if available
  if (images.length > 1) {
    const altPath = join(OUT_DIR, `${dish.id}-alt.jpg`);
    if (!existsSync(altPath)) {
      await downloadFile(images[1].small, altPath);
    }
  }

  if (cardOk && heroOk) {
    console.log(`[${index+1}/${total}] ${dish.en} → ✅ downloaded`);
  } else {
    console.log(`[${index+1}/${total}] ${dish.en} → ⚠️  partial (${cardOk ? "card ok" : "card fail"}, ${heroOk ? "hero ok" : "hero fail"})`);
  }

  return {
    ...dish,
    card: cardOk ? `/dishes/${dish.id}.jpg` : null,
    hero: heroOk ? `/dishes/${dish.id}-hero.jpg` : null,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n🍽️  DishLens Image Downloader`);
  console.log(`📦 ${dishes.length} dishes to process`);
  console.log(`🔑 Unsplash: ${UNSPLASH_KEY ? "configured" : "not configured"} | Pexels: ${PEXELS_KEY ? "configured" : "not configured"}\n`);

  const results = [];
  let downloaded = 0, failed = 0, skipped = 0;

  for (let i = 0; i < dishes.length; i++) {
    const result = await processDish(dishes[i], i, dishes.length);
    results.push(result);
    if (result.card && result.hero) {
      downloaded++;
    } else if (!result.card && !result.hero) failed++;
    else skipped++;

    await sleep(DELAY);
  }

  // Generate TypeScript DB
  const entries = results
    .filter(r => r.card && r.hero)
    .map(r => {
      const names = [r.en.toLowerCase(), r.zh];
      // Add common aliases
      if (r.en.includes("(")) names.push(r.en.split("(")[0].trim().toLowerCase());
      return `  { id: "${r.id}", names: ${JSON.stringify(names)}, cuisine: "${r.cuisine}", card: "${r.card}", hero: "${r.hero}" }`;
    });

  const ts = `// Auto-generated by scripts/download-dish-images.mjs
// ${results.filter(r => r.card && r.hero).length} dishes with images
export type DishImageEntry = {
  id: string;
  names: string[];
  cuisine: string;
  card: string;
  hero: string;
};

export const dishImageDb: DishImageEntry[] = [
${entries.join(",\n")}
];
`;

  writeFileSync(DB_OUT, ts);

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Downloaded: ${downloaded}`);
  console.log(`   ⏭️  Skipped (exists): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📄 DB written to: ${DB_OUT}\n`);
}

main().catch(console.error);
