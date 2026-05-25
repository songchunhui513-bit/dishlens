// Part 2: Mexican, Indian, Japanese, Korean, Vietnamese
export const dishesPart2 = [
  // ═══════════════════════════════════════
  // ═══ MEXICAN (32) ═══
  // ═══════════════════════════════════════

  { id: "tacos-al-pastor", name_original: "Tacos al Pastor", name_en: "Pork Pineapple Tacos", name_zh: " pastor 塔可", cuisine: "Mexican", category: "main" },
  { id: "tacos-de-carnitas", name_original: "Tacos de Carnitas", name_en: "Slow-Cooked Pork Tacos", name_zh: "慢炖猪肉塔可", cuisine: "Mexican", category: "main" },
  { id: "tacos-de-barbacoa", name_original: "Tacos de Barbacoa", name_en: "Barbacoa Beef Tacos", name_zh: "巴巴科亚牛肉塔可", cuisine: "Mexican", category: "main" },
  { id: "tacos-de-cochinita-pibil", name_original: "Tacos de Cochinita Pibil", name_en: "Achiote Pork Tacos", name_zh: "科奇尼塔皮比尔猪肉塔可", cuisine: "Mexican", category: "main" },
  { id: "birria-tacos", name_original: "Birria Tacos", name_en: "Braised Beef Tacos", name_zh: "比尔里亚炖牛肉塔可", cuisine: "Mexican", category: "main" },
  { id: "enchiladas", name_original: "Enchiladas", name_en: "Enchiladas", name_zh: "安琪拉达卷饼", cuisine: "Mexican", category: "main" },
  { id: "mole-poblano", name_original: "Mole Poblano", name_en: "Mole Poblano", name_zh: "普埃布拉莫雷酱鸡", cuisine: "Mexican", category: "main" },
  { id: "chiles-en-nogada", name_original: "Chiles en Nogada", name_en: "Stuffed Poblano Peppers in Walnut Sauce", name_zh: "核桃酱酿辣椒", cuisine: "Mexican", category: "main" },
  { id: "pozole", name_original: "Pozole", name_en: "Hominy Stew", name_zh: "波索莱玉米炖汤", cuisine: "Mexican", category: "soup" },
  { id: "menudo", name_original: "Menudo", name_en: "Tripe Soup", name_zh: "门诺多牛肚汤", cuisine: "Mexican", category: "soup" },
  { id: "tamales", name_original: "Tamales", name_en: "Tamales", name_zh: "达玛利玉米粽", cuisine: "Mexican", category: "main" },
  { id: "quesadillas", name_original: "Quesadillas", name_en: "Quesadillas", name_zh: "墨西哥芝士夹饼", cuisine: "Mexican", category: "main" },
  { id: "guacamole", name_original: "Guacamole", name_en: "Avocado Dip", name_zh: "牛油果酱", cuisine: "Mexican", category: "sauce" },
  { id: "elote", name_original: "Elote", name_en: "Mexican Street Corn", name_zh: "墨西哥街头烤玉米", cuisine: "Mexican", category: "street-food" },
  { id: "mexican-ceviche", name_original: "Ceviche", name_en: "Mexican Ceviche", name_zh: "墨西哥酸橘汁腌鱼", cuisine: "Mexican", category: "appetizer" },
  { id: "cochinita-pibil", name_original: "Cochinita Pibil", name_en: "Achiote-Roasted Pork", name_zh: "科奇尼塔皮比尔烤猪肉", cuisine: "Mexican", category: "main" },
  { id: "carne-asada", name_original: "Carne Asada", name_en: "Grilled Steak", name_zh: "墨西哥烤牛肉", cuisine: "Mexican", category: "main" },
  { id: "burrito", name_original: "Burrito", name_en: "Burrito", name_zh: "墨西哥卷饼", cuisine: "Mexican", category: "main" },
  { id: "chimichanga", name_original: "Chimichanga", name_en: "Deep-Fried Burrito", name_zh: "炸墨西哥卷饼", cuisine: "Mexican", category: "main" },
  { id: "chilaquiles", name_original: "Chilaquiles", name_en: "Tortilla Chip Casserole", name_zh: "奇拉基莱斯玉米片", cuisine: "Mexican", category: "breakfast" },
  { id: "huevos-rancheros", name_original: "Huevos Rancheros", name_en: "Rancher's Eggs", name_zh: "农夫煎蛋", cuisine: "Mexican", category: "breakfast" },
  { id: "flautas", name_original: "Flautas", name_en: "Flautas", name_zh: "墨西哥炸卷饼", cuisine: "Mexican", category: "main" },
  { id: "sopes", name_original: "Sopes", name_en: "Sopes", name_zh: "索佩斯厚玉米饼", cuisine: "Mexican", category: "street-food" },
  { id: "tostadas", name_original: "Tostadas", name_en: "Tostadas", name_zh: "托斯塔达脆饼", cuisine: "Mexican", category: "main" },
  { id: "nachos", name_original: "Nachos", name_en: "Nachos", name_zh: "墨西哥玉米片", cuisine: "Mexican", category: "appetizer" },
  { id: "mole-negro", name_original: "Mole Negro", name_en: "Black Mole", name_zh: "黑莫雷酱", cuisine: "Mexican", category: "main" },
  { id: "aguachile", name_original: "Aguachile", name_en: "Shrimp in Chili-Lime Marinade", name_zh: "阿瓜奇莱鲜虾", cuisine: "Mexican", category: "appetizer" },
  { id: "tres-leches-cake", name_original: "Pastel de Tres Leches", name_en: "Three Milk Cake", name_zh: "三奶蛋糕", cuisine: "Mexican", category: "dessert" },
  { id: "churros-con-chocolate", name_original: "Churros con Chocolate", name_en: "Churros with Chocolate", name_zh: "吉拿棒配巧克力", cuisine: "Mexican", category: "dessert" },
  { id: "paletas", name_original: "Paletas", name_en: "Mexican Ice Pops", name_zh: "墨西哥冰棒", cuisine: "Mexican", category: "dessert" },
  { id: "horchata", name_original: "Horchata", name_en: "Rice Milk Drink", name_zh: "欧洽塔米浆", cuisine: "Mexican", category: "drink" },
  { id: "margarita", name_original: "Margarita", name_en: "Margarita", name_zh: "玛格丽特鸡尾酒", cuisine: "Mexican", category: "drink" },
  { id: "michelada", name_original: "Michelada", name_en: "Beer Cocktail with Lime and Spice", name_zh: "米切拉达啤酒鸡尾酒", cuisine: "Mexican", category: "drink" },

  // ═══════════════════════════════════════
  // ═══ INDIAN (60) ═══
  // ═══════════════════════════════════════

  // -- Indian Mains --
  { id: "butter-chicken", name_original: "Butter Chicken", name_en: "Butter Chicken", name_zh: "黄油鸡", cuisine: "Indian", category: "main" },
  { id: "chicken-tikka-masala", name_original: "Chicken Tikka Masala", name_en: "Chicken Tikka Masala", name_zh: "鸡提卡玛萨拉", cuisine: "Indian", category: "main" },
  { id: "palak-paneer", name_original: "Palak Paneer", name_en: "Spinach Paneer", name_zh: "菠菜芝士", cuisine: "Indian", category: "main" },
  { id: "saag-paneer", name_original: "Saag Paneer", name_en: "Mustard Greens Paneer", name_zh: "芥菜芝士", cuisine: "Indian", category: "main" },
  { id: "dal-makhani", name_original: "Dal Makhani", name_en: "Creamy Black Lentils", name_zh: "奶油黑扁豆", cuisine: "Indian", category: "main" },
  { id: "chana-masala", name_original: "Chana Masala", name_en: "Chickpea Curry", name_zh: "鹰嘴豆咖喱", cuisine: "Indian", category: "main" },
  { id: "chicken-biryani", name_original: "Chicken Biryani", name_en: "Chicken Biryani", name_zh: "鸡肉比尔亚尼饭", cuisine: "Indian", category: "rice" },
  { id: "lamb-biryani", name_original: "Lamb Biryani", name_en: "Lamb Biryani", name_zh: "羊肉比尔亚尼饭", cuisine: "Indian", category: "rice" },
  { id: "veg-biryani", name_original: "Veg Biryani", name_en: "Vegetable Biryani", name_zh: "蔬菜比尔亚尼饭", cuisine: "Indian", category: "rice" },
  { id: "tandoori-chicken", name_original: "Tandoori Chicken", name_en: "Tandoori Chicken", name_zh: "坦都里烤鸡", cuisine: "Indian", category: "main" },
  { id: "lamb-rogan-josh", name_original: "Lamb Rogan Josh", name_en: "Kashmiri Lamb Curry", name_zh: "克什米尔羊肉咖喱", cuisine: "Indian", category: "main" },
  { id: "chicken-korma", name_original: "Chicken Korma", name_en: "Creamy Chicken Curry", name_zh: "奶油鸡咖喱", cuisine: "Indian", category: "main" },
  { id: "vindaloo", name_original: "Vindaloo", name_en: "Spicy Vinegar Curry", name_zh: "温达卢咖喱", cuisine: "Indian", category: "main" },
  { id: "aloo-gobi", name_original: "Aloo Gobi", name_en: "Potato Cauliflower Curry", name_zh: "土豆花椰菜咖喱", cuisine: "Indian", category: "main" },
  { id: "baingan-bharta", name_original: "Baingan Bharta", name_en: "Smoky Eggplant Mash", name_zh: "烤茄子泥", cuisine: "Indian", category: "main" },
  { id: "fish-curry", name_original: "Fish Curry", name_en: "Indian Fish Curry", name_zh: "印度鱼咖喱", cuisine: "Indian", category: "main" },
  { id: "prawn-masala", name_original: "Prawn Masala", name_en: "Spicy Prawn Curry", name_zh: "玛萨拉虾咖喱", cuisine: "Indian", category: "main" },
  { id: "malai-kofta", name_original: "Malai Kofta", name_en: "Paneer Potato Dumplings in Cream Sauce", name_zh: "奶油芝士薯球", cuisine: "Indian", category: "main" },
  { id: "paneer-tikka", name_original: "Paneer Tikka", name_en: "Grilled Paneer Skewers", name_zh: "烤芝士串", cuisine: "Indian", category: "appetizer" },
  { id: "kadai-paneer", name_original: "Kadai Paneer", name_en: "Wok-Tossed Paneer", name_zh: "卡戴芝士", cuisine: "Indian", category: "main" },
  { id: "shahi-paneer", name_original: "Shahi Paneer", name_en: "Royal Paneer Curry", name_zh: "皇室芝士咖喱", cuisine: "Indian", category: "main" },
  { id: "mutter-paneer", name_original: "Mutter Paneer", name_en: "Pea and Paneer Curry", name_zh: "豌豆芝士咖喱", cuisine: "Indian", category: "main" },
  { id: "rajma", name_original: "Rajma", name_en: "Kidney Bean Curry", name_zh: "红腰豆咖喱", cuisine: "Indian", category: "main" },
  { id: "dal-tadka", name_original: "Dal Tadka", name_en: "Tempered Yellow Lentils", name_zh: "爆香黄扁豆", cuisine: "Indian", category: "main" },
  { id: "dhal-fry", name_original: "Dhal Fry", name_en: "Fried Lentils", name_zh: "炒扁豆", cuisine: "Indian", category: "main" },
  { id: "keema-matar", name_original: "Keema Matar", name_en: "Minced Meat with Peas", name_zh: "豌豆肉末", cuisine: "Indian", category: "main" },
  { id: "mutton-keema", name_original: "Mutton Keema", name_en: "Minced Mutton Curry", name_zh: "羊肉末咖喱", cuisine: "Indian", category: "main" },
  { id: "chicken-65", name_original: "Chicken 65", name_en: "Spicy Fried Chicken Bites", name_zh: "65号辣子鸡", cuisine: "Indian", category: "appetizer" },
  { id: "hyderabadi-biryani", name_original: "Hyderabadi Biryani", name_en: "Hyderabadi Dum Biryani", name_zh: "海德拉巴比尔亚尼饭", cuisine: "Indian", category: "rice" },
  { id: "fish-amritsari", name_original: "Fish Amritsari", name_en: "Amritsari Fried Fish", name_zh: "阿姆利则炸鱼", cuisine: "Indian", category: "appetizer" },
  { id: "chicken-malai-tikka", name_original: "Chicken Malai Tikka", name_en: "Creamy Chicken Skewers", name_zh: "奶油鸡串", cuisine: "Indian", category: "appetizer" },
  { id: "chicken-lollipop", name_original: "Chicken Lollipop", name_en: "Chicken Lollipop Wings", name_zh: "鸡肉棒棒翅", cuisine: "Indian", category: "appetizer" },

  // -- Indian Kebabs & Tandoor --
  { id: "seekh-kebab", name_original: "Seekh Kebab", name_en: "Minced Meat Skewers", name_zh: "烤肉串", cuisine: "Indian", category: "main" },
  { id: "lamb-seekh-kebab", name_original: "Lamb Seekh Kebab", name_en: "Lamb Minced Skewers", name_zh: "羊肉烤串", cuisine: "Indian", category: "main" },
  { id: "tandoori-prawns", name_original: "Tandoori Prawns", name_en: "Tandoori Grilled Prawns", name_zh: "坦都里烤虾", cuisine: "Indian", category: "main" },

  // -- Indian Breads & Rice --
  { id: "naan", name_original: "Naan", name_en: "Naan Bread", name_zh: "印度馕饼", cuisine: "Indian", category: "bread" },
  { id: "garlic-naan", name_original: "Garlic Naan", name_en: "Garlic Naan Bread", name_zh: "蒜蓉馕饼", cuisine: "Indian", category: "bread" },
  { id: "pulao", name_original: "Pulao", name_en: "Spiced Rice Pilaf", name_zh: "印度香料饭", cuisine: "Indian", category: "rice" },
  { id: "jeera-rice", name_original: "Jeera Rice", name_en: "Cumin Rice", name_zh: "孜然饭", cuisine: "Indian", category: "rice" },
  { id: "lemon-rice", name_original: "Lemon Rice", name_en: "Lemon Rice", name_zh: "柠檬饭", cuisine: "Indian", category: "rice" },
  { id: "papadum", name_original: "Papadum", name_en: "Crispy Lentil Wafer", name_zh: "炸扁豆脆饼", cuisine: "Indian", category: "bread" },

  // -- Indian Snacks & Street Food --
  { id: "samosa", name_original: "Samosa", name_en: "Fried Pastry Triangle", name_zh: "萨莫萨三角饺", cuisine: "Indian", category: "street-food" },
  { id: "pakora", name_original: "Pakora", name_en: "Vegetable Fritters", name_zh: "帕科拉蔬菜炸饼", cuisine: "Indian", category: "street-food" },
  { id: "masala-dosa", name_original: "Masala Dosa", name_en: "Potato-Filled Crepe", name_zh: "玛萨拉多萨薄饼", cuisine: "Indian", category: "breakfast" },
  { id: "idli", name_original: "Idli", name_en: "Steamed Rice Cakes", name_zh: "蒸米糕", cuisine: "Indian", category: "breakfast" },
  { id: "uttapam", name_original: "Uttapam", name_en: "Savory Rice Pancake", name_zh: "乌塔帕姆煎饼", cuisine: "Indian", category: "breakfast" },
  { id: "pani-puri", name_original: "Pani Puri", name_en: "Spicy Water Puffs", name_zh: "帕尼普里脆球", cuisine: "Indian", category: "street-food" },
  { id: "bhel-puri", name_original: "Bhel Puri", name_en: "Puffed Rice Snack", name_zh: "贝尔普里米花", cuisine: "Indian", category: "street-food" },
  { id: "chole-bhature", name_original: "Chole Bhature", name_en: "Chickpea Curry with Fried Bread", name_zh: "鹰嘴豆配炸面包", cuisine: "Indian", category: "breakfast" },
  { id: "aloo-paratha", name_original: "Aloo Paratha", name_en: "Potato-Stuffed Flatbread", name_zh: "土豆馅饼", cuisine: "Indian", category: "breakfast" },

  // -- Indian Soups & Sides --
  { id: "rasam", name_original: "Rasam", name_en: "Pepper Tomato Soup", name_zh: "胡椒番茄汤", cuisine: "Indian", category: "soup" },
  { id: "sambar", name_original: "Sambar", name_en: "Lentil Vegetable Stew", name_zh: "桑巴尔扁豆炖菜", cuisine: "Indian", category: "soup" },
  { id: "raita", name_original: "Raita", name_en: "Yogurt with Vegetables", name_zh: "印度酸奶沙拉", cuisine: "Indian", category: "side" },

  // -- Indian Drinks --
  { id: "mango-lassi", name_original: "Mango Lassi", name_en: "Mango Yogurt Drink", name_zh: "芒果拉西", cuisine: "Indian", category: "drink" },
  { id: "masala-chai", name_original: "Masala Chai", name_en: "Spiced Tea", name_zh: "玛萨拉奶茶", cuisine: "Indian", category: "drink" },

  // -- Indian Desserts --
  { id: "gulab-jamun", name_original: "Gulab Jamun", name_en: "Milk Dumplings in Syrup", name_zh: "古拉布贾蒙奶球", cuisine: "Indian", category: "dessert" },
  { id: "rasmalai", name_original: "Rasmalai", name_en: "Cream-Soaked Paneer Patties", name_zh: "拉斯玛莱芝士饼", cuisine: "Indian", category: "dessert" },
  { id: "jalebi", name_original: "Jalebi", name_en: "Crispy Syrup Spirals", name_zh: "贾莱比糖螺旋", cuisine: "Indian", category: "dessert" },
  { id: "kheer", name_original: "Kheer", name_en: "Rice Pudding", name_zh: "印度米布丁", cuisine: "Indian", category: "dessert" },
  { id: "kulfi", name_original: "Kulfi", name_en: "Indian Ice Cream", name_zh: "库尔菲冰淇淋", cuisine: "Indian", category: "dessert" },
  { id: "kulfi-falooda", name_original: "Kulfi Falooda", name_en: "Ice Cream with Vermicelli", name_zh: "库尔菲法鲁达", cuisine: "Indian", category: "dessert" },

  // ═══════════════════════════════════════
  // ═══ JAPANESE (85) ═══
  // ═══════════════════════════════════════

  // -- Japanese Sushi & Raw Fish --
  { id: "sushi-nigiri-tuna", name_original: "マグロの握り", name_en: "Tuna Nigiri Sushi", name_zh: "金枪鱼握寿司", cuisine: "Japanese", category: "main" },
  { id: "sushi-nigiri-salmon", name_original: "サーモンの握り", name_en: "Salmon Nigiri Sushi", name_zh: "三文鱼握寿司", cuisine: "Japanese", category: "main" },
  { id: "sushi-nigiri-shrimp", name_original: "エビの握り", name_en: "Shrimp Nigiri Sushi", name_zh: "虾握寿司", cuisine: "Japanese", category: "main" },
  { id: "sushi-nigiri-eel", name_original: "ウナギの握り", name_en: "Eel Nigiri Sushi", name_zh: "鳗鱼握寿司", cuisine: "Japanese", category: "main" },
  { id: "sushi-nigiri-octopus", name_original: "タコの握り", name_en: "Octopus Nigiri Sushi", name_zh: "章鱼握寿司", cuisine: "Japanese", category: "main" },
  { id: "sashimi", name_original: "刺身", name_en: "Sashimi", name_zh: "刺身", cuisine: "Japanese", category: "main" },
  { id: "maki-roll", name_original: "巻き寿司", name_en: "Maki Roll", name_zh: "卷寿司", cuisine: "Japanese", category: "main" },
  { id: "california-roll", name_original: "カリフォルニアロール", name_en: "California Roll", name_zh: "加州卷", cuisine: "Japanese", category: "main" },
  { id: "dragon-roll", name_original: "ドラゴンロール", name_en: "Dragon Roll", name_zh: "巨龙卷", cuisine: "Japanese", category: "main" },
  { id: "rainbow-roll", name_original: "レインボーロール", name_en: "Rainbow Roll", name_zh: "彩虹卷", cuisine: "Japanese", category: "main" },
  { id: "spicy-tuna-roll", name_original: "スパイシーまぐろロール", name_en: "Spicy Tuna Roll", name_zh: "辣金枪鱼卷", cuisine: "Japanese", category: "main" },
  { id: "chirashizushi", name_original: "ちらし寿司", name_en: "Scattered Sushi Bowl", name_zh: "散寿司", cuisine: "Japanese", category: "rice" },
  { id: "temaki", name_original: "手巻き", name_en: "Hand Roll", name_zh: "手卷", cuisine: "Japanese", category: "main" },
  { id: "inari-sushi", name_original: "稲荷寿司", name_en: "Fried Tofu Pouch Sushi", name_zh: "稻荷寿司", cuisine: "Japanese", category: "main" },

  // -- Japanese Noodle Soups --
  { id: "ramen-tonkotsu", name_original: "豚骨ラーメン", name_en: "Tonkotsu Ramen", name_zh: "豚骨拉面", cuisine: "Japanese", category: "noodle" },
  { id: "ramen-shoyu", name_original: "醤油ラーメン", name_en: "Shoyu Ramen", name_zh: "酱油拉面", cuisine: "Japanese", category: "noodle" },
  { id: "ramen-miso", name_original: "味噌ラーメン", name_en: "Miso Ramen", name_zh: "味噌拉面", cuisine: "Japanese", category: "noodle" },
  { id: "ramen-shio", name_original: "塩ラーメン", name_en: "Shio Ramen", name_zh: "盐味拉面", cuisine: "Japanese", category: "noodle" },
  { id: "miso-ramen", name_original: "味噌ラーメン", name_en: "Miso Ramen", name_zh: "味噌拉面", cuisine: "Japanese", category: "noodle" },
  { id: "tsukemen", name_original: "つけ麺", name_en: "Dipping Noodles", name_zh: "蘸面", cuisine: "Japanese", category: "noodle" },
  { id: "udon", name_original: "うどん", name_en: "Udon Noodles", name_zh: "乌冬面", cuisine: "Japanese", category: "noodle" },
  { id: "soba", name_original: "蕎麦", name_en: "Buckwheat Noodles", name_zh: "荞麦面", cuisine: "Japanese", category: "noodle" },

  // -- Japanese Fried & Grilled --
  { id: "tempura-shrimp", name_original: "エビ天ぷら", name_en: "Shrimp Tempura", name_zh: "炸虾天妇罗", cuisine: "Japanese", category: "main" },
  { id: "tempura-vegetable", name_original: "野菜天ぷら", name_en: "Vegetable Tempura", name_zh: "蔬菜天妇罗", cuisine: "Japanese", category: "main" },
  { id: "yakitori", name_original: "焼き鳥", name_en: "Grilled Chicken Skewers", name_zh: "烤鸡肉串", cuisine: "Japanese", category: "street-food" },
  { id: "tonkatsu", name_original: "豚カツ", name_en: "Pork Cutlet", name_zh: "日式炸猪排", cuisine: "Japanese", category: "main" },
  { id: "katsu-curry", name_original: "カツカレー", name_en: "Cutlet Curry Rice", name_zh: "炸排咖喱饭", cuisine: "Japanese", category: "rice" },
  { id: "karaage", name_original: "唐揚げ", name_en: "Japanese Fried Chicken", name_zh: "日式炸鸡块", cuisine: "Japanese", category: "appetizer" },
  { id: "tebasaki", name_original: "手羽先", name_en: "Fried Chicken Wings", name_zh: "名古屋炸鸡翅", cuisine: "Japanese", category: "appetizer" },
  { id: "gyudon", name_original: "牛丼", name_en: "Beef Rice Bowl", name_zh: "牛丼饭", cuisine: "Japanese", category: "rice" },
  { id: "oyakodon", name_original: "親子丼", name_en: "Chicken and Egg Rice Bowl", name_zh: "亲子丼", cuisine: "Japanese", category: "rice" },
  { id: "katsudon", name_original: "カツ丼", name_en: "Cutlet Rice Bowl", name_zh: "炸猪排丼", cuisine: "Japanese", category: "rice" },
  { id: "unagi-don", name_original: "鰻丼", name_en: "Eel Rice Bowl", name_zh: "鳗鱼丼", cuisine: "Japanese", category: "rice" },
  { id: "teriyaki-chicken", name_original: "照り焼きチキン", name_en: "Teriyaki Chicken", name_zh: "照烧鸡", cuisine: "Japanese", category: "main" },
  { id: "gyoza", name_original: "餃子", name_en: "Japanese Dumplings", name_zh: "日式煎饺", cuisine: "Japanese", category: "appetizer" },
  { id: "takoyaki", name_original: "たこ焼き", name_en: "Octopus Balls", name_zh: "章鱼烧", cuisine: "Japanese", category: "street-food" },
  { id: "okonomiyaki", name_original: "お好み焼き", name_en: "Savory Pancake", name_zh: "大阪烧", cuisine: "Japanese", category: "main" },
  { id: "kushikatsu", name_original: "串カツ", name_en: "Deep-Fried Skewers", name_zh: "串炸", cuisine: "Japanese", category: "street-food" },
  { id: "korokke", name_original: "コロッケ", name_en: "Japanese Croquettes", name_zh: "日式可乐饼", cuisine: "Japanese", category: "street-food" },
  { id: "hamburg-steak", name_original: "ハンバーグ", name_en: "Japanese Hamburg Steak", name_zh: "日式汉堡排", cuisine: "Japanese", category: "main" },

  // -- Japanese Hot Pots & Stews --
  { id: "sukiyaki", name_original: "すき焼き", name_en: "Sukiyaki Hot Pot", name_zh: "寿喜烧", cuisine: "Japanese", category: "main" },
  { id: "shabu-shabu", name_original: "しゃぶしゃぶ", name_en: "Shabu-Shabu", name_zh: "涮涮锅", cuisine: "Japanese", category: "main" },
  { id: "yakiniku", name_original: "焼肉", name_en: "Japanese BBQ", name_zh: "日式烤肉", cuisine: "Japanese", category: "main" },

  // -- Japanese Rice Dishes --
  { id: "omurice", name_original: "オムライス", name_en: "Omelette Rice", name_zh: "蛋包饭", cuisine: "Japanese", category: "rice" },
  { id: "hayashi-rice", name_original: "ハヤシライス", name_en: "Hashed Beef Rice", name_zh: "哈亚西牛肉饭", cuisine: "Japanese", category: "rice" },
  { id: "japanese-curry", name_original: "カレーライス", name_en: "Japanese Curry Rice", name_zh: "日式咖喱饭", cuisine: "Japanese", category: "rice" },
  { id: "ochazuke", name_original: "お茶漬け", name_en: "Tea Over Rice", name_zh: "茶泡饭", cuisine: "Japanese", category: "rice" },

  // -- Japanese Soups & Salads --
  { id: "miso-soup", name_original: "味噌汁", name_en: "Miso Soup", name_zh: "味噌汤", cuisine: "Japanese", category: "soup" },
  { id: "edamame", name_original: "枝豆", name_en: "Edamame", name_zh: "毛豆", cuisine: "Japanese", category: "appetizer" },
  { id: "wakame-salad", name_original: "わかめサラダ", name_en: "Seaweed Salad", name_zh: "海带沙拉", cuisine: "Japanese", category: "salad" },
  { id: "sunomono", name_original: "酢の物", name_en: "Cucumber Vinegar Salad", name_zh: "醋物", cuisine: "Japanese", category: "salad" },

  // -- Japanese Vegetable & Tofu Dishes --
  { id: "agebitashi", name_original: "揚げ出し豆腐", name_en: "Deep-Fried Tofu in Broth", name_zh: "炸出汁豆腐", cuisine: "Japanese", category: "side" },
  { id: "nasu-dengaku", name_original: "茄子田楽", name_en: "Miso-Glazed Eggplant", name_zh: "味噌烤茄子", cuisine: "Japanese", category: "side" },
  { id: "tofu-steak", name_original: "豆腐ステーキ", name_en: "Grilled Tofu Steak", name_zh: "煎豆腐排", cuisine: "Japanese", category: "side" },
  { id: "yudofu", name_original: "湯豆腐", name_en: "Hot Tofu", name_zh: "汤豆腐", cuisine: "Japanese", category: "main" },
  { id: "natto", name_original: "納豆", name_en: "Fermented Soybeans", name_zh: "纳豆", cuisine: "Japanese", category: "side" },

  // -- Japanese Sashimi Platter --
  { id: "sashimi-platter", name_original: "刺身盛り合わせ", name_en: "Sashimi Platter", name_zh: "刺身拼盘", cuisine: "Japanese", category: "main" },

  // -- Japanese Desserts --
  { id: "matcha-ice-cream", name_original: "抹茶アイスクリーム", name_en: "Matcha Ice Cream", name_zh: "抹茶冰淇淋", cuisine: "Japanese", category: "dessert" },
  { id: "mochi", name_original: "餅", name_en: "Mochi", name_zh: "麻薯", cuisine: "Japanese", category: "dessert" },
  { id: "dorayaki", name_original: "どら焼き", name_en: "Red Bean Pancake", name_zh: "铜锣烧", cuisine: "Japanese", category: "dessert" },
  { id: "taiyaki", name_original: "たい焼き", name_en: "Fish-Shaped Pastry", name_zh: "鲷鱼烧", cuisine: "Japanese", category: "dessert" },
  { id: "anmitsu", name_original: "あんみつ", name_en: "Red Bean Jelly Dessert", name_zh: "馅蜜", cuisine: "Japanese", category: "dessert" },
  { id: "kakigori", name_original: "かき氷", name_en: "Shaved Ice", name_zh: "刨冰", cuisine: "Japanese", category: "dessert" },
  { id: "matcha-tiramisu", name_original: "抹茶ティラミス", name_en: "Matcha Tiramisu", name_zh: "抹茶提拉米苏", cuisine: "Japanese", category: "dessert" },
  { id: "warabimochi", name_original: "わらび餅", name_en: "Bracken Starch Mochi", name_zh: "蕨饼", cuisine: "Japanese", category: "dessert" },
  { id: "dango", name_original: "だんご", name_en: "Rice Dumplings", name_zh: "团子", cuisine: "Japanese", category: "dessert" },
  { id: "yokan", name_original: "羊羹", name_en: "Red Bean Jelly", name_zh: "羊羹", cuisine: "Japanese", category: "dessert" },

  // -- Japanese Rice Dishes (additional) --
  { id: "oyakodon-chicken-egg", name_original: "親子丼", name_en: "Chicken and Egg Rice Bowl", name_zh: "亲子丼饭", cuisine: "Japanese", category: "rice" },
  { id: "nigiri-assorted", name_original: "にぎり盛り合わせ", name_en: "Assorted Nigiri Platter", name_zh: "握寿司拼盘", cuisine: "Japanese", category: "main" },
  { id: "tamagoyaki", name_original: "玉子焼き", name_en: "Japanese Omelette", name_zh: "日式煎蛋卷", cuisine: "Japanese", category: "side" },
  { id: "onigiri", name_original: "おにぎり", name_en: "Rice Ball", name_zh: "日式饭团", cuisine: "Japanese", category: "street-food" },
  { id: "yakisoba", name_original: "焼きそば", name_en: "Fried Noodles", name_zh: "日式炒面", cuisine: "Japanese", category: "noodle" },
  { id: "donburi-assorted", name_original: "丼ぶり", name_en: "Rice Bowl", name_zh: "日式盖饭", cuisine: "Japanese", category: "rice" },
  { id: "matsutake-soup", name_original: "松茸のお吸い物", name_en: "Matsutake Mushroom Soup", name_zh: "松茸清汤", cuisine: "Japanese", category: "soup" },
  { id: "kaiseki", name_original: "懐石料理", name_en: "Kaiseki Multi-Course Meal", name_zh: "怀石料理", cuisine: "Japanese", category: "main" },
  { id: "fugu-sashimi", name_original: "ふぐ刺身", name_en: "Fugu Sashimi", name_zh: "河豚刺身", cuisine: "Japanese", category: "main" },
  { id: "ikura-don", name_original: "いくら丼", name_en: "Salmon Roe Rice Bowl", name_zh: "鲑鱼子丼", cuisine: "Japanese", category: "rice" },
  { id: "negitoro-roll", name_original: "ネギトロ巻き", name_en: "Scallion Tuna Roll", name_zh: "葱香金枪鱼卷", cuisine: "Japanese", category: "main" },
  { id: "chawanmushi", name_original: "茶碗蒸し", name_en: "Steamed Egg Custard", name_zh: "茶碗蒸", cuisine: "Japanese", category: "side" },

  // -- Japanese Drinks --
  { id: "matcha-latte", name_original: "抹茶ラテ", name_en: "Matcha Latte", name_zh: "抹茶拿铁", cuisine: "Japanese", category: "drink" },
  { id: "ramune", name_original: "ラムネ", name_en: "Ramune Soda", name_zh: "波子汽水", cuisine: "Japanese", category: "drink" },

  // ═══════════════════════════════════════
  // ═══ KOREAN (58) ═══
  // ═══════════════════════════════════════

  // -- Korean Rice Dishes --
  { id: "bibimbap", name_original: "비빔밥", name_en: "Mixed Rice Bowl", name_zh: "韩式拌饭", cuisine: "Korean", category: "rice" },
  { id: "kimchi-bokkeumbap", name_original: "김치볶음밥", name_en: "Kimchi Fried Rice", name_zh: "泡菜炒饭", cuisine: "Korean", category: "rice" },
  { id: "ssambap", name_original: "쌈밥", name_en: "Lettuce Wrap Rice", name_zh: "菜包饭", cuisine: "Korean", category: "rice" },

  // -- Korean BBQ & Meat --
  { id: "bulgogi", name_original: "불고기", name_en: "Marinated Grilled Beef", name_zh: "韩式烤肉", cuisine: "Korean", category: "main" },
  { id: "galbi", name_original: "갈비", name_en: "Korean Short Ribs", name_zh: "韩式牛排骨", cuisine: "Korean", category: "main" },
  { id: "samgyeopsal", name_original: "삼겹살", name_en: "Pork Belly BBQ", name_zh: "韩式烤五花肉", cuisine: "Korean", category: "main" },
  { id: "korean-bbq-platter", name_original: "한상 차림", name_en: "Korean BBQ Platter", name_zh: "韩式烤肉拼盘", cuisine: "Korean", category: "main" },
  { id: "bossam", name_original: "보쌈", name_en: "Boiled Pork Wraps", name_zh: "韩式水煮五花肉", cuisine: "Korean", category: "main" },
  { id: "makchang", name_original: "막창", name_en: "Grilled Pork Intestines", name_zh: "韩式烤肠", cuisine: "Korean", category: "main" },
  { id: "jokbal", name_original: "족발", name_en: "Braised Pig's Feet", name_zh: "韩式卤猪蹄", cuisine: "Korean", category: "main" },

  // -- Korean Fried Chicken --
  { id: "korean-fried-chicken", name_original: "한국식 치킨", name_en: "Korean Fried Chicken", name_zh: "韩式炸鸡", cuisine: "Korean", category: "main" },
  { id: "yangnyeom-chicken", name_original: "양념 치킨", name_en: "Sweet Spicy Chicken", name_zh: "韩式甜辣炸鸡", cuisine: "Korean", category: "main" },
  { id: "ganjang-chicken", name_original: "간장 치킨", name_en: "Soy Garlic Chicken", name_zh: "酱油蒜香炸鸡", cuisine: "Korean", category: "main" },
  { id: "dakgangjeong", name_original: "닭강정", name_en: "Sweet Glazed Chicken", name_zh: "韩式甜酥鸡", cuisine: "Korean", category: "main" },
  { id: "dakgalbi", name_original: "닭갈비", name_en: "Spicy Stir-Fried Chicken", name_zh: "春川辣炒鸡排", cuisine: "Korean", category: "main" },

  // -- Korean Stews & Soups --
  { id: "kimchi-jjigae", name_original: "김치찌개", name_en: "Kimchi Stew", name_zh: "泡菜汤", cuisine: "Korean", category: "soup" },
  { id: "doenjang-jjigae", name_original: "된장찌개", name_en: "Soybean Paste Stew", name_zh: "大酱汤", cuisine: "Korean", category: "soup" },
  { id: "sundubu-jjigae", name_original: "순두부찌개", name_en: "Soft Tofu Stew", name_zh: "嫩豆腐汤", cuisine: "Korean", category: "soup" },
  { id: "budae-jjigae", name_original: "부대찌개", name_en: "Army Stew", name_zh: "部队锅", cuisine: "Korean", category: "soup" },
  { id: "samgyetang", name_original: "삼계탕", name_en: "Ginseng Chicken Soup", name_zh: "参鸡汤", cuisine: "Korean", category: "soup" },
  { id: "yukgaejang", name_original: "육개장", name_en: "Spicy Beef Soup", name_zh: "辣牛肉汤", cuisine: "Korean", category: "soup" },
  { id: "seolleongtang", name_original: "설렁탕", name_en: "Ox Bone Soup", name_zh: "雪浓汤", cuisine: "Korean", category: "soup" },
  { id: "galbitang", name_original: "갈비탕", name_en: "Short Rib Soup", name_zh: "牛排骨汤", cuisine: "Korean", category: "soup" },
  { id: "cheonggukjang", name_original: "청국장", name_en: "Fermented Soybean Stew", name_zh: "清国酱汤", cuisine: "Korean", category: "soup" },
  { id: "tteokguk", name_original: "떡국", name_en: "Rice Cake Soup", name_zh: "年糕汤", cuisine: "Korean", category: "soup" },

  // -- Korean Noodles --
  { id: "tteokbokki", name_original: "떡볶이", name_en: "Spicy Rice Cakes", name_zh: "韩式炒年糕", cuisine: "Korean", category: "street-food" },
  { id: "japchae", name_original: "잡채", name_en: "Glass Noodle Stir-Fry", name_zh: "韩式杂菜", cuisine: "Korean", category: "noodle" },
  { id: "kalguksu", name_original: "칼국수", name_en: "Knife-Cut Noodle Soup", name_zh: "刀削面", cuisine: "Korean", category: "noodle" },
  { id: "bibim-naengmyeon", name_original: "비빔냉면", name_en: "Spicy Cold Noodles", name_zh: "韩式拌冷面", cuisine: "Korean", category: "noodle" },
  { id: "mul-naengmyeon", name_original: "물냉면", name_en: "Cold Buckwheat Noodles in Broth", name_zh: "韩式水冷面", cuisine: "Korean", category: "noodle" },
  { id: "jajangmyeon", name_original: "자장면", name_en: "Black Bean Noodles", name_zh: "韩式炸酱面", cuisine: "Korean", category: "noodle" },
  { id: "kongguksu", name_original: "콩국수", name_en: "Cold Soy Milk Noodles", name_zh: "豆浆冷面", cuisine: "Korean", category: "noodle" },
  { id: "bibim-guksu", name_original: "비빔국수", name_en: "Spicy Mixed Noodles", name_zh: "韩式拌面", cuisine: "Korean", category: "noodle" },

  // -- Korean Pancakes & Savory Items --
  { id: "haemul-pajeon", name_original: "해물파전", name_en: "Seafood Pancake", name_zh: "韩式海鲜葱饼", cuisine: "Korean", category: "appetizer" },
  { id: "kimbap", name_original: "김밥", name_en: "Korean Seaweed Rice Roll", name_zh: "韩式紫菜包饭", cuisine: "Korean", category: "main" },
  { id: "mandu", name_original: "만두", name_en: "Korean Dumplings", name_zh: "韩式饺子", cuisine: "Korean", category: "main" },
  { id: "kimchi-mandu", name_original: "김치만두", name_en: "Kimchi Dumplings", name_zh: "泡菜饺子", cuisine: "Korean", category: "main" },

  // -- Korean Seafood --
  { id: "ganjang-gejang", name_original: "간장게장", name_en: "Soy-Marinated Raw Crab", name_zh: "酱油腌蟹", cuisine: "Korean", category: "main" },
  { id: "nakji-bokkeum", name_original: "낙지볶음", name_en: "Spicy Stir-Fried Octopus", name_zh: "辣炒章鱼", cuisine: "Korean", category: "main" },
  { id: "samhap", name_original: "삼합", name_en: "Tripe, Pork, and Kimchi", name_zh: "韩式三合", cuisine: "Korean", category: "main" },
  { id: "gopchang", name_original: "곱창", name_en: "Beef Intestines", name_zh: "韩式烤牛肠", cuisine: "Korean", category: "main" },

  // -- Korean Sausage & Street Food --
  { id: "sundae-sausage", name_original: "순대", name_en: "Korean Blood Sausage", name_zh: "韩式血肠", cuisine: "Korean", category: "street-food" },
  { id: "hotteok", name_original: "호떡", name_en: "Sweet Pancake", name_zh: "韩式糖饼", cuisine: "Korean", category: "street-food" },
  { id: "bungeoppang", name_original: "붕어빵", name_en: "Fish-Shaped Pastry", name_zh: "韩式鲷鱼烧", cuisine: "Korean", category: "street-food" },
  { id: "gyeranppang", name_original: "계란빵", name_en: "Egg Bread", name_zh: "韩式鸡蛋面包", cuisine: "Korean", category: "street-food" },

  // -- Korean Side Dishes (Banchan) --
  { id: "oi-muchim", name_original: "오이무침", name_en: "Spicy Cucumber Salad", name_zh: "韩式凉拌黄瓜", cuisine: "Korean", category: "side" },
  { id: "sigeumchi-namul", name_original: "시금치나물", name_en: "Spinach with Sesame", name_zh: "韩式拌菠菜", cuisine: "Korean", category: "side" },
  { id: "kongnamul", name_original: "콩나물", name_en: "Seasoned Bean Sprouts", name_zh: "韩式拌豆芽", cuisine: "Korean", category: "side" },
  { id: "gaji-namul", name_original: "가지나물", name_en: "Seasoned Eggplant", name_zh: "韩式拌茄子", cuisine: "Korean", category: "side" },

  // -- Korean Drinks --
  { id: "soju", name_original: "소주", name_en: "Soju", name_zh: "韩国烧酒", cuisine: "Korean", category: "drink" },
  { id: "makgeolli", name_original: "막걸리", name_en: "Rice Wine", name_zh: "马格利米酒", cuisine: "Korean", category: "drink" },

  // -- Korean Additional Dishes --
  { id: "gochujang-jjigae", name_original: "고추장찌개", name_en: "Gochujang Stew", name_zh: "辣椒酱汤", cuisine: "Korean", category: "soup" },
  { id: "pajeon", name_original: "파전", name_en: "Green Onion Pancake", name_zh: "韩式葱饼", cuisine: "Korean", category: "appetizer" },

  // -- Korean Desserts --
  { id: "bingsu", name_original: "빙수", name_en: "Shaved Ice Dessert", name_zh: "韩式刨冰", cuisine: "Korean", category: "dessert" },
  { id: "patbingsu", name_original: "팥빙수", name_en: "Red Bean Shaved Ice", name_zh: "红豆刨冰", cuisine: "Korean", category: "dessert" },
  { id: "injeolmi", name_original: "인절미", name_en: "Coated Rice Cakes", name_zh: "韩式豆粉糕", cuisine: "Korean", category: "dessert" },

  // ═══════════════════════════════════════
  // ═══ VIETNAMESE (30) ═══
  // ═══════════════════════════════════════

  // -- Vietnamese Soups & Noodles --
  { id: "pho-bo", name_original: "Phở Bò", name_en: "Beef Pho", name_zh: "越南牛肉河粉", cuisine: "Vietnamese", category: "noodle" },
  { id: "pho-ga", name_original: "Phở Gà", name_en: "Chicken Pho", name_zh: "越南鸡肉河粉", cuisine: "Vietnamese", category: "noodle" },
  { id: "bun-cha", name_original: "Bún Chả", name_en: "Grilled Pork with Noodles", name_zh: "越式烤肉米粉", cuisine: "Vietnamese", category: "noodle" },
  { id: "bun-bo-hue", name_original: "Bún Bò Huế", name_en: "Spicy Beef Noodle Soup", name_zh: "顺化牛肉米粉", cuisine: "Vietnamese", category: "noodle" },
  { id: "cao-lau", name_original: "Cao Lầu", name_en: "Hoi An Noodles", name_zh: "会安高楼面", cuisine: "Vietnamese", category: "noodle" },
  { id: "mi-quang", name_original: "Mì Quảng", name_en: "Turmeric Noodles", name_zh: "广南米粉", cuisine: "Vietnamese", category: "noodle" },
  { id: "hu-tieu", name_original: "Hủ Tiếu", name_en: "Pork Noodle Soup", name_zh: "胡条粉", cuisine: "Vietnamese", category: "noodle" },
  { id: "bun-thit-nuong", name_original: "Bún Thịt Nướng", name_en: "Grilled Pork Vermicelli", name_zh: "越式烤肉捞粉", cuisine: "Vietnamese", category: "noodle" },
  { id: "pho-xao", name_original: "Phở Xào", name_en: "Stir-Fried Rice Noodles", name_zh: "越南炒河粉", cuisine: "Vietnamese", category: "noodle" },

  // -- Vietnamese Rice Dishes --
  { id: "com-tam", name_original: "Cơm Tấm", name_en: "Broken Rice with Grilled Pork", name_zh: "越南碎米饭", cuisine: "Vietnamese", category: "rice" },

  // -- Vietnamese Rolls & Wraps --
  { id: "banh-mi", name_original: "Bánh Mì", name_en: "Vietnamese Baguette Sandwich", name_zh: "越南法棍三明治", cuisine: "Vietnamese", category: "main" },
  { id: "goi-cuon", name_original: "Gỏi Cuốn", name_en: "Summer Rolls", name_zh: "越南春卷", cuisine: "Vietnamese", category: "appetizer" },
  { id: "cha-gio", name_original: "Chả Giò", name_en: "Fried Spring Rolls", name_zh: "越式炸春卷", cuisine: "Vietnamese", category: "appetizer" },
  { id: "banh-cuon", name_original: "Bánh Cuốn", name_en: "Steamed Rice Rolls", name_zh: "越南蒸粉卷", cuisine: "Vietnamese", category: "breakfast" },
  { id: "bo-la-lot", name_original: "Bò Lá Lốt", name_en: "Beef in Betel Leaf", name_zh: "蒌叶牛肉卷", cuisine: "Vietnamese", category: "appetizer" },

  // -- Vietnamese Main Dishes --
  { id: "banh-xeo", name_original: "Bánh Xèo", name_en: "Sizzling Crepe", name_zh: "越南煎饼", cuisine: "Vietnamese", category: "main" },
  { id: "bo-luc-lac", name_original: "Bò Lúc Lắc", name_en: "Shaking Beef", name_zh: "越式摇摇牛肉", cuisine: "Vietnamese", category: "main" },
  { id: "ca-kho-to", name_original: "Cá Kho Tộ", name_en: "Caramelized Fish in Clay Pot", name_zh: "越式瓦缸鱼", cuisine: "Vietnamese", category: "main" },
  { id: "canh-chua", name_original: "Canh Chua", name_en: "Sweet and Sour Soup", name_zh: "越式酸汤", cuisine: "Vietnamese", category: "soup" },

  // -- Vietnamese Street Food & Snacks --
  { id: "banh-trang-tron", name_original: "Bánh Tráng Trộn", name_en: "Mixed Rice Paper Salad", name_zh: "越南米纸沙拉", cuisine: "Vietnamese", category: "street-food" },

  // -- Vietnamese Desserts --
  { id: "che-dessert", name_original: "Chè", name_en: "Vietnamese Sweet Soup", name_zh: "越南甜汤", cuisine: "Vietnamese", category: "dessert" },

  // -- Vietnamese Drinks --
  { id: "ca-phe-sua-da", name_original: "Cà Phê Sữa Đá", name_en: "Vietnamese Iced Coffee", name_zh: "越南冰牛奶咖啡", cuisine: "Vietnamese", category: "drink" },
  { id: "ca-phe-trung", name_original: "Cà Phê Trứng", name_en: "Egg Coffee", name_zh: "越南蛋咖啡", cuisine: "Vietnamese", category: "drink" },
  { id: "sinh-to-bo", name_original: "Sinh Tố Bơ", name_en: "Avocado Smoothie", name_zh: "越南牛油果奶昔", cuisine: "Vietnamese", category: "drink" },
  { id: "bun-rieu", name_original: "Bún Riêu", name_en: "Crab Noodle Soup", name_zh: "越南蟹肉米线", cuisine: "Vietnamese", category: "noodle" },
  { id: "goi ngo sen", name_original: "Gỏi Ngó Sen", name_en: "Lotus Stem Salad", name_zh: "越式莲藕沙拉", cuisine: "Vietnamese", category: "salad" },
];
