const bcrypt = require("bcryptjs");

const db = require("../config/database");


// =====================================================
// GET ADMIN PROFILE
// =====================================================

const getAdminProfile = (req, res) => {

    const adminId = req.user.id;

    const sql = `
        SELECT
            id,
            name,
            email,
            phone
        FROM admins
        WHERE id = ?
        LIMIT 1
    `;

    db.query(
        sql,
        [adminId],
        (err, results) => {

            if (err) {

                console.error(
                    "Admin Profile Database Error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Database error"
                });
            }


            if (results.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }


            const admin = results[0];


            return res.status(200).json({

                success: true,

                admin: {

                    id: admin.id,
                    name: admin.name,
                    email: admin.email,
                    phone: admin.phone

                }

            });

        }
    );

};


// =====================================================
// UPDATE ADMIN PROFILE
// =====================================================

const updateAdminProfile = (req, res) => {

    const adminId = req.user.id;

    const {
        name,
        email,
        phone
    } = req.body;


    if (!name || !email || !phone) {

        return res.status(400).json({

            success: false,

            message:
                "Name, email and phone are required"

        });

    }


    const sql = `
        UPDATE admins
        SET
            name = ?,
            email = ?,
            phone = ?
        WHERE id = ?
    `;


    db.query(
        sql,
        [
            name,
            email,
            phone,
            adminId
        ],
        (err, result) => {

            if (err) {

                console.error(
                    "Admin Profile Update Error:",
                    err
                );

                return res.status(500).json({

                    success: false,

                    message: "Database error"

                });
            }


            if (result.affectedRows === 0) {

                return res.status(404).json({

                    success: false,

                    message: "Admin not found"

                });

            }


            return res.status(200).json({

                success: true,

                message:
                    "Admin profile updated successfully"

            });

        }
    );

};


// =====================================================
// CHANGE ADMIN PASSWORD
// =====================================================

const changeAdminPassword = async (req, res) => {

    try {

        const adminId = req.user.id;

        const {
            currentPassword,
            newPassword,
            confirmPassword
        } = req.body;


        // =================================================
        // VALIDATION
        // =================================================

        if (
            !currentPassword ||
            !newPassword ||
            !confirmPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "All password fields are required"

            });

        }


        // =================================================
        // PASSWORD LENGTH
        // =================================================

        if (newPassword.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "New password must be at least 6 characters"

            });

        }


        // =================================================
        // CONFIRM PASSWORD
        // =================================================

        if (newPassword !== confirmPassword) {

            return res.status(400).json({

                success: false,

                message:
                    "New password and confirm password do not match"

            });

        }


        // =================================================
        // GET CURRENT PASSWORD
        // =================================================

        const selectSql = `
            SELECT
                id,
                password
            FROM admins
            WHERE id = ?
            LIMIT 1
        `;


        db.query(
            selectSql,
            [adminId],
            async (err, results) => {

                if (err) {

                    console.error(
                        "Admin Password Database Error:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message: "Database error"

                    });

                }


                // =============================================
                // ADMIN NOT FOUND
                // =============================================

                if (results.length === 0) {

                    return res.status(404).json({

                        success: false,

                        message: "Admin not found"

                    });

                }


                const admin = results[0];


                // =============================================
                // CHECK CURRENT PASSWORD
                // =============================================

                const passwordMatch =
                    await bcrypt.compare(
                        currentPassword,
                        admin.password
                    );


                if (!passwordMatch) {

                    return res.status(401).json({

                        success: false,

                        message:
                            "Current password is incorrect"

                    });

                }


                // =============================================
                // HASH NEW PASSWORD
                // =============================================

                const hashedPassword =
                    await bcrypt.hash(
                        newPassword,
                        10
                    );


                // =============================================
                // UPDATE PASSWORD
                // =============================================

                const updateSql = `
                    UPDATE admins
                    SET password = ?
                    WHERE id = ?
                `;


                db.query(
                    updateSql,
                    [
                        hashedPassword,
                        adminId
                    ],
                    (updateErr, updateResult) => {

                        if (updateErr) {

                            console.error(
                                "Admin Password Update Error:",
                                updateErr
                            );

                            return res.status(500).json({

                                success: false,

                                message:
                                    "Failed to update password"

                            });

                        }


                        if (
                            updateResult.affectedRows === 0
                        ) {

                            return res.status(404).json({

                                success: false,

                                message:
                                    "Admin not found"

                            });

                        }


                        return res.status(200).json({

                            success: true,

                            message:
                                "Password changed successfully"

                        });

                    }
                );

            }
        );


    } catch (error) {

        console.error(
            "Change Admin Password Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    getAdminProfile,

    updateAdminProfile,

    changeAdminPassword

};