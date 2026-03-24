import axios from 'axios';
import { getApiBaseUrl } from './network';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
});

export const publicApi = axios.create({
  baseURL: `${getApiBaseUrl()}/public`,
});
