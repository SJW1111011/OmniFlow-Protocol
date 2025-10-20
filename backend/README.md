# OmniFlow Protocol Backend API

基于ERC-4337的智能账户管理后端服务

## 功能特性

- 🔐 钱包连接认证
- 🏦 智能账户创建和管理
- 👥 社交恢复（守护者管理）
- 📦 批量交易执行
- 💰 Gas费抽象
- 🛡️ API限流保护
- 📊 完整的错误处理

## 技术栈

- **Node.js** - 运行时环境
- **Express.js** - Web框架
- **Ethers.js** - 以太坊交互
- **JWT** - 身份认证
- **bcryptjs** - 密码加密

## 项目结构

```
backend/
├── server.js              # 服务器入口文件
├── routes/                # 路由定义
│   ├── auth.js           # 认证相关路由
│   └── smartAccount.js   # 智能账户路由
├── services/             # 业务服务层
│   └── contractService.js # 智能合约服务
├── utils/                # 工具函数
│   ├── responseHelper.js # API响应辅助
│   └── validator.js      # 参数验证
├── middleware/           # 中间件
│   └── rateLimiter.js    # API限流
├── .env                  # 环境变量配置
└── package.json          # 项目配置
```

## 环境配置

复制 `.env` 文件并配置以下环境变量：

```env
# 服务器配置
PORT=3001
NODE_ENV=development

# 前端地址
FRONTEND_URL=http://localhost:3000

# JWT密钥
JWT_SECRET=your-super-secret-jwt-key

# 区块链网络配置
RPC_URL=http://localhost:8545
CHAIN_ID=31337

# 智能合约地址
SMART_ACCOUNT_FACTORY_ADDRESS=0x...
```

## 安装和运行

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

### 生产模式运行

```bash
npm start
```

## API接口文档

### 认证相关

#### 获取登录消息
```http
POST /api/auth/get-login-message
Content-Type: application/json

{
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96c4b4d4d4"
}
```

#### 钱包登录
```http
POST /api/auth/wallet-login
Content-Type: application/json

{
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96c4b4d4d4",
  "signature": "0x...",
  "message": "欢迎使用 OmniFlow Protocol!..."
}
```

#### 获取用户信息
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

### 智能账户相关

#### 创建智能账户
```http
POST /api/smart-account/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "guardians": ["0x...", "0x..."],
  "privateKey": "0x..."
}
```

#### 获取智能账户信息
```http
GET /api/smart-account/info/:address
Authorization: Bearer <token>
```

#### 获取用户的智能账户
```http
GET /api/smart-account/my-account
Authorization: Bearer <token>
```

#### 添加守护者
```http
POST /api/smart-account/add-guardian
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountAddress": "0x...",
  "guardianAddress": "0x...",
  "privateKey": "0x..."
}
```

#### 移除守护者
```http
POST /api/smart-account/remove-guardian
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountAddress": "0x...",
  "guardianAddress": "0x...",
  "privateKey": "0x..."
}
```

#### 发起账户恢复
```http
POST /api/smart-account/initiate-recovery
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountAddress": "0x...",
  "newOwner": "0x...",
  "privateKey": "0x..."
}
```

#### 执行批量交易
```http
POST /api/smart-account/execute-batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountAddress": "0x...",
  "transactions": [
    {
      "target": "0x...",
      "value": "0",
      "data": "0x..."
    }
  ],
  "privateKey": "0x..."
}
```

## 响应格式

### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "data": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 错误响应
```json
{
  "success": false,
  "message": "错误信息",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 验证错误响应
```json
{
  "success": false,
  "message": "参数验证失败",
  "errors": ["具体错误信息"],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 错误代码

- `400` - 请求参数错误
- `401` - 未授权访问
- `403` - 禁止访问
- `404` - 资源未找到
- `409` - 资源冲突
- `429` - 请求过于频繁
- `500` - 服务器内部错误

## 安全特性

### API限流
- 严格限制：15分钟内最多5次请求（敏感操作）
- 中等限制：15分钟内最多100次请求（一般操作）
- 宽松限制：15分钟内最多1000次请求（查询操作）

### 身份认证
- JWT Token认证
- 以太坊签名验证
- 自动Token过期处理

### 参数验证
- 地址格式验证
- 私钥格式验证
- 交易数据验证
- 守护者列表验证

## 开发指南

### 添加新的API端点

1. 在 `routes/` 目录下创建或修改路由文件
2. 使用 `ResponseHelper` 统一响应格式
3. 使用 `Validator` 进行参数验证
4. 添加适当的限流保护

### 错误处理

使用 `ResponseHelper` 类的静态方法：

```javascript
const ResponseHelper = require('../utils/responseHelper');

// 成功响应
ResponseHelper.success(res, data, '操作成功');

// 错误响应
ResponseHelper.error(res, '错误信息', 500);

// 验证错误
ResponseHelper.validationError(res, '验证失败', errors);
```

### 参数验证

使用 `Validator` 类创建验证中间件：

```javascript
const Validator = require('../utils/validator');

const validationSchema = {
  address: {
    required: true,
    type: 'address'
  },
  amount: {
    required: true,
    type: 'number',
    options: { min: 0 }
  }
};

router.post('/endpoint', 
  Validator.createValidationMiddleware(validationSchema),
  handler
);
```

## 部署说明

### 环境要求
- Node.js 16+
- 以太坊节点（本地或远程）
- 已部署的智能合约

### 部署步骤
1. 克隆项目代码
2. 安装依赖：`npm install`
3. 配置环境变量
4. 启动服务：`npm start`

## 许可证

MIT License