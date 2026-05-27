const mockResult = {
  task_id: "preview-task",
  status: "done",
  pages: [
    {
      page_index: 0,
      page_label: "菜单",
      image_thumbnail: "",
      dishes: [
        {
          id: "dish-1",
          name_original: "Okroshka",
          name_translated: { zh: "冷蔬菜汤 奥克罗什卡", en: "Cold vegetable soup okroshka" },
          description: {
            zh: "以蔬菜和鸡蛋为主的清爽冷汤，适合开胃。",
            en: "A refreshing cold soup with vegetables and egg."
          },
          ingredients: ["黄瓜", "土豆", "鸡蛋", "酸奶油"],
          allergens: ["蛋", "奶"],
          taste_profile: ["清爽", "微酸"],
          recommendation: "夏天或想吃轻一点时可以点。",
          caution: "冷汤口味特别，不喜欢酸味可谨慎选择。",
          image_source: "ai"
        },
        {
          id: "dish-2",
          name_original: "Beef Stroganoff",
          name_translated: { zh: "俄式酸奶油牛肉", en: "Beef stroganoff" },
          description: {
            zh: "牛肉配蘑菇和酸奶油酱，通常搭配土豆泥或面。",
            en: "Beef with mushrooms and sour cream sauce."
          },
          ingredients: ["牛肉", "蘑菇", "酸奶油"],
          allergens: ["奶"],
          taste_profile: ["浓郁", "咸香"],
          recommendation: "想吃热菜和主食搭配时很稳。",
          caution: "酱汁较厚重。",
          image_source: "ai"
        }
      ]
    }
  ],
  metadata: {
    source_language: "en",
    total_dishes: 2,
    cached: false
  }
};

module.exports = {
  mockResult
};
