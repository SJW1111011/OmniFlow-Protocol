import React, { useState, useRef } from 'react';
import {
  Button,
  Input,
  Avatar,
  Typography,
  Tag,
  Space,
  Tooltip,
  message as antMessage,
  Card,
  Spin,
  Modal
} from 'antd';
import {
  SendOutlined,
  LikeOutlined,
  DislikeOutlined,
  CopyOutlined,
  RobotOutlined,
  UserOutlined,
  ClearOutlined,
  ThunderboltOutlined,
  FormOutlined
} from '@ant-design/icons';
import { useAIAssistant } from '../../hooks/useAIAssistant';
import SmartForm from '../../components/SmartForm/SmartForm';
import SmartFormParser from '../../utils/smartFormParser';
import './index.css';

const { TextArea } = Input;
const { Text } = Typography;

const AI = () => {
  const [inputValue, setInputValue] = useState('');
  const [showSmartForm, setShowSmartForm] = useState(false);
  const [parsedFormData, setParsedFormData] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [localMessages, setLocalMessages] = useState([]); // 本地消息状态，用于智能表单消息

  const { messages, loading, sendMessage, clearConversation, executeSuggestion } = useAIAssistant();
  const messagesEndRef = useRef(null);
  const smartFormParser = useRef(new SmartFormParser());

  const handleSend = async () => {
    if (inputValue.trim() && !loading) {
      setFormLoading(true);

      // 添加用户消息
      const userMessage = {
        id: Date.now() - 1,
        type: 'user',
        content: inputValue.trim(),
        timestamp: Date.now() - 1
      };

      // 先解析用户输入
      const parsedData = smartFormParser.current.parseTransactionIntent(inputValue.trim());

      if (parsedData.intent === 'batch_transfer' && parsedData.confidence > 0.7 && parsedData.transactions.length > 0) {
        // 添加用户消息
        setLocalMessages(prev => [...prev, userMessage]);

        // 添加AI思考中的消息
        const thinkingMessage = {
          id: Date.now(),
          type: 'ai',
          content: '正在分析您的转账需求...',
          timestamp: Date.now(),
          isThinking: true
        };

        setLocalMessages(prev => [...prev, thinkingMessage]);

        // 模拟AI思考过程
        setTimeout(() => {
          // 移除思考消息，添加包含智能表单的AI回复消息
          const formMessage = {
            id: Date.now() + 1,
            type: 'ai',
            content: `我识别到您想要执行批量转账操作。基于您的描述，我为您生成了以下交易表单：`,
            timestamp: Date.now() + 1,
            intent: parsedData.intent,
            confidence: parsedData.confidence,
            formData: parsedData, // 将表单数据附加到消息中
            hasSmartForm: true // 标记这个消息包含智能表单
          };

          setLocalMessages(prev => {
            // 移除思考消息，添加表单消息
            const withoutThinking = prev.filter(msg => !msg.isThinking);
            return [...withoutThinking, formMessage];
          });
        }, 1500); // 1.5秒的思考时间
      } else {
        // 否则正常发送到AI助手
        await sendMessage(inputValue);
      }

      setInputValue('');
      setFormLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
    antMessage.success('已复制到剪贴板');
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 智能表单相关处理函数
  const handleSmartFormSubmit = async (transactions) => {
    setFormLoading(true);
    try {
      // 这里可以调用批量交易服务
      console.log('执行批量交易:', transactions);
      antMessage.success(`成功提交 ${transactions.length} 笔交易`);
      setShowSmartForm(false);

      // 向AI助手发送执行结果
      await sendMessage(`已成功提交 ${transactions.length} 笔批量转账交易`);
    } catch (error) {
      console.error('批量交易失败:', error);
      antMessage.error('批量交易执行失败');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSmartFormCancel = () => {
    setShowSmartForm(false);
    setParsedFormData(null);
  };

  const handleGenerateSmartForm = () => {
    if (inputValue.trim()) {
      const parsedData = smartFormParser.current.parseTransactionIntent(inputValue.trim());
      if (parsedData.transactions.length > 0) {
        setParsedFormData(parsedData);
        setShowSmartForm(true);
      } else {
        antMessage.warning('未能识别到有效的转账信息，请尝试更明确的描述');
      }
    }
  };

  // 快捷操作建议
  const quickActions = [
    '创建智能账户',
    '查看账户余额',
    '跨链转账USDC',
    '设置社交恢复',
    '批量执行交易',
    '优化Gas费用'
  ];

  return (
    <div className="ai-container">
      {/* 左侧快捷操作 */}
      <div className="ai-content-left">
        <div className="ai-content-left-top">
          <span className="history-title">AI Flow Assistant</span>
          <Button
            type="primary"
            size="small"
            icon={<ClearOutlined />}
            onClick={clearConversation}
            className="new-chat-btn"
          >
            清空对话
          </Button>
        </div>

        <div className="ai-content-left-bottom">
          <div className="quick-actions">
            <Text strong style={{ marginBottom: 12, display: 'block' }}>
              <ThunderboltOutlined /> 快捷操作
            </Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  type="text"
                  size="small"
                  onClick={() => executeSuggestion(action)}
                  className="quick-action-btn"
                  block
                >
                  {action}
                </Button>
              ))}
            </Space>
          </div>
        </div>
      </div>

      {/* 右侧聊天区域 */}
      <div className="ai-content-right">
        <div className="chat-header">
          <Space>
            <RobotOutlined style={{ fontSize: 20, color: '#722ed1' }} />
            <h3>OmniFlow AI Assistant</h3>
          </Space>
          <Text type="secondary">智能Web3操作助手</Text>
        </div>

        <div className="chat-messages">
          {/* 合并显示所有消息，按时间戳排序 */}
          {[...messages, ...localMessages]
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((message) => (
              <div key={message.id} className={`message-item ${message.type}`}>
                <Avatar
                  className="message-avatar"
                  icon={message.type === 'ai' ? <RobotOutlined /> : <UserOutlined />}
                  style={{
                    backgroundColor: message.type === 'ai' ? '#722ed1' : '#1890ff',
                    flexShrink: 0
                  }}
                />
                <div className="message-content">
                  <div className="message-time">
                    {formatTime(message.timestamp)}
                    {message.intent && (
                      <Tag
                        color={message.confidence > 0.8 ? 'green' : 'orange'}
                        size="small"
                        style={{ marginLeft: 8 }}
                      >
                        {message.intent}
                      </Tag>
                    )}
                  </div>
                  <div className={`message-text ${message.isError ? 'error' : ''}`}>
                    {message.isThinking ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Spin size="small" />
                        {message.content}
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>

                  {/* 智能表单组件 - 只在有表单数据时显示 */}
                  {message.type === 'ai' && message.hasSmartForm && message.formData && (
                    <div className="message-smart-form">
                      <SmartForm
                        initialData={message.formData}
                        onSubmit={handleSmartFormSubmit}
                        onCancel={() => {
                          // 可以选择隐藏表单或其他操作
                          console.log('用户取消了表单操作');
                        }}
                        loading={formLoading}
                      />
                    </div>
                  )}

                  {/* AI消息的操作建议 - 只在有建议时显示 */}
                  {message.type === 'ai' && message.suggestions && message.suggestions.length > 0 && (
                    <div className="message-suggestions">
                      <Space wrap>
                        {message.suggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            size="small"
                            type="text"
                            onClick={() => executeSuggestion(suggestion)}
                            className="suggestion-btn"
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </Space>
                    </div>
                  )}

                  {/* AI消息的操作按钮 */}
                  {message.type === 'ai' && (
                    <div className="message-actions">
                      <Tooltip title="复制">
                        <Button
                          size="small"
                          type="text"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopy(message.content)}
                        />
                      </Tooltip>
                      <Tooltip title="好评">
                        <Button
                          size="small"
                          type="text"
                          icon={<LikeOutlined />}
                        />
                      </Tooltip>
                      <Tooltip title="差评">
                        <Button
                          size="small"
                          type="text"
                          icon={<DislikeOutlined />}
                        />
                      </Tooltip>
                    </div>
                  )}
                </div>
              </div>
            ))}

          {loading && (
            <div className="message-item ai">
              <Avatar
                className="message-avatar"
                icon={<RobotOutlined />}
                style={{ backgroundColor: '#722ed1' }}
              />
              <div className="message-content">
                <div className="message-text">
                  <Spin size="small" /> AI正在思考中...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="chat-input">
          <div className="input-container">
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="请描述您想要执行的操作，例如：转账0.1 ETH到0x123...或批量转账..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading}
            />
            <div className="input-buttons">
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={loading || formLoading}
                disabled={!inputValue.trim()}
                className="send-button"
              >
                发送
              </Button>
            </div>
          </div>
          <div className="input-hint">
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 提示：您可以说"我要转0.0001ETH给0x...接收方"或"帮我转账100 USDC到以太坊"
            </Text>
          </div>
        </div>
      </div>

      {/* 智能表单模态框 - 保留作为备用，但通常不会显示 */}
      <Modal
        title="智能批量转账表单"
        open={false} // 设置为false，因为现在表单直接在消息中显示
        onCancel={handleSmartFormCancel}
        footer={null}
        width={800}
        className="smart-form-modal"
      >
        {parsedFormData && (
          <SmartForm
            initialData={parsedFormData}
            onSubmit={handleSmartFormSubmit}
            onCancel={handleSmartFormCancel}
            loading={formLoading}
          />
        )}
      </Modal>
    </div>
  );
};

export default AI;