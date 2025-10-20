import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from 'antd';
import './index.css';

const WalletConnect = ({ 
  customButton = false, 
  buttonText = '连接钱包',
  size = 'large',
  type = 'primary'
}) => {
  if (customButton) {
    return (
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted,
        }) => {
          // Note: If your app doesn't use authentication, you
          // can remove all 'authenticationStatus' checks
          const ready = mounted && authenticationStatus !== 'loading';
          const connected =
            ready &&
            account &&
            chain &&
            (!authenticationStatus ||
              authenticationStatus === 'authenticated');

          return (
            <div
              {...(!ready && {
                'aria-hidden': true,
                'style': {
                  opacity: 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                },
              })}
            >
              {(() => {
                if (!connected) {
                  return (
                    <Button 
                      onClick={openConnectModal} 
                      type={type}
                      size={size}
                      className="wallet-connect-btn"
                    >
                      {buttonText}
                    </Button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <Button 
                      onClick={openChainModal} 
                      type="danger"
                      size={size}
                      className="wallet-connect-btn"
                    >
                      错误的网络
                    </Button>
                  );
                }

                return (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Button
                      onClick={openChainModal}
                      size={size}
                      className="chain-btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {chain.hasIcon && (
                        <div
                          style={{
                            background: chain.iconBackground,
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            overflow: 'hidden',
                            marginRight: 4,
                          }}
                        >
                          {chain.iconUrl && (
                            <img
                              alt={chain.name ?? 'Chain icon'}
                              src={chain.iconUrl}
                              style={{ width: 12, height: 12 }}
                            />
                          )}
                        </div>
                      )}
                      {chain.name}
                    </Button>

                    <Button 
                      onClick={openAccountModal} 
                      type="default"
                      size={size}
                      className="account-btn"
                    >
                      {account.displayName}
                      {account.displayBalance
                        ? ` (${account.displayBalance})`
                        : ''}
                    </Button>
                  </div>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>
    );
  }

  // 使用默认的 RainbowKit 按钮
  return <ConnectButton />;
};

export default WalletConnect;