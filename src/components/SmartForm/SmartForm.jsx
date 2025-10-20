import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Input, 
  Switch, 
  Space, 
  Typography, 
  Divider, 
  Alert, 
  Tag,
  Tooltip,
  message,
  Modal,
  Spin
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  SendOutlined, 
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useAccount } from 'wagmi';
import { useEtherspotAccount } from '../../hooks/useEtherspotAccount';
import './SmartForm.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

/**
 * 智能表单组件
 * 根据AI解析结果动态生成批量交易表单
 */
const SmartForm = ({ initialData, onSubmit, onCancel, loading = false }) => {
  const { address, isConnected } = useAccount();
  const { 
    smartAccountAddress, 
    createSmartAccount, 
    executeBatchTransaction,
    getBalance, 
    loading: etherspotLoading,
    isInitialized
  } = useEtherspotAccount();

  const [transactions, setTransactions] = useState([]);
  const [batchConfig, setBatchConfig] = useState({
    maxGasLimit: '500000',
    gasPrice: '20',
    useSmartAccount: true,
    atomicExecution: true
  });
  const [gasEstimate, setGasEstimate] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [balances, setBalances] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 初始化交易数据
  useEffect(() => {
    if (initialData && initialData.transactions) {
      const formattedTransactions = initialData.transactions.map((tx, index) => ({
        id: index + 1,
        to: tx.to || '',
        value: tx.value || tx.amount || '', // 优先使用value字段，兼容amount字段
        token: tx.token || 'ETH',
        description: tx.description || `转账 ${tx.value || tx.amount} ${tx.token || 'ETH'} 到 ${tx.to}`,
        enabled: true,
        data: '0x'
      }));
      setTransactions(formattedTransactions);
    }
  }, [initialData]);

  // 加载余额
  useEffect(() => {
    if (isConnected && smartAccountAddress && isInitialized) {
      loadBalances();
    }
  }, [isConnected, smartAccountAddress, isInitialized]);

  const loadBalances = async () => {
    if (!smartAccountAddress || !isInitialized) return;
    
    try {
      const balanceData = await getBalance();
      setBalances(balanceData);
    } catch (error) {
      console.error('加载余额失败:', error);
    }
  };

  // 更新交易信息
  const updateTransaction = (id, field, value) => {
    setTransactions(prev => prev.map(tx => 
      tx.id === id ? { ...tx, [field]: value } : tx
    ));
  };

  // 添加新交易
  const addTransaction = () => {
    const newId = Date.now() + Math.random();
    setTransactions(prev => [...prev, {
      id: newId,
      to: '',
      value: '',
      token: 'ETH',
      data: '0x',
      description: '',
      enabled: true,
      confidence: 0.5
    }]);
  };

  // 删除交易
  const removeTransaction = (id) => {
    if (transactions.length > 1) {
      setTransactions(prev => prev.filter(tx => tx.id !== id));
    }
  };

  // 执行批量交易
  const handleExecute = async () => {
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

    setShowConfirmModal(true);
  };

  const confirmExecution = async () => {
    setShowConfirmModal(false);
    setIsExecuting(true);
    
    try {
      const enabledTxs = transactions.filter(tx => tx.enabled && tx.to && tx.value);
      
      // 准备批量交易数据
      const batchTxData = enabledTxs.map(tx => ({
        to: tx.to,
        value: tx.value || '0',
        data: tx.data || '0x'
      }));

      console.log('执行批量交易:', batchTxData);

      // 执行批量交易
      const txResult = await executeBatchTransaction(batchTxData);
      
      message.success(`成功提交 ${enabledTxs.length} 笔交易`);
      
      // 调用父组件的提交回调
      if (onSubmit) {
        await onSubmit(enabledTxs);
      }
      
    } catch (error) {
      console.error('批量交易失败:', error);
      message.error('批量交易执行失败: ' + error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  // 估算 Gas 费用
  const estimateGas = async () => {
    const enabledTxs = transactions.filter(tx => tx.enabled && tx.to && tx.value);
    if (enabledTxs.length === 0) return;

    try {
      // 简单的 Gas 估算
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

      const batchOverhead = 50000;
      const totalGasLimit = txEstimates.reduce((sum, tx) => sum + tx.gasLimit, 0) + batchOverhead;
      const totalGasCost = (totalGasLimit * parseFloat(batchConfig.gasPrice)) / 1e9;

      setGasEstimate({
        transactions: txEstimates,
        batch: {
          totalGasLimit,
          totalGasCost: totalGasCost.toFixed(6),
          overhead: batchOverhead
        }
      });
    } catch (error) {
      console.error('Gas 估算失败:', error);
    }
  };

  // 当交易或配置变化时重新估算 Gas
  useEffect(() => {
    if (transactions.length > 0) {
      estimateGas();
    }
  }, [transactions, batchConfig.gasPrice]);

  // 获取置信度颜色
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'orange';
    return 'red';
  };

  // 获取置信度文本
  const getConfidenceText = (confidence) => {
    if (confidence >= 0.8) return '高';
    if (confidence >= 0.6) return '中';
    return '低';
  };

  if (!initialData || !transactions.length) {
    return (
      <Card className="smart-form-empty">
        <div className="empty-content">
          <Text type="secondary">暂无交易数据</Text>
        </div>
      </Card>
    );
  }

  return (
    <div className="smart-form-container">
      {/* 头部信息 */}
      <div className="smart-form-header">
        <div className="header-info">
          <Title level={4}>智能批量转账表单</Title>
          {initialData && (
            <div className="parse-info">
              <Tag color={getConfidenceColor(initialData.confidence)}>
                解析置信度: {(initialData.confidence * 100).toFixed(1)}%
              </Tag>
              <Text type="secondary">
                识别到 {transactions.length} 笔转账交易
              </Text>
            </div>
          )}
        </div>
        
        {/* 账户信息 */}
        {isConnected && (
          <div className="account-info">
            <Text type="secondary">当前账户: {address?.slice(0, 6)}...{address?.slice(-4)}</Text>
            {smartAccountAddress && (
              <Text type="secondary">智能账户: {smartAccountAddress.slice(0, 6)}...{smartAccountAddress.slice(-4)}</Text>
            )}
            {balances && (
              <Text type="secondary">余额: {balances.nativeBalance} ETH</Text>
            )}
          </div>
        )}
      </div>

      {/* 连接钱包提示 */}
      {!isConnected && (
        <Alert
          message="请先连接钱包"
          description="需要连接钱包才能执行批量交易"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 智能账户提示 */}
      {isConnected && !smartAccountAddress && (
        <Alert
          message="需要创建智能账户"
          description="批量交易需要使用智能账户功能"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 交易列表 */}
      <div className="transactions-list">
        <div className="list-header">
          <Title level={5}>交易列表</Title>
          <Button 
            type="dashed" 
            icon={<PlusOutlined />} 
            onClick={addTransaction}
            size="small"
          >
            添加交易
          </Button>
        </div>

        {transactions.map((tx, index) => (
          <Card 
            key={tx.id} 
            className={`transaction-card ${!tx.enabled ? 'disabled' : ''}`}
            size="small"
          >
            <div className="transaction-header">
              <div className="transaction-title">
                <Switch
                  checked={tx.enabled}
                  onChange={(checked) => updateTransaction(tx.id, 'enabled', checked)}
                  size="small"
                />
                <Text strong>交易 #{index + 1}</Text>
                {tx.token && (
                  <Tag color="blue" size="small">{tx.token}</Tag>
                )}
              </div>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeTransaction(tx.id)}
                size="small"
                disabled={transactions.length <= 1}
              />
            </div>

            <div className="transaction-fields">
              <div className="field-group">
                <Text type="secondary">接收地址</Text>
                <Input
                  value={tx.to}
                  onChange={(e) => updateTransaction(tx.id, 'to', e.target.value)}
                  placeholder="0x..."
                  disabled={!tx.enabled}
                />
              </div>

              <div className="field-group">
                <Text type="secondary">转账金额</Text>
                <Input
                  value={tx.value}
                  onChange={(e) => updateTransaction(tx.id, 'value', e.target.value)}
                  placeholder="0.001"
                  suffix={tx.token || 'ETH'}
                  disabled={!tx.enabled}
                />
              </div>

              <div className="field-group">
                <Text type="secondary">备注</Text>
                <Input
                  value={tx.description}
                  onChange={(e) => updateTransaction(tx.id, 'description', e.target.value)}
                  placeholder="交易备注"
                  disabled={!tx.enabled}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 批量配置 */}
      <Card className="batch-config" size="small">
        <Title level={5}>批量配置</Title>
        <div className="config-fields">
          <div className="field-group">
            <Text type="secondary">Gas 价格 (Gwei)</Text>
            <Input
              value={batchConfig.gasPrice}
              onChange={(e) => setBatchConfig({...batchConfig, gasPrice: e.target.value})}
              placeholder="20"
              suffix="Gwei"
            />
          </div>
          
          <div className="field-group">
            <Text type="secondary">最大 Gas 限制</Text>
            <Input
              value={batchConfig.maxGasLimit}
              onChange={(e) => setBatchConfig({...batchConfig, maxGasLimit: e.target.value})}
              placeholder="500000"
            />
          </div>

          <div className="config-switches">
            <div className="switch-item">
              <Switch
                checked={batchConfig.atomicExecution}
                onChange={(checked) => setBatchConfig({...batchConfig, atomicExecution: checked})}
              />
              <div className="switch-label">
                <Text>原子执行</Text>
                <Tooltip title="启用后，要么所有交易都成功，要么全部失败">
                  <InfoCircleOutlined style={{ color: '#999', marginLeft: 4 }} />
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Gas 估算 */}
      {gasEstimate && (
        <Card className="gas-estimate" size="small">
          <Title level={5}>Gas 费用估算</Title>
          <div className="estimate-info">
            <div className="estimate-item">
              <Text type="secondary">预计 Gas 消耗:</Text>
              <Text>{gasEstimate.batch.totalGasLimit.toLocaleString()}</Text>
            </div>
            <div className="estimate-item">
              <Text type="secondary">预计费用:</Text>
              <Text strong>{gasEstimate.batch.totalGasCost} ETH</Text>
            </div>
            <div className="estimate-item">
              <Text type="secondary">交易数量:</Text>
              <Text>{transactions.filter(tx => tx.enabled).length}</Text>
            </div>
          </div>
        </Card>
      )}

      {/* 风险提示 */}
      <Alert
        message="交易风险提示"
        description="请仔细检查所有交易信息，确认无误后再执行。批量交易一旦提交将无法撤销。"
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 操作按钮 */}
      <div className="form-actions">
        <Button onClick={onCancel} disabled={isExecuting}>
          取消
        </Button>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleExecute}
          loading={isExecuting || etherspotLoading}
          disabled={!isConnected || !smartAccountAddress || transactions.filter(tx => tx.enabled && tx.to && tx.value).length === 0}
        >
          {isExecuting ? '执行中...' : `执行批量交易 (${transactions.filter(tx => tx.enabled).length})`}
        </Button>
      </div>

      {/* 确认模态框 */}
      <Modal
        title="确认批量交易"
        open={showConfirmModal}
        onOk={confirmExecution}
        onCancel={() => setShowConfirmModal(false)}
        okText="确认执行"
        cancelText="取消"
        okButtonProps={{ loading: isExecuting }}
      >
        <div className="confirm-content">
          <Alert
            message="即将执行批量交易"
            description={`您将执行 ${transactions.filter(tx => tx.enabled).length} 笔交易，预计费用 ${gasEstimate?.batch?.totalGasCost || '计算中...'} ETH`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <div className="transaction-summary">
            {transactions.filter(tx => tx.enabled).map((tx, index) => (
              <div key={tx.id} className="summary-item">
                <Text>#{index + 1}: 转账 {tx.value} {tx.token || 'ETH'} 到 {tx.to.slice(0, 6)}...{tx.to.slice(-4)}</Text>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SmartForm;