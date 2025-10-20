import httpInstance from '../utils/http';

// 认证相关API
export const authAPI = {
  // 钱包登录
  login: (data) => httpInstance.post('/auth/login', data),

  // 验证token
  verify: () => httpInstance.get('/auth/verify'),

  // 登出
  logout: () => httpInstance.post('/auth/logout'),
};

// 智能账户相关API
export const smartAccountAPI = {
  // 创建智能账户
  createSmartAccount: (data) => httpInstance.post('/smart-account/create', data),

  // 获取智能账户信息
  getSmartAccount: (address) => httpInstance.get(`/smart-account/${address}`),

  // 添加守护者
  addGuardian: (data) => httpInstance.post('/smart-account/add-guardian', data),

  // 移除守护者
  removeGuardian: (data) => httpInstance.post('/smart-account/remove-guardian', data),

  // 发起恢复
  initiateRecovery: (data) => httpInstance.post('/smart-account/initiate-recovery', data),

  // 执行批量交易
  executeBatchTransaction: (data) => httpInstance.post('/smart-account/batch-transaction', data),

  // 获取用户的智能账户列表
  getUserSmartAccounts: () => httpInstance.get('/smart-account/user-accounts'),
};

// 健康检查
export const healthAPI = {
  check: () => httpInstance.get('/health'),
};

export default httpInstance;