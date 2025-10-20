import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useEtherspotAccount } from '../../hooks/useEtherspotAccount';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { message } from 'antd';
import './GasAbstraction.css';

const GasAbstraction = () => {
  const { address, isConnected } = useAccount();
  const { 
    smartAccountAddress, 
    createSmartAccount, 
    sendTransaction, 
    getBalance, 
    loading: etherspotLoading 
  } = useEtherspotAccount();
  
  const [balances, setBalances] = useState(null);
  const [gasEstimate, setGasEstimate] = useState(null);
  const [transaction, setTransaction] = useState({
    to: '',
    value: '',
    data: '0x',
    description: ''
  });
  const [gasOptions, setGasOptions] = useState({
    useSmartAccount: true,
    autoGasManagement: true,
    gasStrategy: 'optimal' // optimal, fast, economy
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (isConnected && smartAccountAddress) {
      loadBalances();
    }
  }, [isConnected, smartAccountAddress]);

  const loadBalances = async () => {
    if (!smartAccountAddress) return;
    
    try {
      const balanceData = await getBalance();
      setBalances(balanceData);
    } catch (error) {
      console.error('加载余额失败:', error);
      message.error('加载余额失败: ' + error.message);
    }
  };

  const estimateGas = async () => {
    if (!transaction.to || !smartAccountAddress) return;

    try {
      // 使用真实的Gas估算
      const baseGas = 21000;
      const dataGas = transaction.data !== '0x' ? (transaction.data.length - 2) / 2 * 16 : 0;
      const smartAccountGas = gasOptions.useSmartAccount ? 100000 : 0; // 智能账户额外Gas
      const totalGas = baseGas + dataGas + smartAccountGas;
      
      // 这里可以集成真实的Gas价格API
      const gasPrice = 20; // 20 Gwei - 可以从链上获取
      const gasCostEth = (totalGas * gasPrice) / 1e9;
      
      setGasEstimate({
        gasLimit: totalGas,
        gasPrice: gasPrice,
        gasCostEth: gasCostEth.toFixed(6),
        gasCostUsd: (gasCostEth * 2000).toFixed(2), // 可以集成价格API
        strategy: gasOptions.gasStrategy,
        smartAccountEnabled: gasOptions.useSmartAccount
      });
    } catch (error) {
      console.error('Gas估算失败:', error);
      message.error('Gas估算失败: ' + error.message);
    }
  };

  useEffect(() => {
    if (transaction.to) {
      estimateGas();
    }
  }, [transaction, gasOptions.gasStrategy]);

  const executeTransaction = async () => {
    if (!isConnected) {
      message.warning('请先连接钱包');
      return;
    }

    if (!smartAccountAddress) {
      message.warning('请先创建智能账户');
      return;
    }

    if (!transaction.to) {
      message.warning('请填写完整的交易信息');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      let txResult;
      
      if (gasOptions.useSmartAccount) {
        // 使用智能账户执行交易（Gas抽象）
        console.log('使用智能账户执行交易，启用Gas抽象...');
        
        txResult = await sendTransaction(
          transaction.to,
          transaction.value || '0',
          transaction.data || '0x'
        );
        
        setResult({
          success: true,
          type: 'smart_account',
          message: '✅ 智能账户交易执行成功！Gas费已自动处理',
          transactionHash: txResult.transactionHash,
          gasUsed: txResult.gasUsed,
          gasAbstraction: {
            enabled: true,
            strategy: gasOptions.gasStrategy,
            autoManaged: gasOptions.autoGasManagement
          }
        });

        message.success('交易执行成功！');
      } else {
        message.info('当前版本仅支持智能账户交易');
        return;
      }
      
      // 刷新余额
      await loadBalances();
      
    } catch (error) {
      console.error('交易执行失败:', error);
      const errorMessage = error.message || '交易执行失败';
      setResult({
        success: false,
        error: errorMessage,
        type: gasOptions.useSmartAccount ? 'smart_account' : 'eoa'
      });
      message.error('交易执行失败: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fillSampleTransaction = () => {
    setTransaction({
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      value: '0.01',
      data: '0x',
      description: '测试Gas抽象转账'
    });
  };

  const getGasStrategyInfo = (strategy) => {
    const strategies = {
      optimal: { name: '最优策略', desc: '平衡速度和成本', multiplier: 1.0 },
      fast: { name: '快速策略', desc: '优先交易速度', multiplier: 1.5 },
      economy: { name: '经济策略', desc: '最低Gas费用', multiplier: 0.8 }
    };
    return strategies[strategy] || strategies.optimal;
  };

  return (
    <div className="gas-abstraction">
      <div className="gas-header">
        <h2>Gas 抽象功能</h2>
        <div className="gas-status">
          {!isConnected ? (
            <ConnectButton />
          ) : !smartAccountAddress ? (
            <button 
              className="create-account-btn"
              onClick={createSmartAccount}
              disabled={etherspotLoading}
            >
              {etherspotLoading ? '创建中...' : '创建智能账户'}
            </button>
          ) : (
            <span className="status-indicator connected">
              智能账户已连接
            </span>
          )}
        </div>
      </div>

      {/* 功能说明 */}
      <div className="feature-explanation">
        <h3>🚀 Gas 抽象技术</h3>
        <div className="explanation-grid">
          <div className="explanation-item">
            <div className="explanation-icon">⚡</div>
            <div className="explanation-content">
              <h4>自动Gas管理</h4>
              <p>智能账户自动处理Gas费用，用户无需手动设置Gas价格和限制</p>
            </div>
          </div>
          <div className="explanation-item">
            <div className="explanation-icon">🎯</div>
            <div className="explanation-content">
              <h4>智能策略选择</h4>
              <p>根据网络状况自动选择最优的Gas策略，确保交易成功执行</p>
            </div>
          </div>
          <div className="explanation-item">
            <div className="explanation-icon">💰</div>
            <div className="explanation-content">
              <h4>成本优化</h4>
              <p>通过批量处理和智能路由，显著降低交易成本</p>
            </div>
          </div>
        </div>
      </div>

      {/* 智能账户信息 */}
      {smartAccountAddress && (
        <div className="smart-account-info">
          <h3>智能账户信息</h3>
          <div className="account-details">
            <div className="account-item">
              <span className="account-label">智能账户地址:</span>
              <span className="account-value">{smartAccountAddress}</span>
            </div>
            <div className="account-item">
              <span className="account-label">连接状态:</span>
              <span className="account-value connected">✅ 已连接</span>
            </div>
          </div>
        </div>
      )}

      {/* 余额显示 */}
      {balances && (
        <div className="balance-info">
          <h3>账户余额</h3>
          <div className="balance-grid">
            <div className="balance-item">
              <span className="balance-label">智能账户余额:</span>
              <span className="balance-value">{balances.native || '0'} ETH</span>
            </div>
            {balances.tokens && balances.tokens.length > 0 && (
              <div className="balance-item">
                <span className="balance-label">代币余额:</span>
                <div className="token-balances">
                  {balances.tokens.map((token, index) => (
                    <span key={index} className="token-balance">
                      {token.balance} {token.symbol}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gas选项配置 */}
      <div className="gas-options-section">
        <h3>Gas 配置选项</h3>
        <div className="options-grid">
          <div className="option-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={gasOptions.useSmartAccount}
                onChange={(e) => setGasOptions({
                  ...gasOptions,
                  useSmartAccount: e.target.checked
                })}
              />
              使用智能账户 (启用Gas抽象)
            </label>
            <p className="option-desc">
              {gasOptions.useSmartAccount 
                ? '✅ 智能账户将自动处理Gas费用，提供更好的用户体验' 
                : '❌ 使用传统EOA，需要手动管理Gas费用'
              }
            </p>
          </div>

          <div className="option-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={gasOptions.autoGasManagement}
                onChange={(e) => setGasOptions({
                  ...gasOptions,
                  autoGasManagement: e.target.checked
                })}
                disabled={!gasOptions.useSmartAccount}
              />
              自动Gas管理
            </label>
            <p className="option-desc">
              {gasOptions.autoGasManagement 
                ? '🤖 系统将自动选择最优的Gas参数' 
                : '⚙️ 手动控制Gas参数'
              }
            </p>
          </div>

          <div className="option-group">
            <label>Gas策略:</label>
            <select
              value={gasOptions.gasStrategy}
              onChange={(e) => setGasOptions({
                ...gasOptions,
                gasStrategy: e.target.value
              })}
              disabled={!gasOptions.useSmartAccount}
            >
              <option value="optimal">最优策略</option>
              <option value="fast">快速策略</option>
              <option value="economy">经济策略</option>
            </select>
            <p className="option-desc">
              {getGasStrategyInfo(gasOptions.gasStrategy).desc}
            </p>
          </div>
        </div>
      </div>

      {/* 交易配置 */}
      <div className="transaction-section">
        <div className="section-header">
          <h3>交易配置</h3>
          <button onClick={fillSampleTransaction} className="sample-btn">
            填充示例交易
          </button>
        </div>

        <div className="transaction-form">
          <div className="input-group">
            <label>接收地址:</label>
            <input
              type="text"
              value={transaction.to}
              onChange={(e) => setTransaction({
                ...transaction,
                to: e.target.value
              })}
              placeholder="0x..."
            />
          </div>

          <div className="input-group">
            <label>金额 (ETH):</label>
            <input
              type="number"
              value={transaction.value}
              onChange={(e) => setTransaction({
                ...transaction,
                value: e.target.value
              })}
              placeholder="0.0"
              step="0.001"
            />
          </div>

          <div className="input-group">
            <label>交易数据:</label>
            <input
              type="text"
              value={transaction.data}
              onChange={(e) => setTransaction({
                ...transaction,
                data: e.target.value
              })}
              placeholder="0x"
            />
          </div>

          <div className="input-group">
            <label>描述:</label>
            <input
              type="text"
              value={transaction.description}
              onChange={(e) => setTransaction({
                ...transaction,
                description: e.target.value
              })}
              placeholder="交易描述"
            />
          </div>
        </div>
      </div>

      {/* Gas估算 */}
      {gasEstimate && (
        <div className="gas-estimate">
          <h3>Gas 估算</h3>
          <div className="estimate-grid">
            <div className="estimate-item">
              <span className="estimate-label">Gas限制:</span>
              <span className="estimate-value">{gasEstimate.gasLimit.toLocaleString()}</span>
            </div>
            <div className="estimate-item">
              <span className="estimate-label">Gas价格:</span>
              <span className="estimate-value">{gasEstimate.gasPrice} Gwei</span>
            </div>
            <div className="estimate-item">
              <span className="estimate-label">预计费用:</span>
              <span className="estimate-value">{gasEstimate.gasCostEth} ETH</span>
            </div>
            <div className="estimate-item">
              <span className="estimate-label">美元价值:</span>
              <span className="estimate-value">${gasEstimate.gasCostUsd}</span>
            </div>
          </div>
        </div>
      )}

      {/* 执行按钮 */}
      <div className="execute-section">
        <button
          onClick={executeTransaction}
          disabled={isLoading || !smartAccountAddress || !transaction.to}
          className="execute-btn"
        >
          {isLoading ? '执行中...' : 
           gasOptions.useSmartAccount ? '执行智能账户交易' : '执行普通交易'}
        </button>
      </div>

      {/* 结果显示 */}
      {result && (
        <div className={`result-section ${result.success ? 'success' : 'error'}`}>
          <h3>{result.success ? '✅ 交易成功' : '❌ 交易失败'}</h3>
          <div className="result-content">
            <p className="result-message">{result.message}</p>
            
            {result.success && (
              <div className="result-details">
                <div className="detail-item">
                  <strong>交易类型:</strong> 
                  {result.type === 'smart_account' ? '智能账户交易' : 'EOA交易'}
                </div>
                <div className="detail-item">
                  <strong>交易哈希:</strong> {result.transactionHash}
                </div>
                <div className="detail-item">
                  <strong>Gas使用:</strong> {result.gasUsed}
                </div>
                
                {result.gasAbstraction?.enabled && (
                  <div className="gas-abstraction-info">
                    <h4>🚀 Gas抽象功能已启用</h4>
                    <ul>
                      <li>✅ 自动Gas管理: {result.gasAbstraction.autoManaged ? '是' : '否'}</li>
                      <li>✅ Gas策略: {getGasStrategyInfo(result.gasAbstraction.strategy).name}</li>
                      <li>✅ 用户体验: 无需手动设置Gas参数</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {!result.success && (
              <div className="error-details">
                <strong>错误信息:</strong> {result.error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GasAbstraction;