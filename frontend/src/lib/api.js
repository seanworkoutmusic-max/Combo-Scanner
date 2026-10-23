import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const getStatus = () => axios.get(`${API}/status`).then((r) => r.data);
export const getGames = () => axios.get(`${API}/games`).then((r) => r.data);
export const getScan = (game, books) =>
  axios.get(`${API}/scan`, { params: { game, books: books.join(",") } }).then((r) => r.data);
export const postCombo = (body) => axios.post(`${API}/combo`, body).then((r) => r.data);
export const getPropsGames = () => axios.get(`${API}/props/games`).then((r) => r.data);
export const getPropsPlayers = () => axios.get(`${API}/props/players`).then((r) => r.data);
export const getPropsGame = (code) => axios.get(`${API}/props/game/${code}`).then((r) => r.data);
export const postSlip = (tickers) => axios.post(`${API}/props/slip`, { tickers }).then((r) => r.data);
export const postKalshiQuote = (tickers) => axios.post(`${API}/props/kalshi-quote`, { tickers }).then((r) => r.data);
export const errMsg = (e) => e?.response?.data?.detail || e.message;
