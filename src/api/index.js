import express from "express";
import healthRoute from "./health.route";

const router = express.Router();
// API route registration here
router.use('/health', healthRoute);
export default router;