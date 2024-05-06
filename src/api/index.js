import express from "express";
import healthRoute from "./health.route";
import automaticExport from "./automaticExport.route";

const router = express.Router();
// API route registration here
router.use('/health', healthRoute);
router.use('/automaticAuditExport', automaticExport);
export default router;