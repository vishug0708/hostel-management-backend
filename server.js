const express = require("express");
const cors = require("cors");
require("dotenv").config();

const path = require("path");

const db = require("./config/database");



// =====================================================
// SERVICE PROTECTED ROUTES
// =====================================================

const { generateMonthlySalaries } = require("./services/salaryService");


// =====================================================
// ADMIN PROTECTED ROUTES
// =====================================================

const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminStudentRoutes = require("./routes/adminStudentRoutes");
const adminRoomRoutes = require("./routes/adminRoomRoutes");
const adminFeeRoutes = require("./routes/adminFeeRoutes");
const adminComplaintRoutes = require("./routes/adminComplaintRoutes");
const adminCricketGroundRoutes = require("./routes/adminCricketGroundRoutes");
const adminCricketBookingRoutes = require("./routes/adminCricketBookingRoutes");
const adminCricketReportRoutes = require("./routes/adminCricketReportRoutes");
const adminStaffRoutes = require("./routes/adminStaffRoutes");
const adminRectorRoutes = require("./routes/adminRectorRoutes");
const adminSalaryRoutes = require("./routes/adminSalaryRoutes");



// =====================================================
// RECTOR PROTECTED ROUTES
// =====================================================

const rectorRoutes = require("./routes/rectorRoutes");
const rectorAuthRoutes = require("./routes/rectorAuthRoutes");
const rectorRoomRoutes = require("./routes/rectorRoomRoutes");
const rectorRoomAllocationRoutes = require("./routes/rectorRoomAllocationRoutes");
const rectorRoomDeAllocationRoutes = require("./routes/rectorRoomDeAllocationRoutes");
const rectorGatePassRoutes = require("./routes/rectorGatePassRoutes");
const rectorSalaryRoutes = require("./routes/rectorSalaryRoutes");


// =====================================================
// STUDENT PROTECTED ROUTES
// =====================================================

const studentAuthRoutes = require("./routes/studentAuthRoutes");
const studentRoutes = require("./routes/studentRoutes");
const studentGatePassRoutes = require("./routes/studentGatePassRoutes");


// =====================================================
// STAFF PROTECTED ROUTES
// =====================================================

const staffAuthRoutes = require("./routes/staffAuthRoutes");
const staffRoutes = require("./routes/staffRoutes");
const staffSalaryRoutes = require("./routes/staffSalaryRoutes");


// =====================================================
// SECURITY PROTECTED ROUTES
// =====================================================

const securityAuthRoutes = require("./routes/securityAuthRoutes");
const securityRoutes = require("./routes/securityRoutes");
const securityGatePassRoutes = require("./routes/securityGatePassRoutes");




const app = express();


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// =====================================================
// TEST API
// =====================================================

app.get("/", (req, res) => {

    res.json({

        success: true,

        message: "Hostel Management API is running 🚀"

    });

});


// =====================================================
// DATABASE TEST
// =====================================================

app.get("/api/test-db", async (req, res) => {
    try {
        const [result] = await db.query("SELECT 1 AS test");

        res.json({
            success: true,
            message: "MySQL connection working ✅",
            result: result
        });
    } catch (error) {
        console.error("❌ Database query error:", error.message);

        res.status(500).json({
            success: false,
            message: "Database connection failed",
            error: error.message
        });
    }
});

// Photo Upload kar ne ke liye

app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);


// =====================================================
// ADMIN AUTH ROUTES
// =====================================================

app.use(
    "/api/auth/admin",
    adminAuthRoutes
);


// =====================================================
// ADMIN PROTECTED ROUTES
// =====================================================

app.use(
    "/api/admin",
    adminRoutes
);

app.use(
    "/api/admin/students",
    adminStudentRoutes
);

app.use(
    "/api/admin/rooms",
    adminRoomRoutes
);

app.use(
    "/api/admin/fees",
    adminFeeRoutes
);

app.use(
    "/api/admin/complaints",
    adminComplaintRoutes
);

app.use(
    "/api/admin/cricket-grounds",
    adminCricketGroundRoutes
);


app.use(
    "/api/admin/cricket-bookings",
    adminCricketBookingRoutes
);

app.use(
    "/api/admin/cricket-reports",
    adminCricketReportRoutes
);

app.use("/api/admin/staff", adminStaffRoutes);

app.use("/api/admin/rectors", adminRectorRoutes);


app.use("/api/admin/salary", adminSalaryRoutes);


// =====================================================
// RECTOR PROTECTED ROUTES
// =====================================================


app.use(
    "/api/rector",
    rectorRoutes
);

app.use(
    "/api/rector",
    rectorAuthRoutes
);

app.use(
    "/api/rector/rooms",
    rectorRoomRoutes
);

app.use(
    "/api/rector/room-allocation",
    rectorRoomAllocationRoutes
);

app.use(
    "/api/rector/room_allocation",
    rectorRoomDeAllocationRoutes
);

app.use(
    "/api/rector/gatepass",
    rectorGatePassRoutes
);

app.use("/api/rector/salary", rectorSalaryRoutes);



// =====================================================
// STUDENT PROTECTED ROUTES
// =====================================================

app.use(
    "/api/student/auth",
    studentAuthRoutes
);

app.use(
    "/api/student",
    studentRoutes
);

app.use(
    "/api/student/gatepass",
    studentGatePassRoutes
);



// =====================================================
// STAFF PROTECTED ROUTES
// =====================================================

app.use("/api/staff/auth", staffAuthRoutes);

app.use("/api/staff", staffRoutes);

app.use("/api/staff/salary", staffSalaryRoutes);


// =====================================================
// SECURITY PROTECTED ROUTES
// =====================================================

app.use(
    "/api/security/auth",
    securityAuthRoutes
);

app.use(
    "/api/security",
    securityRoutes
);

app.use("/api/security/gatepass", securityGatePassRoutes);

// =====================================================
// SERVER
// =====================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});