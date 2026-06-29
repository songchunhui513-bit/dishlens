# DishLens 点单与点过功能技术文档

日期：2026-06-03

## 1. 实现原则

本功能是现网 H5 的增量功能，不做主视觉重构。

- 首页只改底部导航。
- 结果列表只加轻量选择控件。
- 菜品详情只加底部点单模块。
- 点过详情复用现网结果列表的卡片语义和视觉。
- 数据先使用 localStorage，不接账号体系。
- 本次只做本地研发和自检，不发布现网。

## 2. 新增数据模型

建议在 `src/types/index.ts` 增加：

- `OrderQuantityMap`：当前翻译会话的菜品数量映射。
- `OrderNote`：点单备注，包含中文、自定义目标语言文本。
- `OrderedDishItem`：已点菜品快照，包含菜品、数量、价格识别结果、是否已评价。
- `OrderedVisit`：一次餐厅点单记录，包含餐厅名、语言、时间、菜品列表、备注、参考总价和是否含待核价。

## 3. 本地存储

在 `src/lib/local-storage.ts` 增加：

- `getOrderedVisits()`
- `addOrderedVisit(visit)`
- `updateOrderedVisit(visit)`
- `markOrderedDishReviewed(visitId, dishId)`

存储 key：

`dishlens_ordered_visits`

数量限制：

最多保留 30 次点过记录，超过后删除最旧记录。

## 4. 状态与工具函数

新增 `src/lib/order-state.ts`，只放纯函数，便于测试：

- `getDishOrderId(dish)`
- `changeOrderQuantity(map, dish, delta)`
- `setOrderQuantity(map, dish, quantity)`
- `buildOrderItems(result, quantityMap)`
- `parseDishPrice(dish)`
- `summarizeOrder(items)`
- `buildOrderedVisit(result, items, notes, targetLang)`

价格策略：

- 从菜品对象中兼容读取 `price`、`price_original`、`price_text`、`original_price` 等字段。
- 能识别数值和货币符号时展示参考金额。
- 未识别价格时显示“价格待核对”，不参与总价。

## 5. 页面与组件

### 5.1 `src/components/order/OrderQuantityControl.tsx`

结果列表和详情页复用。

状态：

- 未选：轻量加号。
- 已选：显示数量。
- hover/focus/active：显示减号、数量、加号。

### 5.2 `src/components/order/OrderSummaryDock.tsx`

详情页底部模块。

职责：

- 显示本次已选数量、参考金额/部分待核价。
- 提供当前菜数量加减。
- 提供进入点单确认页按钮。
- 给详情页底部留出 padding，避免遮挡原有评价按钮。

### 5.3 `src/components/order/OrderConfirmPage.tsx`

给店员核对页。

职责：

- 展示原语言菜名、中文核对名、数量、价格。
- 展示备注快捷选择。
- 点击“我已点好，保存到点过”保存 localStorage 并跳转点过页。

### 5.4 `src/components/order/OrderedPage.tsx`

点过聚合页。

职责：

- 显示已点记录列表。
- 卡片整卡进入点过详情。
- 可提供轻量餐厅评价按钮，但不加分享。

### 5.5 `src/components/order/OrderedDetailPage.tsx`

点过详情页。

职责：

- 使用翻译结果列表卡片风格展示本次点过菜品。
- 卡片右上角加“评价/已评”。
- 点击卡片进入现有 `DishDetailPage`。

## 6. `src/app/page.tsx` 接入

新增 screen：

- `orderConfirm`
- `ordered`
- `orderedDetail`

新增状态：

- `orderQuantities`
- `orderedVisits`
- `selectedOrderedVisit`
- `reviewReturn`

关键逻辑：

- 从结果列表或详情页修改 `orderQuantities`。
- 点单确认页保存后清空当前 `orderQuantities`。
- 从点过详情进入菜品详情时，复用现有导航栈返回。
- 从点过详情评价菜品时，评价完成标记该菜已评并返回点过详情。

## 7. 测试策略

先补充 `tests/logic-regressions.test.mjs`：

- 订单数量纯函数：加、减、归零删除、构建 items。
- 价格摘要：未知价格不参与总价，并标记 `hasUnknownPrices`。
- 本地存储：新增 key、读取、保存、标记已评。
- UI 边界：HomePage 包含 `navOrdered`，ResultsPage 只接入选择控件，DishDetailPage 只接入 `OrderSummaryDock`，不出现新的顶部统计。

自检命令：

- `node --test tests/logic-regressions.test.mjs`
- `npm run lint`
- 本地启动后用 393px 视口截图检查首页、结果页、详情页、点单确认页、点过页、点过详情页。

## 8. 发布约束

本次完成后只提供本地演示地址和测试结果。

禁止执行生产部署命令，直到用户明确确认上线。
