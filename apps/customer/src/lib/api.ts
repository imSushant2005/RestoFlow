import axios from 'axios';
import { getApiBaseUrl } from './network';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 60000,
});

export const publicApi = axios.create({
  baseURL: `${getApiBaseUrl()}/public`,
  timeout: 60000,
});
