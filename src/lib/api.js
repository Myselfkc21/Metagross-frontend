import axios from "axios";

export const API_BASE_URL = "http://13.203.24.48:3000/";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});
