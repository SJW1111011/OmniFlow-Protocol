import React, { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';
import { useEtherspotAccount } from '../../hooks/useEtherspotAccount';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { message } from 'antd';
import './PaymasterDemo.css';

const PaymasterDemo = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { 
    smartAccountAddress, 
    createSmartAccount, 
    sendTransaction, 
    getBalance, 
    loading: etherspotLoading 
  } = useEtherspotAccount();
  
  const [balances, setBalances] = useState(null);
  const [paymasterConfig, setPaymasterConfig] = useState({
    enabled: true,
    tokenAddress: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9', // 默认使用MockERC20地址
    tokenSymbol: 'USDC',
    exchangeRate: 3500, // 1 ETH = 3500 USDC (更接近真实汇率)
    sponsorMode: 'token' // token, sponsor, hybrid
  });
  const [transaction, setTransaction] = useState({
    to: '',
    value: '',
    data: '0x',
    description: ''
  });
  const [gasEstimate, setGasEstimate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');

  useEffect(() => {
    if (isConnected && smartAccountAddress) {
      loadBalances();
    }
  }, [isConnected, smartAccountAddress]);

  const loadBalances = async () => {
    if (!smartAccountAddress) return;
    
    try {
      // 传递代币地址以获取完整的余额信息
      const tokenAddress = paymasterConfig.tokenAddress || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'; // 使用默认的MockERC20地址
      const balanceData = await getBalance(tokenAddress);
      setBalances(balanceData);
    } catch (error) {
      console.error('加载余额失败:', error);
      message.error('加载余额失败: ' + error.message);
    }
  };

  const calculateGasInTokens = (gasCostEth) => {
    return (parseFloat(gasCostEth) * paymasterConfig.exchangeRate).toFixed(2);
  };

  const estimateGas = async () => {
    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }

    if (!smartAccountAddress) {
      message.error('请先创建智能账户');
      return;
    }

    if (!transaction.to || !transaction.value) {
      message.error('请填写完整的交易信息');
      return;
    }

    setIsLoading(true);
    try {
      const txData = {
        to: transaction.to,
        value: transaction.value,
        data: transaction.data || '0x'
      };

      // 估算普通交易的 Gas（通过智能账户）
      const normalGas = {
        gasLimit: '21000',
        gasPrice: '15000000000', // 15 gwei (更合理的Gas价格)
        totalCost: '0.000315' // 21000 * 15 gwei = 0.000315 ETH
      };
      
      // 估算使用 Paymaster 的 Gas（模拟节省）
      const paymasterGas = {
        gasLimit: '25000', // 稍高因为需要额外的 paymaster 逻辑
        gasPrice: '0', // 用户不需要支付 ETH
        tokenCost: calculateGasInTokens(normalGas.totalCost), // 使用正确的Gas成本计算代币费用
        totalCost: '0' // 用户不支付 ETH
      };

      setGasEstimate({
        normal: normalGas,
        paymaster: paymasterGas,
        savings: parseFloat(normalGas.totalCost),
        tokenPayment: paymasterGas.tokenCost
      });
    } catch (error) {
      console.error('Gas 估算失败:', error);
      message.error('Gas 估算失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (transaction.to) {
      estimateGas();
    }
  }, [transaction, paymasterConfig]);

  const executeTransaction = async () => {
    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }

    if (!smartAccountAddress) {
      message.error('请先创建智能账户');
      return;
    }

    if (!transaction.to || !transaction.value) {
      message.error('请填写完整的交易信息');
      return;
    }

    // 验证paymaster配置
    if (paymasterConfig.enabled && paymasterConfig.sponsorMode === 'token') {
      if (!paymasterConfig.tokenAddress || paymasterConfig.tokenAddress.trim() === '') {
        message.error('使用代币支付模式时，请填写代币地址');
        return;
      }
      
      // 验证地址格式
      if (!/^0x[a-fA-F0-9]{40}$/.test(paymasterConfig.tokenAddress)) {
        message.error('代币地址格式不正确');
        return;
      }
    }

    setIsLoading(true);
    try {
      const txData = {
        to: transaction.to,
        value: transaction.value,
        data: transaction.data || '0x',
        // 添加 paymaster 配置
        usePaymaster: paymasterConfig.enabled,
        paymasterConfig: paymasterConfig.enabled ? {
          sponsorMode: paymasterConfig.sponsorMode,
          tokenAddress: paymasterConfig.tokenAddress,
          exchangeRate: paymasterConfig.exchangeRate
        } : undefined
      };

      const txResult = await sendTransaction(txData);
      
      setResult({
        success: true,
        transactionHash: txResult.transactionHash || txResult.hash,
        gasUsed: txResult.gasUsed || '25000',
        gasCost: paymasterConfig.enabled ? '0' : '0.00042',
        tokenCost: paymasterConfig.enabled ? 
          (parseFloat(transaction.value) * paymasterConfig.exchangeRate).toString() : '0',
        paymasterUsed: paymasterConfig.enabled,
        sponsorMode: paymasterConfig.sponsorMode,
        blockNumber: txResult.blockNumber,
        timestamp: new Date().toISOString()
      });

      message.success('交易执行成功！');
      
      // 刷新余额
      setTimeout(() => {
        loadBalances();
      }, 2000);
      
    } catch (error) {
      console.error('交易执行失败:', error);
      setResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      message.error('交易执行失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fillSampleTransaction = () => {
    setTransaction({
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      value: '0.01',
      data: '0x',
      description: '测试Paymaster代付Gas费转账'
    });
  };

  const getSponsorModeInfo = (mode) => {
    const modes = {
      token: { 
        name: '代币支付', 
        desc: '使用ERC20代币支付Gas费',
        icon: '🪙'
      },
      sponsor: { 
        name: '赞助模式', 
        desc: '第三方赞助支付Gas费',
        icon: '🎁'
      },
      hybrid: { 
        name: '混合模式', 
        desc: '智能选择最优支付方式',
        icon: '🔄'
      }
    };
    return modes[mode] || modes.token;
  };

  const hasEnoughTokens = () => {
    if (!balances || !gasEstimate) return true;
    // 安全访问balances.token.balance
    const tokenBalance = balances?.token?.balance || '0';
    const gasCostTokens = gasEstimate?.gasCostTokens || '0';
    return parseFloat(tokenBalance) >= parseFloat(gasCostTokens);
  };

  return (
    <div className="paymaster-demo">
      <div className="paymaster-header">
        <h2>Paymaster 代付 Gas 费</h2>
        <div className="paymaster-status">
          {!isConnected ? (
            <ConnectButton />
          ) : !smartAccountAddress ? (
            <div className="smart-account-section">
              <button 
                onClick={createSmartAccount} 
                disabled={etherspotLoading}
                className="create-account-btn"
              >
                {etherspotLoading ? '创建中...' : '创建智能账户'}
              </button>
            </div>
          ) : (
            <div className="account-info">
              <span className="status-indicator connected">已连接</span>
              <div className="address-info">
                <span>钱包: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <span>智能账户: {smartAccountAddress?.slice(0, 6)}...{smartAccountAddress?.slice(-4)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 功能说明 */}
      <div className="feature-explanation">
        <h3>💰 Paymaster 技术</h3>
        <div className="explanation-grid">
          <div className="explanation-item">
            <div className="explanation-icon">🪙</div>
            <div className="explanation-content">
              <h4>代币支付Gas</h4>
              <p>使用ERC20代币代替ETH支付交易Gas费，提升用户体验</p>
            </div>
          </div>
          <div className="explanation-item">
            <div className="explanation-icon">🎁</div>
            <div className="explanation-content">
              <h4>赞助交易</h4>
              <p>第三方可以赞助用户的交易费用，实现真正的免费交易</p>
            </div>
          </div>
          <div className="explanation-item">
            <div className="explanation-icon">🔄</div>
            <div className="explanation-content">
              <h4>灵活配置</h4>
              <p>支持多种支付模式，可根据场景灵活选择最优方案</p>
            </div>
          </div>
        </div>
      </div>

      {/* 余额显示 */}
      {balances && smartAccountAddress && (
        <div className="balance-info">
          <h3>账户余额</h3>
          <div className="balance-grid">
            <div className="balance-item">
              <span className="balance-label">智能账户余额:</span>
              <span className="balance-value">{parseFloat(balances.nativeBalance || 0).toFixed(6)} ETH</span>
            </div>
            {balances.tokenBalance && parseFloat(balances.tokenBalance) > 0 && (
              <div className="balance-item">
                <span className="balance-label">代币余额:</span>
                <span className="balance-value">{parseFloat(balances.tokenBalance || 0).toFixed(4)} {paymasterConfig.tokenSymbol}</span>
              </div>
            )}
          </div>
          
          {/* 智能账户部署状态 */}
          {parseFloat(balances.nativeBalance || 0) === 0 && (
            <div className="deployment-notice">
              <div className="notice-content">
                <h4>⚠️ 智能账户未部署</h4>
                <p>您的智能账户余额为0，这通常意味着账户尚未部署。智能账户需要执行第一笔交易才会被部署到区块链上。</p>
                <div className="deployment-actions">
                  <button 
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        message.info('正在部署智能账户...');
                        const result = await createSmartAccount();
                        if (result) {
                          message.success('智能账户部署成功！');
                          await loadBalances();
                        }
                      } catch (error) {
                        message.error('部署失败: ' + error.message);
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={etherspotLoading || isLoading}
                    className="deploy-btn"
                  >
                    {etherspotLoading || isLoading ? '部署中...' : '立即部署智能账户'}
                  </button>
                  <p className="deploy-hint">
                    💡 提示：部署后您需要向智能账户转入一些ETH才能看到余额
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* 快速转账功能 */}
          {smartAccountAddress && (
            <div className="quick-transfer-section">
              <h4>💰 向智能账户充值</h4>
              <p>从您的EOA钱包向智能账户转入ETH</p>
              <div className="transfer-form">
                <div className="input-group">
                  <label>转账金额 (ETH):</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.1"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!transferAmount || parseFloat(transferAmount) <= 0) {
                      message.error('请输入有效的转账金额');
                      return;
                    }
                    
                    try {
                      setIsLoading(true);
                      message.info('正在发送转账交易...');
                      
                      if (!walletClient) {
                        message.error('钱包客户端未连接');
                        return;
                      }
                      
                      // 发送交易
                      const hash = await walletClient.sendTransaction({
                        to: smartAccountAddress,
                        value: parseEther(transferAmount),
                        account: address
                      });
                      
                      console.log('转账交易已发送，哈希:', hash);
                      message.info(`交易已发送，等待确认... 哈希: ${hash.slice(0, 10)}...`);
                      
                      // 等待交易确认
                      try {
                        // 使用公共RPC等待交易确认
                        const { createPublicClient, http } = await import('viem');
                        const { hardhat } = await import('viem/chains');
                        
                        const publicClient = createPublicClient({
                          chain: hardhat,
                          transport: http('http://127.0.0.1:8545')
                        });
                        
                        message.info('等待交易确认...');
                        const receipt = await publicClient.waitForTransactionReceipt({ 
                          hash,
                          timeout: 60000 // 60秒超时
                        });
                        
                        if (receipt.status === 'success') {
                          message.success(`转账成功！区块: ${receipt.blockNumber}`);
                          console.log('交易确认成功:', receipt);
                          
                          // 交易确认后立即刷新余额
                          await loadBalances();
                          
                          // 再次刷新以确保数据同步
                          setTimeout(async () => {
                            await loadBalances();
                          }, 2000);
                          
                        } else {
                          message.error('交易失败');
                          console.error('交易失败:', receipt);
                        }
                      } catch (confirmError) {
                        console.error('等待交易确认失败:', confirmError);
                        message.warning('交易已发送，但确认状态未知。请稍后手动刷新余额。');
                        
                        // 即使确认失败，也尝试刷新余额
                        setTimeout(async () => {
                          await loadBalances();
                        }, 10000);
                      }
                      
                      setTransferAmount('');
                    } catch (error) {
                      console.error('转账失败:', error);
                      message.error('转账失败: ' + error.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading || !transferAmount}
                  className="transfer-btn"
                >
                  {isLoading ? '转账中...' : '立即转账'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Paymaster配置 */}
      <div className="paymaster-config-section">
        <h3>Paymaster 配置</h3>
        <div className="config-grid">
          <div className="config-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={paymasterConfig.enabled}
                onChange={(e) => setPaymasterConfig({
                  ...paymasterConfig,
                  enabled: e.target.checked
                })}
              />
              启用 Paymaster
            </label>
            <p className="config-desc">
              {paymasterConfig.enabled 
                ? '✅ 将使用代币或赞助方式支付Gas费' 
                : '❌ 使用传统ETH支付Gas费'
              }
            </p>
          </div>

          <div className="config-group">
            <label>支付模式:</label>
            <select
              value={paymasterConfig.sponsorMode}
              onChange={(e) => setPaymasterConfig({
                ...paymasterConfig,
                sponsorMode: e.target.value
              })}
              disabled={!paymasterConfig.enabled}
            >
              <option value="token">代币支付</option>
              <option value="sponsor">赞助模式</option>
              <option value="hybrid">混合模式</option>
            </select>
            <div className="mode-info">
              <span className="mode-icon">{getSponsorModeInfo(paymasterConfig.sponsorMode).icon}</span>
              <span className="mode-desc">{getSponsorModeInfo(paymasterConfig.sponsorMode).desc}</span>
            </div>
          </div>

          <div className="config-group">
            <label>代币地址:</label>
            <input
              type="text"
              value={paymasterConfig.tokenAddress}
              onChange={(e) => setPaymasterConfig({
                ...paymasterConfig,
                tokenAddress: e.target.value
              })}
              placeholder="0x..."
              disabled={!paymasterConfig.enabled || paymasterConfig.sponsorMode === 'sponsor'}
            />
          </div>

          <div className="config-group">
            <label>汇率 (1 ETH = ? {paymasterConfig.tokenSymbol}):</label>
            <input
              type="number"
              value={paymasterConfig.exchangeRate}
              onChange={(e) => setPaymasterConfig({
                ...paymasterConfig,
                exchangeRate: parseFloat(e.target.value) || 1000
              })}
              disabled={!paymasterConfig.enabled || paymasterConfig.sponsorMode === 'sponsor'}
            />
            <p className="config-desc">
              当前汇率: 1 ETH = {paymasterConfig.exchangeRate} {paymasterConfig.tokenSymbol}
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
          <h3>Gas 费用估算</h3>
          <div className="estimate-comparison">
            <div className="estimate-column">
              <h4>💎 传统方式 (ETH)</h4>
              <div className="estimate-details">
                <div className="estimate-item">
                  <span>Gas限制:</span>
                  <span>{gasEstimate?.normal?.gasLimit ? parseInt(gasEstimate.normal.gasLimit).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="estimate-item">
                  <span>Gas价格:</span>
                  <span>{gasEstimate?.normal?.gasPrice ? (parseInt(gasEstimate.normal.gasPrice) / 1e9).toFixed(0) : 'N/A'} Gwei</span>
                </div>
                <div className="estimate-item">
                  <span>费用:</span>
                  <span>{gasEstimate?.normal?.totalCost || 'N/A'} ETH</span>
                </div>
                <div className="estimate-item">
                  <span>美元价值:</span>
                  <span>${gasEstimate?.normal?.totalCost ? (parseFloat(gasEstimate.normal.totalCost) * 2000).toFixed(2) : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="estimate-column paymaster-column">
              <h4>🪙 Paymaster方式 ({paymasterConfig.tokenSymbol})</h4>
              <div className="estimate-details">
                <div className="estimate-item">
                  <span>Gas限制:</span>
                  <span>{gasEstimate?.paymaster?.gasLimit ? parseInt(gasEstimate.paymaster.gasLimit).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="estimate-item">
                  <span>代币费用:</span>
                  <span>{gasEstimate.gasCostTokens} {paymasterConfig.tokenSymbol}</span>
                </div>
                <div className="estimate-item">
                  <span>等值ETH:</span>
                  <span>{gasEstimate.gasCostEth} ETH</span>
                </div>
                <div className="estimate-item">
                  <span>汇率:</span>
                  <span>1 ETH = {paymasterConfig.exchangeRate} {paymasterConfig.tokenSymbol}</span>
                </div>
              </div>
              
              {paymasterConfig.enabled && !hasEnoughTokens() && (
                <div className="insufficient-balance-warning">
                  ⚠️ 代币余额不足，需要 {gasEstimate.gasCostTokens} {paymasterConfig.tokenSymbol}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 执行按钮 */}
      <div className="execute-section">
        <button
          onClick={executeTransaction}
          disabled={isLoading || !smartAccountAddress || !transaction.to || 
                   (paymasterConfig.enabled && !hasEnoughTokens())}
          className="execute-btn"
        >
          {isLoading ? '执行中...' : 
           paymasterConfig.enabled ? 
           `使用 ${paymasterConfig.tokenSymbol} 支付Gas费` : 
           '使用 ETH 支付Gas费'}
        </button>
        
        {paymasterConfig.enabled && gasEstimate && (
          <div className="execute-info">
            <p>💡 将消耗 {gasEstimate.gasCostTokens} {paymasterConfig.tokenSymbol} 作为Gas费</p>
          </div>
        )}
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
                  {result.type === 'paymaster' ? 'Paymaster交易' : '普通交易'}
                </div>
                <div className="detail-item">
                  <strong>交易哈希:</strong> {result.transactionHash}
                </div>
                <div className="detail-item">
                  <strong>Gas使用:</strong> {result.gasUsed}
                </div>
                
                {result.paymaster?.enabled && (
                  <div className="paymaster-info">
                    <h4>💰 Paymaster 详情</h4>
                    <ul>
                      <li>✅ 支付方式: {getSponsorModeInfo(result.paymaster.sponsorMode).name}</li>
                      <li>✅ 代币消耗: {result.paymaster.tokenAmount} {result.paymaster.tokenUsed}</li>
                      <li>✅ 代币地址: {result.paymaster.tokenAddress}</li>
                      <li>✅ 汇率: 1 ETH = {result.paymaster.exchangeRate} {result.paymaster.tokenUsed}</li>
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

export default PaymasterDemo;