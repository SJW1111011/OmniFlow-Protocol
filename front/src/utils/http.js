import axios from 'axios'

const httpInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
httpInstance.interceptors.request.use(
  // 请求成功的情况
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config
  },
  // 请求失败的情况
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
httpInstance.interceptors.response.use(
  // 成功响应到数据的时候
  response => {
    return response.data
  },
  // 响应失败的时候
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error)
  }
)

export default httpInstance