import React, { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';
import { useEtherspotAccount } from '../../hooks/useEtherspotAccount';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { message } from 'antd';
import './BatchTransactions.css';

const BatchTransactions = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { 
    smartAccountAddress, 
    createSmartAccount, 
    sendTransaction, 
    executeBatchTransaction,
    getBalance, 
    loading: etherspotLoading,
    isInitialized
  } = useEtherspotAccount();
  
  const [balances, setBalances] = useState(null);
  const [transactions, setTransactions] = useState([
    {
      id: 1,
      to: '',
      value: '',
      data: '0x',
      description: '',
      enabled: true
    }
  ]);
  const [batchConfig, setBatchConfig] = useState({
    maxGasLimit: '500000',
    gasPrice: '20',
    useSmartAccount: true,
    atomicExecution: true // 原子执行：要么全部成功，要么全部失败
  });
  const [gasEstimate, setGasEstimate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');

  useEffect(() => {
    if (isConnected && smartAccountAddress && isInitialized) {
      loadBalances();
    }
  }, [isConnected, smartAccountAddress, isInitialized]);

  const loadBalances = async () => {
    if (!smartAccountAddress || !isInitialized) {
      console.log('跳过余额加载 - 智能账户地址:', smartAccountAddress, '初始化状态:', isInitialized);
      return;
    }
    
    try {
      console.log('开始加载余额...');
      const balanceData = await getBalance();
      setBalances(balanceData);
      console.log('余额加载成功:', balanceData);
    } catch (error) {
      console.error('加载余额失败:', error);
      message.error('加载余额失败: ' + error.message);
    }
  };

  const addTransaction = () => {
    const newId = Math.max(...transactions.map(t => t.id)) + 1;
    setTransactions([...transactions, {
      id: newId,
      to: '',
      value: '',
      data: '0x',
      description: '',
      enabled: true
    }]);
  };

  const removeTransaction = (id) => {
    if (transactions.length > 1) {
      setTransactions(transactions.filter(tx => tx.id !== id));
    }
  };

  const updateTransaction = (id, field, value) => {
    setTransactions(transactions.map(tx => 
      tx.id === id ? { ...tx, [field]: value } : tx
    ));
  };

  const estimateBatchGas = async () => {
    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }

    if (!smartAccountAddress) {
      message.error('请先创建智能账户');
      return;
    }

    const enabledTxs = transactions.filter(tx => tx.enabled && tx.to && tx.value);
    if (enabledTxs.length === 0) {
      message.error('请至少添加一个有效的交易');
      return;
    }

    setIsLoading(true);
    try {
      // 估算每个交易的 Gas
      const txEstimates = enabledTxs.map(tx => {
        const baseGas = 21000;
        const dataGas = tx.data !== '0x' ? (tx.data.length - 2) / 2 * 16 : 0;
        return {
          id: tx.id,
          gasLimit: baseGas + dataGas,
          gasPrice: parseFloat(batchConfig.gasPrice) * 1e9,
          gasCost: ((baseGas + dataGas) * parseFloat(batchConfig.gasPrice)) / 1e9
        };
      });

      // 批量交易的额外开销
      const batchOverhead = 50000; // 批量执行的额外 Gas
      const totalGasLimit = txEstimates.reduce((sum, tx) => sum + tx.gasLimit, 0) + batchOverhead;
      const totalGasCost = (totalGasLimit * parseFloat(batchConfig.gasPrice)) / 1e9;

      // 单独执行的总成本（用于比较）
      const individualTotalCost = txEstimates.reduce((sum, tx) => sum + tx.gasCost, 0);

      setGasEstimate({
        transactions: txEstimates,
        batch: {
          totalGasLimit,
          totalGasCost: totalGasCost.toFixed(6),
          overhead: batchOverhead,
          savings: (individualTotalCost - totalGasCost).toFixed(6),
          savingsPercentage: ((individualTotalCost - totalGasCost) / individualTotalCost * 100).toFixed(1)
        },
        individual: {
          totalGasCost: individualTotalCost.toFixed(6),
          transactionCount: enabledTxs.length
        }
      });
    } catch (error) {
      console.error('Gas 估算失败:', error);
      message.error('Gas 估算失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const executeBatchTransactions = async () => {
    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }

    if (!smartAccountAddress) {
      message.error('请先创建智能账户');
      return;
    }

    const enabledTxs = transactions.filter(tx => tx.enabled && tx.to && tx.value);
    if (enabledTxs.length === 0) {
      message.error('请至少添加一个有效的交易');
      return;
    }

    setIsLoading(true);
    try {
      // 准备批量交易数据，确保所有字段都有有效值
      const batchTxData = enabledTxs.map((tx, index) => {
        console.log(`准备交易 ${index}:`, tx);
        return {
          to: tx.to,
          value: tx.value || '0', // 确保value不为空
          data: tx.data || '0x'   // 确保data不为空
        };
      });

      console.log('准备发送的批量交易数据:', batchTxData);

      // 执行批量交易
      const txResult = await executeBatchTransaction(batchTxData);
      console.log('批量交易结果:', txResult);
      
      setResult({
        success: true,
        type: 'batch-execution',
        userOpHash: txResult.userOpHash,
        transactionHash: txResult.transactionHash,
        gasUsed: txResult.gasUsed || gasEstimate?.batch?.totalGasLimit || '0',
        gasCost: txResult.gasCost || gasEstimate?.batch?.totalGasCost || '0',
        transactionCount: enabledTxs.length,
        atomicExecution: batchConfig.atomicExecution,
        blockNumber: txResult.blockNumber,
        timestamp: new Date().toISOString(),
        transactions: enabledTxs.map((tx, index) => ({
          id: tx.id,
          to: tx.to,
          value: tx.value,
          description: tx.description,
          status: 'success' // 在真实实现中，这应该从交易结果中获取
        }))
      });

      message.success(`批量交易执行成功！共执行 ${enabledTxs.length} 笔交易`);
      
      // 刷新余额
      setTimeout(() => {
        loadBalances();
      }, 2000);
      
    } catch (error) {
      console.error('批量交易执行失败:', error);
      setResult({
        success: false,
        type: 'batch-execution',
        error: error.message,
        transactionCount: enabledTxs.length,
        timestamp: new Date().toISOString(),
        transactions: enabledTxs.map(tx => ({
          id: tx.id,
          to: tx.to,
          value: tx.value,
          description: tx.description,
          status: 'failed'
        }))
      });
      message.error('批量交易执行失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fillSampleTransactions = () => {
    setTransactions([
      {
        id: 1,
        to: '0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb',
        value: '0.0001',
        data: '0x',
        description: '转账给账户1',
        enabled: true
      },
      {
        id: 2,
        to: '0x5c70e5A09D39F2bcCBa968c7f6e0d64E7e742d63',
        value: '0.0002',
        data: '0x',
        description: '转账给账户1',
        enabled: true
      }
    ]);
  };

  return (
    <div className="batch-transactions">
      <div className="batch-header">
        <h2>批量交易</h2>
        <div className="batch-status">
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
                <span className="balance-value">{parseFloat(balances.tokenBalance || 0).toFixed(4)} TOKEN</span>
              </div>
            )}
          </div>
          
          {/* 添加手动刷新按钮 */}
          <div className="balance-actions">
            <button 
              onClick={loadBalances} 
              disabled={isLoading}
              className="refresh-btn"
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? '刷新中...' : '刷新余额'}
            </button>
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
          {parseFloat(balances.nativeBalance || 0) === 0 && smartAccountAddress && (
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

      {/* 批量配置 */}
      <div className="batch-config">
        <h3>批量交易配置</h3>
        <div className="config-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={batchConfig.useSmartAccount}
              onChange={(e) => setBatchConfig({
                ...batchConfig,
                useSmartAccount: e.target.checked
              })}
            />
            使用智能账户执行
          </label>
        </div>
        
        <div className="config-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={batchConfig.atomicExecution}
              onChange={(e) => setBatchConfig({
                ...batchConfig,
                atomicExecution: e.target.checked
              })}
            />
            原子执行（全部成功或全部失败）
          </label>
        </div>
        
        <div className="config-inputs">
          <div className="input-group">
            <label>最大Gas限制:</label>
            <input
              type="number"
              value={batchConfig.maxGasLimit}
              onChange={(e) => setBatchConfig({
                ...batchConfig,
                maxGasLimit: e.target.value
              })}
              placeholder="500000"
            />
          </div>
          <div className="input-group">
            <label>Gas价格 (Gwei):</label>
            <input
              type="number"
              value={batchConfig.gasPrice}
              onChange={(e) => setBatchConfig({
                ...batchConfig,
                gasPrice: e.target.value
              })}
              placeholder="20"
              step="0.1"
            />
          </div>
        </div>
      </div>

      {/* 交易列表 */}
      <div className="transactions-section">
        <div className="section-header">
          <h3>交易列表</h3>
          <div className="header-actions">
            <button onClick={fillSampleTransactions} className="sample-btn">
              填充示例交易
            </button>
            <button onClick={addTransaction} className="add-btn">
              + 添加交易
            </button>
          </div>
        </div>

        {transactions.map((transaction) => (
          <div key={transaction.id} className="transaction-item">
            <div className="transaction-header">
              <div className="transaction-title">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={transaction.enabled}
                    onChange={(e) => updateTransaction(transaction.id, 'enabled', e.target.checked)}
                  />
                  <span className="transaction-index">交易 #{transaction.id}</span>
                </label>
              </div>
              {transactions.length > 1 && (
                <button
                  onClick={() => removeTransaction(transaction.id)}
                  className="remove-btn"
                >
                  ×
                </button>
              )}
            </div>
            
            <div className="transaction-fields">
              <div className="input-group">
                <label>接收地址:</label>
                <input
                  type="text"
                  value={transaction.to}
                  onChange={(e) => updateTransaction(transaction.id, 'to', e.target.value)}
                  placeholder="0x..."
                  disabled={!transaction.enabled}
                />
              </div>
              
              <div className="input-group">
                <label>金额 (ETH):</label>
                <input
                  type="number"
                  value={transaction.value}
                  onChange={(e) => updateTransaction(transaction.id, 'value', e.target.value)}
                  placeholder="0.0"
                  step="0.001"
                  disabled={!transaction.enabled}
                />
              </div>
              
              <div className="input-group">
                <label>交易数据:</label>
                <input
                  type="text"
                  value={transaction.data}
                  onChange={(e) => updateTransaction(transaction.id, 'data', e.target.value)}
                  placeholder="0x"
                  disabled={!transaction.enabled}
                />
              </div>
              
              <div className="input-group">
                <label>描述:</label>
                <input
                  type="text"
                  value={transaction.description}
                  onChange={(e) => updateTransaction(transaction.id, 'description', e.target.value)}
                  placeholder="交易描述"
                  disabled={!transaction.enabled}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="actions-section">
        <button
          onClick={estimateBatchGas}
          disabled={isLoading || !smartAccountAddress}
          className="estimate-btn"
        >
          {isLoading ? '估算中...' : '估算Gas费用'}
        </button>
        
        <button
          onClick={executeBatchTransactions}
          disabled={isLoading || !smartAccountAddress || !gasEstimate}
          className="execute-btn"
        >
          {isLoading ? '执行中...' : '执行批量交易'}
        </button>
      </div>

      {/* 结果显示 */}
      {result && (
        <div className={`result-section ${result.success ? 'success' : 'error'}`}>
          <h3>{result.success ? '✅ 执行成功' : '❌ 执行失败'}</h3>
          {result.success ? (
            <div className="result-details">
              <p><strong>UserOp Hash:</strong> {result.userOpHash}</p>
              <p><strong>交易哈希:</strong> {result.transactionHash || '等待确认...'}</p>
              <p><strong>Gas使用:</strong> {result.gasUsed}</p>
              <p><strong>区块号:</strong> {result.blockNumber || '等待确认...'}</p>
            </div>
          ) : (
            <div className="error-details">
              <p><strong>错误信息:</strong> {result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchTransactions;