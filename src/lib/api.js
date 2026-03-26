import axios from "axios";

export const API_BASE_URL = "http://[::1]:4000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});
