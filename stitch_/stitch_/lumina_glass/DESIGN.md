---
name: Lumina Glass
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#ccc3d8'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#958da1'
  outline-variant: '#4a4455'
  surface-tint: '#d2bbff'
  primary: '#d2bbff'
  on-primary: '#3f008e'
  primary-container: '#7c3aed'
  on-primary-container: '#ede0ff'
  inverse-primary: '#732ee4'
  secondary: '#ddb8ff'
  on-secondary: '#490081'
  secondary-container: '#62259b'
  on-secondary-container: '#d1a1ff'
  tertiary: '#3cddc7'
  on-tertiary: '#003731'
  tertiary-container: '#007467'
  on-tertiary-container: '#66fde7'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5a00c6'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#ddb8ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#62259b'
  tertiary-fixed: '#62fae3'
  tertiary-fixed-dim: '#3cddc7'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005047'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-padding: 20px
  element-gap: 12px
  section-margin: 32px
  glass-blur: 20px
---

## 品牌与风格

本设计系统旨在为移动端 AI 图像生成工具打造一个极具未来感且精致的视觉环境。核心概念是“有质感的磨砂玻璃”，通过模拟物理世界的半透明材质，在虚拟界面中构建深度的层次感。

### 视觉特征
- **风格定位**：极简主义、玻璃拟态 (Glassmorphism)、高端感。
- **情感表达**：激发创意、通透灵动、专业且易于操作。
- **设计手法**：大量使用背景模糊 (Backdrop Blur)、极细的半透明描边以及柔和的扩散阴影，使界面呈现出一种悬浮在多彩云端之上的视觉效果。

## 色彩

色彩方案以深色模式为基调，利用强烈的色彩对比突出“玻璃”质感。

- **品牌主色 (Primary)**：采用高饱和度的靛紫色 (#7C3AED)，用于核心交互、生成按钮及重点强调。
- **辅助色 (Secondary/Tertiary)**：使用淡紫色与青绿色，用于区分功能模块及艺术风格标签。
- **中性色 (Neutral)**：底色采用深邃的蓝黑色 (#0F172A)，为玻璃卡片提供厚重的背景深度。
- **功能色**：
  - 成功 (Success)：翠绿色，用于下载完成。
  - 信息 (Info)：天蓝色，用于系统提示。
  - 警告 (Warning/Error)：珊瑚色，用于错误反馈。

## 字体排印

选择 **Inter** 作为核心字体，结合移动端系统字体（如 PingFang SC），确保跨平台的极简美感与极高的可读性。

- **标题层级**：使用较大的字号与加粗字重，增加字间距以提升现代感。
- **正文层级**：保持简洁，通过字色深浅（如 80% 白与 60% 白）区分信息主次。
- **标签设计**：Label 级别字体采用全大写或适当增加字间距，赋予界面一种“技术手册”般的精确感。

## 布局与间距

采用**流式网格系统**，针对移动端图像展示进行优化。

- **安全边距**：界面两侧统一保持 20px 的内边距。
- **间距节奏**：以 4px 为基础倍数（4, 8, 12, 16, 24, 32）。
- **内容流**：由于使用了玻璃卡片，元素间的间距应比传统 UI 稍大，以避免视觉重叠导致的混乱感。
- **适配方案**：在折叠屏或大屏设备上，卡片采用多列布局，但玻璃的模糊半径保持恒定，以维持材质一致性。

## 高程与深度

通过材质堆叠而非简单的阴影来体现层级。

- **玻璃层 (Glass Layer)**：基础背景上方的卡片使用 `rgba(255, 255, 255, 0.05)` 的填充，并叠加 `backdrop-filter: blur(20px)`。
- **描边 (Stroke)**：所有玻璃容器必须带有 `1px` 的半透明白色描边（顶部亮度略高于底部），模拟光的折射。
- **阴影 (Shadow)**：使用大半径、低透明度的深色阴影 `rgba(0, 0, 0, 0.3)`，增强卡片与背景的悬浮感。
- **叠加态**：当一个玻璃层覆盖在另一个之上时，增加模糊度而非降低透明度。

## 形状

形状设计遵循现代、柔和但不失结构感的原则。

- **外圆角**：卡片和容器统一使用 `16px` (rounded-lg) 的圆角，营造亲和力。
- **内圆角**：卡片内部的图片或按钮圆角应略小（如 `12px`），以符合嵌套几何比例。
- **微元素**：输入框和小型标签使用 `8px` 圆角。

## 组件

### 按钮 (Buttons)
- **主按钮 (Generate)**：采用从靛紫到亮紫的线性渐变，带有微弱的同色外发光 (Glow) 效果。
- **次级按钮**：全透明背景，仅保留 1px 磨砂描边，文字为白色。

### 玻璃卡片 (Glass Cards)
- 用于包含图像生成参数、历史记录和个人信息。卡片边缘需有细腻的渐变描边。

### 输入组件 (Input Fields)
- 文本输入框背景使用更深一层的半透明色，获得焦点时描边颜色变为品牌主色。

### 风格切换器 (Chips)
- 选中态：背景变为半透明白色，文字反色。
- 未选中态：仅保留模糊效果和极细描边。

### 底部导航栏 (Bottom Bar)
- 采用全屏宽度的玻璃化设计，背景模糊度增加至 40px，使其在滑动内容上方呈现出一种朦胧的过渡感。

### 提示组件 (Modals)
- 弹出层应占据屏幕中央，背景遮罩使用深色半透明（Overlay），弹窗本身使用最高等级的玻璃质感。