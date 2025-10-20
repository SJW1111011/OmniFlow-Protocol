import { useNavigate } from 'react-router-dom';
import { Outlet } from "react-router-dom";
import { Layout as AntLayout, Menu, Space, Typography } from 'antd';
import { useState, useEffect } from 'react';
import {
  GithubOutlined,
  TwitterOutlined
} from '@ant-design/icons';
import WalletConnect from '../../components/WalletConnect';
import logo from '../../assets/logo.png';
import './index.css';

const { Header, Content, Footer } = AntLayout;
const { Title } = Typography;

const Layout = () => {
  const [scrolled, setScrolled] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(100);
  
  const menuItems = [
    {
      key: '/',
      label: 'Overview',
    },
    {
      key: '/ai',
      label: 'Omni Mind',
    },
    {
      key: '/batch',
      label: 'Batch Transactions',
    },
    {
      key: '/gas-abstraction',
      label: 'Gas Abstraction',
    },
    {
      key: '/paymaster',
      label: 'Paymaster Demo',
    }
  ];

  const navigate = useNavigate();

  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      // 获取滚动距离
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      // 判断是否需要隐藏导航栏
      const shouldHide = scrollTop > headerHeight;
      setScrolled(shouldHide);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll); // 组件卸载时移除事件监听
  }, [headerHeight]);

  // tab切换
  const onMenuClick = (item) => {
    const key = item.key
    navigate(key)
  }

  return (
    <AntLayout className="layout-container">
      <Header
        className={`header ${scrolled ? 'header-hidden' : ''}`}
        style={{
          transform: scrolled ? 'translateY(-100%)' : 'translateY(0)',
          opacity: scrolled ? 0 : 1,
        }}
      >
        <div className="header-content">
          <div className="logo-section">
            <img src={logo} alt="logo" className="logo" />
            <Title level={2} className="logo-title" onClick={() => navigate('/')}>
              OmniFlow Protocol
            </Title>
          </div>

          <Menu
            mode="horizontal"
            defaultSelectedKeys={['/']}
            items={menuItems}
            className="nav-menu"
            onClick={onMenuClick}
          />

          <div className="wallet-section">
            <WalletConnect customButton={true} />
          </div>
        </div>
      </Header>

      <Content className="content">
        <div className="content-wrapper">
          {/* 二级路由组件显示的位置 */}
          <Outlet />
        </div>
      </Content>

      <Footer className="footer">
        <div className="footer-content">
          <div className="footer-text">
            <Typography.Text>
              © 2025 OmniFlow Protocol. 基于 ERC-4337 的智能账户抽象协议
            </Typography.Text>
          </div>
          <Space size="large">
            <GithubOutlined className="social-icon" />
            <TwitterOutlined className="social-icon" />
          </Space>
        </div>
      </Footer>
    </AntLayout>
  );
};

export default Layout;