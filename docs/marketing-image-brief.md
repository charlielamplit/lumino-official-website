# Lumino 官网图片需求与生成 Prompt 清单

- 版本：2026-10-29
- 用途：替换营销站占位图；可用 GPT Image / DALL·E / Flux 等生成**无品牌水印、可商用**的素材
- 统一风格关键词（建议每条 prompt 末尾都带上）：  
  `editorial documentary photo, soft natural light, muted green and charcoal palette, no text, no logo, no watermark, no UI mockup chrome, photorealistic, high detail`

---

## 使用说明

1. 按「文件名」导出，放到 `apps/site/site/assets/`（产品截图可放 `apps/site/site/assets/product/`）。
2. 比例按「建议尺寸」生成；上线前可再压缩为 WebP/JPEG。
3. **产品界面图**优先用真实 Portal 截图，不要用 AI 瞎编软件界面（容易假、也难一致）。
4. **人物肖像**若无真实照片：用 AI 生成需标明「示意」，正式上线应换真实团队照。
5. 生成后检查：无人脸水印、无乱码文字、无可识别商标。

---

## A. 首页 `Lumino 官网.dc.html`

### A1. 首屏背景 Hero
| 项 | 内容 |
|---|---|
| **放置位置** | `.m-hero__media` → `apps/site/site/assets/hero.png` |
| **主题** | 出口制造 / 港口或工厂航拍，偏冷静、专业，不要「环保插画」感 |
| **建议尺寸** | 2400×1400（约 12:7），横图 |
| **Prompt（EN）** | `Aerial documentary photograph of a modern container port next to industrial factories at dawn, soft mist, muted deep green and charcoal tones, quiet and serious mood, empty of people in the foreground, no cranes with readable logos, no text, no watermark, photorealistic, 35mm, soft natural light, editorial style` |
| **备选 Prompt** | `Wide aerial view of a steel or manufacturing plant roofs and logistics yards in East Asia at blue hour, cool muted palette, cinematic but restrained, no text, no logo, no watermark, photorealistic` |

### A2. 平台区产品示意
| 项 | 内容 |
|---|---|
| **放置位置** | 首页「新增一项要求…」右侧 `.m-shot` |
| **主题** | **优先真实截图**：客户门户工作台（任务/进度）。若暂时无截图，用「干净桌面 + 笔记本显示模糊工作界面」氛围图 |
| **建议尺寸** | 1600×1000 |
| **Prompt（仅氛围占位，非正式 UI）** | `Clean desk photograph of a laptop showing a blurred professional SaaS dashboard with soft green accent highlights, shallow depth of field, modern office, no readable text, no logos, no watermark, photorealistic, editorial` |
| **正式方案** | 从 Portal 工作台截屏 → `product/portal-workspace.png`，勿用 AI 编造控件文字 |

### A3–A5. 案例卡片配图（3 张）
| ID | 放置位置 | 主题 | 文件名 | Prompt |
|---|---|---|---|---|
| A3 | 首页案例卡 1 / 案例页钢铁 | 热轧/钢铁产线 | `cases/steel-mill.png` | `Interior of a modern hot-rolling steel mill, glowing metal strip line in the distance, industrial but clean, muted tones with warm furnace light, no workers facing camera, no text, no logos, no watermark, photorealistic` |
| A4 | 首页案例卡 2 / 案例页纺织 | 面料/染整车间 | `cases/textile-mill.png` | `Quiet textile dyeing and finishing workshop with fabric rolls and stainless machines, soft daylight from high windows, calm professional atmosphere, no faces, no brand labels readable, no text, no watermark, photorealistic` |
| A5 | 首页案例卡 3 / 案例页包装 | 包装工厂 | `cases/packaging-plant.png` | `Modern packaging plant interior with paper and corrugated lines, tidy aisles, soft industrial lighting, green-gray palette, no people in focus, no logos, no text, no watermark, photorealistic` |

---

## B. 平台页 `Lumino 平台.dc.html`

