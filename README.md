# 客户管理与SKU价格管理系统

PWA 客户订单管理系统，支持开单、SKU价格管理、PDF打印输出，一键部署到 Vercel。

## 功能特性

- **SKU 价格管理**: 左侧SKU列表，按字母滑动检索，支持新增SKU
- **客户管理**: 搜索/新建客户，每个客户独立价格
- **开单**: 从SKU列表点击添加商品，自动关联客户价格
- **价格记忆**: 老客户手动输入的价格自动保存，下次开单使用新价格
- **SKU成本价**: 作为独立成本参考，除非手动修改否则不变
- **公章上传**: 自定义上传公章图片嵌入PDF
- **PDF打印**: 标准销售单格式，包含中文大写金额
- **PWA**: 可安装到桌面，离线缓存支持
- **云端保存**: 所有数据通过 Vercel Postgres 保存

## 部署到 Vercel

### 1. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 2. 创建 Vercel Postgres 数据库

在 Vercel 项目 Dashboard > Storage > Postgres 创建数据库，获取连接字符串。

### 3. 设置环境变量

在 Vercel 项目设置中添加环境变量：
- `POSTGRES_URL`: 你的 Postgres 连接字符串

### 4. 推送数据库 Schema

```bash
npx drizzle-kit push
```

### 5. 部署

```bash
vercel
```

## 本地开发

```bash
# 安装依赖
npm install

# 设置数据库连接
cp .env.local.example .env.local
# 编辑 .env.local 填入 POSTGRES_URL

# 推送数据库
npx drizzle-kit push

# 启动开发服务器
npm run dev
```

## 技术栈

- Next.js 16 + TypeScript
- Tailwind CSS v4
- Drizzle ORM + Vercel Postgres
- jsPDF (客户端PDF生成)
- PWA (Service Worker + Manifest)
