import express, { Router } from 'express';
import { logger } from '../utils/logger';
import { bridgeRateLimiter } from '../middleware/rateLimiter';
import { RealCrossChainService } from '../services/RealCrossChainService';
import { multiProtocolAggregator } from '../services/MultiProtocolAggregator';
import { contractBackendBridge } from '../services/ContractBackendBridge';

const router: Router = express.Router();
const realCrossChainService = new RealCrossChainService();

/**
 * 🆕 获取适合合约执行的最优路由（推荐使用）
 * 
 * 这是后端MultiProtocolAggregator和合约的桥梁！
 * 
 * 工作流程：
 * 1. 后端调用Li.Fi/Across真实API
 * 2. AI安全分析和路由选择
 * 3. 生成合约调用参数
 * 4. 前端展示并让用户签名
 * 5. 合约执行真实跨链
 */
router.post('/optimal-route-for-contract', async (req, res) => {
  try {
    const { fromChain, toChain, fromToken, toToken, amount, userAddress, preferences } = req.body;

    logger.info('🌉 后端+合约协同：获取最优路由');
    logger.info(`   参数: ${fromChain} → ${toChain}, ${amount} ${fromToken}`);

    // 验证参数
    if (!fromChain || !toChain || !fromToken || !toToken || !amount || !userAddress) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数: fromChain, toChain, fromToken, toToken, amount, userAddress'
      });
      return;
    }

    // 调用桥接服务 - 这会调用MultiProtocolAggregator
    const executionData = await contractBackendBridge.getOptimalRouteForContract({
      fromChain: parseInt(fromChain),
      toChain: parseInt(toChain),
      fromToken,
      toToken,
      amount,
      userAddress,
      preferences
    });

    logger.info('✅ 后端AI分析完成，合约调用参数已生成');
    logger.info(`   选定协议: ${executionData.analysis.protocol}`);
    logger.info(`   安全评分: ${executionData.analysis.securityScore}/100`);
    logger.info(`   预估费用: $${executionData.analysis.totalFees}`);
    logger.info(`   预估时间: ${executionData.analysis.estimatedTime}秒`);

    res.json({
      success: true,
      data: executionData,
      message: '✅ 后端已完成AI分析和路由选择，返回合约调用参数',
      usage: {
        description: '前端使用contractCallData直接调用合约',
        example: `contract.executeBackendRoute(...contractCallData.parameters)`
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('❌ 生成合约执行数据失败:', error.message);
    logger.error('   详细错误:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || '生成合约执行数据失败',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        raw: error
      } : undefined
    });
  }
});

/**
 * 🆕 使用AI聚合器获取多协议路由（可选，简化版）
 */
router.get('/aggregated-routes', async (req, res) => {
  try {
    const { fromChain, toChain, fromToken, toToken, amount, userAddress, preferences } = req.query;

    logger.info('🤖 多协议AI聚合请求:', { fromChain, toChain, fromToken, amount });

    // 解析 preferences 参数（如果是字符串则解析为JSON，否则直接使用）
    let parsedPreferences: any = undefined;
    if (preferences) {
      try {
        parsedPreferences = typeof preferences === 'string' ? JSON.parse(preferences) : preferences;
      } catch {
        logger.warn('⚠️ preferences 参数解析失败，使用默认值');
      }
    }

    // 调用MultiProtocolAggregator - 100%真实
    const routes = await multiProtocolAggregator.getAggregatedRoutes({
      fromChain: parseInt(fromChain as string),
      toChain: parseInt(toChain as string),
      fromToken: fromToken as string,
      toToken: toToken as string,
      amount: amount as string,
      userAddress: userAddress as string,
      preferences: parsedPreferences
    });

    logger.info(`✅ AI聚合器返回 ${routes.length} 个策略`);
    routes.forEach((route, i) => {
      logger.info(`   ${i + 1}. ${route.description}`);
      logger.info(`      安全: ${route.securityScore}, 费用: $${route.totalFees}, 时间: ${route.estimatedTime}s`);
    });

    res.json({
      success: true,
      data: routes,
      count: routes.length,
      source: '基于Li.Fi和Across真实API + AI安全分析',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('❌ AI聚合器失败:', error.message);
    logger.error('   详细:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 获取真实的Aave APY（通过合约从链上查询）
 */
router.get('/real-apy', async (req, res) => {
  try {
    const { contractAddress, chainId, asset, rpcUrl } = req.query;

    logger.info('📊 查询真实链上APY:', { chainId, asset });

    if (!contractAddress || !chainId || !asset || !rpcUrl) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数: contractAddress, chainId, asset, rpcUrl'
      });
      return;
    }

    // 通过合约查询，合约从Aave链上读取
    const apyData = await contractBackendBridge.queryRealAPYFromContract(
      contractAddress as string,
      parseInt(chainId as string),
      asset as string,
      rpcUrl as string
    );

    logger.info(`✅ 真实APY: ${apyData.apy}% (链上数据)`);

    res.json({
      success: true,
      data: apyData,
      source: 'on-chain-via-smart-contract',
      message: '数据从Aave合约实时读取',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('❌ 查询真实APY失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 监控合约执行状态
 */
router.get('/contract-status/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    const { chainId, rpcUrl } = req.query;

    logger.info('🔍 监控合约执行:', { txHash, chainId });

    if (!chainId || !rpcUrl) {
      res.status(400).json({
        success: false,
        error: '缺少chainId或rpcUrl参数'
      });
      return;
    }

    // 监控合约执行状态
    const status = await contractBackendBridge.monitorContractExecution(
      txHash,
      parseInt(chainId as string),
      rpcUrl as string
    );

    logger.info(`📈 合约执行状态: ${status.status}`);

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('❌ 监控合约执行失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取跨链路由（原有接口，保持兼容）
 */
router.get('/routes', async (req, res) => {
  try {
    const { sourceChain, destinationChain, token, amount } = req.query;
    
    logger.info('获取跨链路由请求:', { sourceChain, destinationChain, token, amount });

    if (!sourceChain || !destinationChain || !token || !amount) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
      return;
    }

    // 获取真实路由
    const routes = await realCrossChainService.getRealCrossChainRoutes(
      parseInt(sourceChain as string),
      parseInt(destinationChain as string),
      token as string,
      token as string,
      amount as string,
      req.query.userAddress as string || '0x0000000000000000000000000000000000000000'
    );

    res.json({
      success: true,
      data: routes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取跨链路由失败:', error);
    res.status(500).json({
      success: false,
      error: '获取跨链路由失败'
    });
  }
});

/**
 * 执行跨链转账（原有接口，保持兼容）
 */
router.post('/transfer', bridgeRateLimiter, async (req, res) => {
  try {
    const { sourceChain, destinationChain, token, amount, recipient } = req.body;
    
    logger.info('跨链转账请求:', { sourceChain, destinationChain, token, amount, recipient });

    if (!sourceChain || !destinationChain || !token || !amount || !recipient) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
      return;
    }

    const result = await realCrossChainService.prepareCrossChainTransaction(
      sourceChain,
      destinationChain,
      token,
      token,
      amount,
      recipient
    );

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('跨链转账失败:', error);
    res.status(500).json({
      success: false,
      error: '跨链转账失败'
    });
  }
});

/**
 * 查询交易状态（原有接口）
 */
router.get('/status/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    
    logger.info('查询交易状态请求:', { txHash });

    const status = await realCrossChainService.monitorRealTransaction(txHash, 'unknown');

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('查询交易状态失败:', error);
    res.status(500).json({
      success: false,
      error: '查询交易状态失败'
    });
  }
});

export default router;