### B1. 产品截图：工作台
| 项 | 内容 |
|---|---|
| **放置位置** | `.pf-shots` 第一张 `.pf-shot` |
| **主题** | 客户门户「工作台 / 当前事项与进度」 |
| **建议尺寸** | 1600×1000 |
| **来源** | **真实 Portal 截图**（推荐） |
| **若必须 AI 氛围图** | 同 A2；并加说明「示意，非最终界面」 |

### B2. 产品截图：数据资产
| 项 | 内容 |
|---|---|
| **放置位置** | `.pf-shots` 第二张 |
| **主题** | 数据资产列表：版本、引用、证据 |
| **建议尺寸** | 1600×1000 |
| **来源** | **真实 Portal「数据资产」页截图** |
| **Prompt（氛围备选）** | `Close-up of a laptop screen with a blurred data table and version badges in soft green, dark charcoal UI feel, shallow depth of field, office environment, no readable words, no logos, no watermark, photorealistic` |

> 平台页「数据安全」区块以图标+文案为主，**不强制配大图**。若要加信任图，可用下方 B3。

### B3.（可选）数据可信氛围图
| 项 | 内容 |
|---|---|
| **放置位置** | 数据安全区块上方或右侧（需另改版） |
| **主题** | 文件/证据归档的抽象纪实，不要保险箱卡通 |
| **建议尺寸** | 1600×900 |
| **文件名（已生成）** | `about/evidence-archive.png` |
| **Prompt** | `Documentary photo of organized archival folders and sealed evidence envelopes on a metal shelf in a quiet compliance office, soft side light, muted green gray palette, serious tone, no text readable, no logos, no watermark, photorealistic` |

---

## C. 解决方案页 `industries/`

每切换一个行业，右侧 `.ind-visual__media` 换图。建议 6 张：

| ID | 行业 | 文件名 | 主题 | Prompt |
|---|---|---|---|---|
| C1 | 钢铁 | `industries/steel.png` | 炼钢/轧线冷静工业 | `Wide shot of a steel plant production hall with rolling equipment, cool industrial light, restrained green-charcoal grade, empty of marketing glamour, no text, no logos, no watermark, photorealistic` |
| C2 | 铝 | `industries/aluminium.png` | 电解/铝加工 | `Aluminium extrusion or casting plant interior, silver metal profiles, clean floors, soft daylight, professional industrial photo, no faces, no logos, no text, no watermark` |
| C3 | 纺织服装 | `industries/textile.png` | 织布/染整 | `Rows of fabric rolls in a textile warehouse-workshop, soft natural light, calm colors, documentary style, no brand tags readable, no text, no watermark, photorealistic` |
| C4 | 包装 | `industries/packaging.png` | 纸塑包装产线 | `Corrugated packaging production line in a bright factory, neat and modern, muted palette, no people facing camera, no logos, no text, no watermark, photorealistic` |
| C5 | 化工 | `industries/chemicals.png` | 化工装置外景/管廊 | `Exterior of a modern chemical plant pipe racks at dusk, blue-hour light, serious industrial documentary, no flames, no logos, no text, no watermark, photorealistic` |
| C6 | 电子电器 | `industries/electronics.png` | SMT/洁净装配 | `Electronics assembly cleanroom aisle with SMT lines softly out of focus, cool white-green light, high-tech but restrained, no readable PCB brands, no text, no watermark, photorealistic` |

建议尺寸：1200×900（4:3）或 1400×900。

---

## D. 案例页 `cases/`

与首页 A3–A5 共用即可；若案例页要更大图，导出 2000×1200 版本：

| 文件名 | 对应案例 |
|---|---|
| `cases/steel-mill.png` | 钢铁 CBAM |
| `cases/textile-mill.png` | 纺织 PCF |
| `cases/packaging-plant.png` | 包装 GHG+ESG |

---

## E. 工具页 `tools/`

| 项 | 内容 |
|---|---|
| **放置位置** | `.tool-feature__shot`（当前为 CSS 示意条） |
| **主题** | **优先 CBAM 计算器真实界面截图** |
| **文件名** | `product/cbam-calculator.png` |
| **AI 仅作临时** | `Laptop showing a blurred analytics dashboard with cost charts in green accents, no readable numbers that look fake, no logos, no watermark, photorealistic desk photo` |

