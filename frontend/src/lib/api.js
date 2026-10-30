import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const getStatus = () => axios.get(`${API}/status`).then((r) => r.data);
export const getGames = () => axios.get(`${API}/games`).then((r) => r.data);
export const getScan = (game, books) =>
  axios.get(`${API}/scan`, { params: { game, books: books.join(",") } }).then((r) => r.data);
export const postCombo = (body) => axios.post(`${API}/combo`, body).then((r) => r.data);
export const getPropsGames = () => axios.get(`${API}/props/games`).then((r) => r.data);
export const getPropsPlayers = () => axios.get(`${API}/props/players`).then((r) => r.data);
export const getScannerPlayer = (game, player) => axios.get(`${API}/scanner/player`, { params: { game, player } }).then((r) => r.data);
export const getScannerGames = () => axios.get(`${API}/scanner/games`).then((r) => r.data);
export const getScannerBoard = (params) => axios.get(`${API}/scanner/board`, { params }).then((r) => r.data);
export const postSgp = (tickers) => axios.post(`${API}/props/sgp`, { tickers }).then((r) => r.data);
export const getLiveTracker = (params) => axios.get(`${API}/live-tracker`, { params }).then((r) => r.data);
export const getScannerGame = (code, td_pts) => axios.get(`${API}/scanner/game/${code}`, { params: { td_pts } }).then((r) => r.data);
export const getTdWatch = () => axios.get(`${API}/tdwatch`).then((r) => r.data);
export const getPropsGame = (code) => axios.get(`${API}/props/game/${code}`).then((r) => r.data);
export const postSlip = (tickers) => axios.post(`${API}/props/slip`, { tickers }).then((r) => r.data);
export const postKalshiQuote = (tickers, target_dollars) => axios.post(`${API}/props/kalshi-quote`, { tickers, target_dollars }).then((r) => r.data);
export const getOrderbook = (ticker) => axios.get(`${API}/props/orderbook/${ticker}`).then((r) => r.data);
export const errMsg = (e) => e?.response?.data?.detail || e.message;
