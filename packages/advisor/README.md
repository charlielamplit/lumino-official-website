# @lumino/advisor

Lumino 官网服务顾问的确定性内核。该包不调用模型，不读取 Portal 数据，不创建销售线索。

路由优先级：

1. 现有工具与页面路由；
2. 已审核固定答案；
3. 结构化服务分诊；
4. 未命中时返回 `fallback`，留给后续检索/模型层处理。

CN Code 路由只提供已有试算器、核对指南和人工复核入口，不根据产品描述生成正式归类结论。

```js
const advisor = require("./router.js");
const result = advisor.route({ topicId: "cbam_scope", lang: "zh" });
```