---

## F. 关于我们 `Lumino 关于.dc.html`

| ID | 放置位置 | 主题 | 文件名 | Prompt / 说明 |
|---|---|---|---|---|
| F1–F4 | `.about-portrait` ×4 | 团队半身职业照（示意） | `team/strategy.jpg` 等 | **正式应用真实照片**。示意 Prompt：`Professional head-and-shoulders portrait of an East Asian business leader in a neutral studio, soft light, charcoal blazer, calm expression, plain light gray background, no text, no watermark, photorealistic`（四人略改年龄/性别描述，避免同一张脸） |
| F5（可选） | 使命区背景 | 上海办公/城市天际线冷静照片 | `about/shanghai-office.jpg` | `Quiet modern office interior in Shanghai with large windows and soft daylight, minimal desks, muted green plants, professional atmosphere, no logos, no text, no watermark, photorealistic` |

---

## G. 不要用 AI 生成的内容

| 类型 | 原因 | 正确做法 |
|---|---|---|
| 带可读中文/英文 UI 的「假软件截图」 | 文字乱码、不像产品 | Portal / Calculator 实机截图 |
| 带「ISO / CBAM」徽章拼贴 | 易侵权、显廉价 | 文案写标准名即可 |
| 夸张的地球绿叶插画 Hero | 与品牌「安静、严谨」不符 | 用纪实工业/港口摄影风 |

---

## H. 推荐落地文件树

```text
apps/site/site/assets/
  hero.png
  product/
    portal-workspace.png
    portal-data-assets.png
    cbam-calculator.png
  cases/
    steel-mill.png
    textile-mill.png
    packaging-plant.png
  industries/
    steel.png
    aluminium.png
    textile.png
    packaging.png
    chemicals.png
    electronics.png
  team/          # 可选，真实照片优先
  about/         # 可选
```

---

## I. 一键复制：通用负面约束（加在每条 prompt 后）

```text
Avoid: watermarks, logos, brand names, readable UI text, captions, posters, collage, cartoon, 3D render look, neon cyberpunk, purple glow, stock-photo fake smiles, crowded composition
```

---

## J. 优先级（先做这些就能明显改观）

1. **A1** Hero  
2. **C1–C6** 行业页（解决方案最缺图）  
3. **A3–A5 / D** 案例图  
4. **B1–B2 / E** 真实产品截图  
5. **F** 团队真实照片  

本文件仅作制作说明，**未改线上部署**；图片就位后再改 HTML 引用路径即可。


---

## K. 当前已就位文件（2026-10-29）

| 规范名 | 状态 |
|---|---|
| `hero.png` | 已就位 |
| `about/evidence-archive.png` | 已就位（B3） |
| `cases/steel-mill.png` | 已就位（2026-10-29 差异化气质替换） |
| `cases/textile-mill.png` | 已就位（同上） |
| `cases/packaging-plant.png` | 已就位（同上） |
| `industries/steel.png` | 已就位 |
| `industries/aluminium.png` | 已就位 |
| `industries/textile.png` | 已就位 |
| `industries/packaging.png` | 已就位 |
| `industries/chemicals.png` | 已就位 |
| `industries/electronics.png` | 已就位 |
| `product/portal-workspace.png` | 未就位 |
| `product/portal-data-assets.png` | 未就位 |
| `product/cbam-calculator.png` | 未就位 |
| `team/*` | 未就位 |

说明：生成图为 PNG，故文件名使用 `.png`（与原先清单中的 `.jpg` 等价，以实际文件为准）。

---

## L. 项目案例配图 · 差异化气质 Prompt（2026-10-29 修订）

目标：替换三张案例图，**三条气质刻意拉开**，不要同一套「破旧纪实」。  
共同底线：真实工厂、无商标/无文字/无人脸正对镜头、不去 AI 塑料感；**不要**三条都脏、都灰、都颗粒。

