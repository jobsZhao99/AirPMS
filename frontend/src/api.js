import axios from "axios";

// const api = axios.create({
//   baseURL: "http://localhost:3000",
// });
// const api = axios.create({
//   baseURL: "http://localhost:3000",
// });

// https://airpms.onrender.com
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  });
  
export default api;