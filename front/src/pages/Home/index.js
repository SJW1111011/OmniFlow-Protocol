import React, { useState, useEffect } from 'react';
import { Button, Card, Row, Col, Statistic, Typography, Space, Tag, Divider, message, Modal, Input } from 'antd';
import { 
  RobotOutlined, 
  SwapOutlined, 
  ThunderboltOutlined,
  SafetyOutlined,
  GlobalOutlined,
  DollarOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { useAccount } from 'wagmi';
import { useEtherspotAccount } from '../../hooks/useEtherspotAccount';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import './index.css';

const { Title, Paragraph, Text } = Typography;

const Home = () => {
  const { address, isConnected } = useAccount();
  const { smartAccountAddress, createSmartAccount, loading } = useEtherspotAccount();
  const [stats, setStats] = useState({
    totalValue: 0,
    activeChains: 0,
    transactions: 0,
    savedGas: 0
  });
  const [transferModalVisible, setTransferModalVisible] = useState(false); // 弹窗状态
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    // 模拟统计数据
    setStats({
      totalValue: 125420,
      activeChains: 6,
      transactions: 1247,
      savedGas: 89.5
    });
  }, []);

  const handleCreateSmartAccount = async () => {
    try {
      await createSmartAccount();
      message.success('智能账户创建成功！');
    } catch (error) {
      message.error('创建智能账户失败：' + error.message);
    }
  };

  const handleTransferToSmartAccount = () => {
    setTransferModalVisible(true);
  };

  const handleTransferConfirm = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      message.error('请输入有效的转账金额');
      return;
    }

    setTransferLoading(true);
    try {
      // 获取当前连接的provider
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // 转换金额为wei
      const amountWei = ethers.utils.parseEther(transferAmount);
      
      // 发送转账交易
      const tx = await signer.sendTransaction({
        to: smartAccountAddress,
        value: amountWei,
      });
      
      message.loading('交易发送中...', 0);
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      message.destroy();
      message.success(`转账成功！交易哈希: ${receipt.transactionHash}`);
      
      // 关闭弹窗并重置状态
      setTransferModalVisible(false);
      setTransferAmount('');
      
    } catch (error) {
      console.error('转账失败:', error);
      message.error('转账失败: ' + (error.message || '未知错误'));
    } finally {
      setTransferLoading(false);
    }
  };

  const handleTransferCancel = () => {
    setTransferModalVisible(false);
    setTransferAmount('');
  };

  const features = [
    {
      icon: <RobotOutlined style={{ fontSize: '32px', color: '#1890ff' }} />,
      title: 'AI 智能助手',
      description: '通过自然语言对话，让AI帮您完成复杂的DeFi操作和跨链交易',
      tag: 'AI驱动'
    },
    {
      icon: <ThunderboltOutlined style={{ fontSize: '32px', color: '#52c41a' }} />,
      title: 'Gas 费抽象',
      description: '使用任意代币支付任意链的Gas费，无需持有原生代币',
      tag: '零门槛'
    },
    {
      icon: <SwapOutlined style={{ fontSize: '32px', color: '#fa8c16' }} />,
      title: '智能跨链路由',
      description: 'AI聚合多种桥协议，自动选择最优路径，兼顾安全与成本',
      tag: '最优路径'
    },
    {
      icon: <SafetyOutlined style={{ fontSize: '32px', color: '#eb2f96' }} />,
      title: '社交恢复',
      description: '通过守护者网络保护您的资产，即使丢失私钥也能恢复',
      tag: '安全保障'
    },
    {
      icon: <GlobalOutlined style={{ fontSize: '32px', color: '#722ed1' }} />,
      title: '多链统一管理',
      description: '一个账户管理所有链上资产，无需频繁切换网络',
      tag: '统一体验'
    },
    {
      icon: <LineChartOutlined style={{ fontSize: '32px', color: '#13c2c2' }} />,
      title: '主动流动性管理',
      description: 'AI监控全链收益，自动迁移资金到最优收益池',
      tag: '智能理财'
    }
  ];

  return (
    <div className="home-container">
      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <Title level={1} className="hero-title">
              <span className="gradient-text">The Future of Fluid Finance</span>
            </Title>
            <Title level={1} className="hero-subtitle">
              AI-Driven Cross-Layer Liquidity Network
            </Title>
            <Paragraph className="hero-description">
              Seamlessly connecting assets across chains through AI-powered smart accounts<br></br> enabling automated gas abstraction and optimal routing<br></br>delivering effortless, intelligent DeFi experiences for everyone.
            </Paragraph>
            
            <Space size="large" className="hero-actions">
              {!isConnected ? (
                // 钱包连接按钮
                <ConnectButton />
              ) : !smartAccountAddress ? (
                // 创建智能账户按钮和配置按钮
                <Space direction="vertical" align="center">
                  <Space direction="horizontal" size="middle">
                    <Button 
                      type="primary" 
                      size="large" 
                      loading={loading}
                      onClick={handleCreateSmartAccount}
                      className="create-account-btn"
                    >
                      Create smart account
                    </Button>
                  </Space>
                </Space>
              ) : (
                <Space direction="vertical" align="center">
                  <Text type="success">✅ 智能账户已创建</Text>
                  <Text code copyable className="account-address">
                    {smartAccountAddress}
                  </Text>
                  <Button 
                    type="primary" 
                    size="small"
                    icon={<DollarOutlined />}
                    onClick={handleTransferToSmartAccount}
                    className="transfer-btn"
                    style={{ marginTop: '8px' }}
                  >
                    转账到智能账户
                  </Button>
                </Space>
              )}
              
              <Button size="large" ghost className="learn-more-btn">
                Learn more
              </Button>
            </Space>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-section">
        <Row gutter={[32, 32]}>
          <Col xs={12} sm={6}>
            <Card className="stat-card">
              <Statistic
                title="总资产价值"
                value={stats.totalValue}
                prefix={<DollarOutlined />}
                suffix="USD"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card">
              <Statistic
                title="支持链数"
                value={stats.activeChains}
                prefix={<GlobalOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card">
              <Statistic
                title="交易笔数"
                value={stats.transactions}
                prefix={<SwapOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card">
              <Statistic
                title="节省Gas费"
                value={stats.savedGas}
                suffix="%"
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Features Section */}
      <div className="features-section">
        <div className="section-header">
          <Title level={2} className="section-title">
            核心功能特性
          </Title>
          <Paragraph className="section-description">
            OmniFlow Protocol 通过创新的技术组合，为用户提供前所未有的DeFi体验
          </Paragraph>
        </div>

        <Row gutter={[24, 24]}>
          {features.map((feature, index) => (
            <Col xs={24} md={12} lg={8} key={index}>
              <Card 
                className="feature-card"
                hoverable
                cover={
                  <div className="feature-icon-container">
                    {feature.icon}
                    <Tag color="blue" className="feature-tag">
                      {feature.tag}
                    </Tag>
                  </div>
                }
              >
                <Card.Meta
                  title={<Title level={4}>{feature.title}</Title>}
                  description={feature.description}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* How It Works Section */}
      <div className="how-it-works-section">
        <div className="section-header">
          <Title level={2} className="section-title">
            工作原理
          </Title>
          <Paragraph className="section-description">
            三步即可开始您的智能DeFi之旅
          </Paragraph>
        </div>

        <Row gutter={[32, 32]} align="middle">
          <Col xs={24} md={8}>
            <div className="step-card">
              <div className="step-number">1</div>
              <Title level={4}>连接钱包</Title>
              <Paragraph>
                连接您的Web3钱包，创建基于ERC-4337的智能账户
              </Paragraph>
            </div>
          </Col>
          
          <Col xs={24} md={8}>
            <div className="step-card">
              <div className="step-number">2</div>
              <Title level={4}>AI 对话</Title>
              <Paragraph>
                用自然语言告诉AI您的需求，如"帮我找到最高收益的USDC池"
              </Paragraph>
            </div>
          </Col>
          
          <Col xs={24} md={8}>
            <div className="step-card">
              <div className="step-number">3</div>
              <Title level={4}>智能执行</Title>
              <Paragraph>
                AI自动分析、规划并执行最优的跨链交易策略
              </Paragraph>
            </div>
          </Col>
        </Row>
      </div>

      {/* CTA Section */}
      <div className="cta-section">
        <div className="cta-content">
          <Title level={3} className="cta-title">
            准备好体验未来的DeFi了吗？
          </Title>
          <Paragraph className="cta-description">
            加入OmniFlow Protocol，让AI成为您的专属DeFi助手
          </Paragraph>
          <Space size="large">
            <Button 
              type="primary" 
              size="large" 
              icon={<RobotOutlined />}
              href="/ai"
              className="cta-button-primary"
            >
              开始AI对话
            </Button>
            <Button 
              size="large" 
              className="cta-button-secondary"
            >
              查看文档
            </Button>
          </Space>
        </div>
      </div>

      {/* 转账弹窗 */}
      <Modal
        title="转账到智能账户"
        open={transferModalVisible}
        onOk={handleTransferConfirm}
        onCancel={handleTransferCancel}
        confirmLoading={transferLoading}
        okText="确认转账"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>智能账户地址:</Text>
          <br />
          <Text code style={{ fontSize: 12 }}>{smartAccountAddress}</Text>
        </div>
        <div>
          <Text>转账金额 (ETH):</Text>
          <Input
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="请输入转账金额"
            type="number"
            min="0"
            step="0.001"
            style={{ marginTop: 8 }}
            suffix="ETH"
          />
        </div>
      </Modal>

  </div>
);
}

export default Home;