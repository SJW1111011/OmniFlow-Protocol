import { createBrowserRouter } from "react-router-dom";
import Layout from "../pages/Layout";
import Home from "../pages/Home";
import NotFound from "../pages/NotFound";
import AI from "../pages/AI";
import BatchTransactions from "../components/BatchTransactions/BatchTransactions";
import GasAbstraction from '../components/GasAbstraction/GasAbstraction';
import PaymasterDemo from '../components/PaymasterDemo/PaymasterDemo';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        // 重定向
        index: true,
        element: <Home />
      },
      {
        path: '/ai',
        element: <AI />
      },
      {
        path: '/batch',
        element: <BatchTransactions />
      },
      {
        path: '/gas-abstraction',
        element: <GasAbstraction />
      },
      {
        path: '/paymaster',
        element: <PaymasterDemo />
      }
    ]
  },
  // 404组件
  {
    path: '*',
    element: <NotFound />
  }
])

export default router