| 案例 | 气质关键词 | 光色 | 整洁度 |
|---|---|---|---|
| 钢铁 CBAM | 热力工业 · 有分量 | 偏暗 + 炉口暖光 | 重工业真实，允许磨损，但不破败 |
| 纺织 PCF | 明亮有序 · 柔和 | 高窗自然光为主 | **偏干净、偏新**，像管理良好的染整厂 |
| 包装 GHG+ESG | 现代物流产线 · 清爽 | 冷白日光灯 + 卸货口亮光 | **偏新厂/规范化**，整齐但不像样板间 |

### 共用负面（三条都加）

```text
Avoid: AI plastic look, oversharpen, CGI, unreal engine, teal-orange grade, purple neon, god rays, brochure hero pose, perfect bilateral symmetry, watermark, logos, readable signs or Chinese/English text, faces looking at camera, cartoon, collage
```

---

### Case 1 · 钢铁 CBAM → `cases/steel-mill.png` · 1600×900  
**气质：热力与尺度（唯一允许偏暗、有尘雾的一张）**

```text
Wide interior of a modern East Asian hot-rolling mill, long perspective down the line, heat haze and a soft ember glow only near the distant metal, mostly cool charcoal hall, serious heavy-industry mood, functional safety yellow accents, floor used but not ruined, no romantic decay, no junk piles, one small figure with back turned far away for scale, shot on 35mm, restrained contrast, photorealistic, no text, no logos, no watermark
```

备选（更「过程特写」）：

```text
Three-quarter view of a glowing steel strip entering rolls in a contemporary mill, tight industrial focus, warm metal against cool gray machinery, crisp but not HDR, slight atmospheric haze only around heat, clean composition with intentional asymmetry, professional industrial photo not stock glamour, no people facing camera, no text, no logos
```

---

### Case 2 · 纺织 PCF → `cases/textile-mill.png` · 1600×900  
**气质：明亮、干净、柔和（与钢铁拉开对比）**

```text
Bright modern textile dyeing and finishing hall in South China, tall clean windows with soft daylight, stainless machines and neatly stacked fabric rolls in calm rows, pale sage and warm concrete palette, orderly and well-kept, quiet professional atmosphere, almost serene, shallow depth of field, gentle colors slightly desaturated, no wet mess, no grime showcase, no brand labels readable, no faces, photorealistic editorial, no text, no logos, no watermark
```

备选（更「物料静物」）：

```text
Sunlit close-mid shot of dyed fabric rolls on a clean trolley beside a finishing machine, soft window light, pale walls, tidy aisle, subtle green-gray grade, calm and precise mood like a well-run supplier audit visit, not rustic, not dusty, shallow DOF, photorealistic, no logos, no text
```

---

### Case 3 · 包装 GHG+ESG → `cases/packaging-plant.png` · 1600×900  
**气质：现代、清爽、物流感（偏新厂）**

```text
Contemporary corrugated packaging plant interior, bright even LED industrial lighting, straight conveyor with brown blanks, clear aisle markings, organized pallet stacks, open loading dock with cool daylight at the end of the hall, green-gray and kraft paper palette, modern and efficient feel, lightly lived-in but not old or peeling, wide 28mm reportage crop with mild asymmetry, photorealistic, no carton logos, no text, no people facing camera, no watermark
```

备选（更「整齐物料」）：

```text
Clean side view of flat carton stacks and a packaging line in a newer North China plant, bright white-green fluorescent light, smooth epoxy floor, orderly geometry, soft shadows, modern manufacturing brochure but restrained not glossy CGI, kraft and cool gray tones, no logos, no text, no watermark
```

---

### 生成后自检（差异优先）

1. 三张并排：是否一眼能分出「暗热 / 亮柔 / 清爽物流」？分不出就重做  
2. 纺织、包装是否仍像「破旧车间」？是则丢掉，往干净、有序方向重生  
3. 钢铁是否变成样板间？过净则略加热雾与尺度感，但不要刻意做旧  
4. 导出覆盖同名文件即可上线
