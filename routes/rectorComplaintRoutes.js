import express from "express";
import {
    getAllComplaints,
    getComplaintDetails,
    getComplaintsByStatus,
    getComplaintsByCategory,
    getComplaintStatistics,
    getStaffPerformance,
    getStudentComplaints,
    getPendingResolutions,
    getOverdueComplaints,
    getClosedComplaintsWithRatings,
    exportComplaintReport,
    getResolutionTimeByCategory,
    getComplaintsTrend
} from "../controllers/rectorComplaintController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Rector complaint monitoring routes (read-only)
router.get("/complaints", authMiddleware, getAllComplaints);
router.get("/complaints/details/:complaintId", authMiddleware, getComplaintDetails);
router.get("/complaints/status/:status", authMiddleware, getComplaintsByStatus);
router.get("/complaints/category/:category", authMiddleware, getComplaintsByCategory);
router.get("/complaints/statistics", authMiddleware, getComplaintStatistics);
router.get("/complaints/staff-performance", authMiddleware, getStaffPerformance);
router.get("/complaints/student/:studentId", authMiddleware, getStudentComplaints);
router.get("/complaints/pending-resolutions", authMiddleware, getPendingResolutions);
router.get("/complaints/overdue", authMiddleware, getOverdueComplaints);
router.get("/complaints/closed-with-ratings", authMiddleware, getClosedComplaintsWithRatings);
router.get("/complaints/report/export", authMiddleware, exportComplaintReport);
router.get("/complaints/analytics/resolution-time", authMiddleware, getResolutionTimeByCategory);
router.get("/complaints/analytics/trends", authMiddleware, getComplaintsTrend);

export default router;
