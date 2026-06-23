const express = require("express");
const mssql = require("mssql");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());

// Database configuration for Cloud SQL Server
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true, // Required for cloud clusters
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

console.log(
  `Connecting to Cloud SQL Server at ${dbConfig.server}:${dbConfig.port}...`,
);

// Connect to MSSQL
const poolPromise = new mssql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log("✅ --- Database Connection Verified --- 🚀");
    console.log("✅ Connected to MSSQL Successfully! 💾🚀");
    return pool;
  })
  .catch((err) => {
    console.error("❌ Database Connection Failed! Please check: ⚠️");
    console.error("1️⃣ SQL Server is running. 🟢");
    console.error("2. TCP/IP is enabled in SQL Server Configuration Manager.");
    console.error("3. Port 1433 is open.");
    console.error("Error Details:", err.message);
  });

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- API ROUTES ---

// Login - Check username/password directly from DB
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("username", mssql.VarChar, username)
      .input("password", mssql.VarChar, password)
      .query(
        "SELECT * FROM Users WHERE Username = @username AND Password = @password",
      );

    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      const token = jwt.sign(
        { id: user.ID, username: user.Username },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );
      res.json({ token, user: { id: user.ID, username: user.Username } });
    } else {
      res.status(401).json({ message: "Invalid username or password ⚠️" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Logout - Placeholder for backend operation (logging, session invalidation if using DB)
app.post("/logout", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const username = req.user.username;
    // Optionally log the logout action
    await pool
      .request()
      .input("username", mssql.VarChar, username)
      .input("action", mssql.VarChar, "User Logged Out")
      .query(
        "INSERT INTO User_Logging (Username, Action) VALUES (@username, @action)",
      );

    res.json({ message: "Logged out successfully✅" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Quotations - List all with customer info
app.get("/quotations", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT Q.ID, Q.S_Order, Q.Q_No, Q.Tr_Date, Q.Item_Name, Q.Rate, Q.Status, 
                   NS.Customer_Name, NS.Quatation_Status, NS.Costing_Status
            FROM Quatation Q 
            OUTER APPLY (
                SELECT TOP 1 Customer_Name, Quatation_Status, Costing_Status
                FROM New_Sales_Order
                WHERE S_Order = Q.S_Order
            ) NS
            WHERE LTRIM(RTRIM(Q.Status)) = 'A'
            ORDER BY Q.Tr_Date DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/quotations/:id/approve", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    // First get the S_Order for this quotation
    const quotResult = await pool
      .request()
      .input("id", mssql.Int, req.params.id)
      .query("SELECT S_Order FROM Quatation WHERE ID = @id");

    if (quotResult.recordset.length === 0) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const sOrder = quotResult.recordset[0].S_Order;

    const transaction = new mssql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE Quatation SET Status = 'Approved' WHERE S_Order = @sOrder",
        );

      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE New_Sales_Order SET Quatation_Status = 'Approved' WHERE S_Order = @sOrder",
        );

      await transaction.commit();
      io.emit("DATA_UPDATED");
      res.json({ message: "Quotation approved and synced✅" });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/quotations/:id/reject", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const quotResult = await pool
      .request()
      .input("id", mssql.Int, req.params.id)
      .query("SELECT S_Order FROM Quatation WHERE ID = @id");

    if (quotResult.recordset.length === 0) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const sOrder = quotResult.recordset[0].S_Order;

    const transaction = new mssql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE Quatation SET Status = 'Rejected' WHERE S_Order = @sOrder",
        );

      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE New_Sales_Order SET Quatation_Status = 'Rejected' WHERE S_Order = @sOrder",
        );

      await transaction.commit();
      io.emit("DATA_UPDATED");
      res.json({ message: "Quotation rejected and synced❌" });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/costings", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT PC.ID, PC.S_Order, PC.Item_Name, PC.Material_Name, PC.Rate, PC.Qty, PC.Total, PC.Status, LTRIM(RTRIM(PC.Unit)) AS Unit,
                   NS.Customer_Name, NS.Costing_Status, NS.Quatation_Status,
                   PH.Electricity, PH.Other, PH.Transport, PH.Labour, PH.Finishing, PH.OS_Machine
            FROM Pre_Costing PC
            OUTER APPLY (
                SELECT TOP 1 Customer_Name, Costing_Status, Quatation_Status
                FROM New_Sales_Order
                WHERE S_Order = PC.S_Order
            ) NS
            OUTER APPLY (
                SELECT TOP 1 Electricity, Other, Transport, Labour, Finishing, OS_Machine
                FROM PreCosting_H
                WHERE S_Order = PC.S_Order
            ) PH
            WHERE LTRIM(RTRIM(PC.Status)) = 'A'
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/costings/:id/approve", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const costResult = await pool
      .request()
      .input("id", mssql.Int, req.params.id)
      .query("SELECT S_Order FROM Pre_Costing WHERE ID = @id");

    if (costResult.recordset.length === 0) {
      return res.status(404).json({ message: "Costing not found" });
    }

    const sOrder = costResult.recordset[0].S_Order;

    const transaction = new mssql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE Pre_Costing SET Status = 'Approved' WHERE S_Order = @sOrder",
        );

      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE PreCosting_H SET Status = 'Approved' WHERE S_Order = @sOrder",
        );

      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE New_Sales_Order SET Costing_Status = 'Approved' WHERE S_Order = @sOrder",
        );

      await transaction.commit();
      io.emit("DATA_UPDATED");
      res.json({ message: "Costing approved and synced✅" });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/costings/:id/reject", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const costResult = await pool
      .request()
      .input("id", mssql.Int, req.params.id)
      .query("SELECT S_Order FROM Pre_Costing WHERE ID = @id");

    if (costResult.recordset.length === 0) {
      return res.status(404).json({ message: "Costing not found" });
    }

    const sOrder = costResult.recordset[0].S_Order;

    const transaction = new mssql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE Pre_Costing SET Status = 'Rejected' WHERE S_Order = @sOrder",
        );

      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE PreCosting_H SET Status = 'Rejected' WHERE S_Order = @sOrder",
        );

      await transaction
        .request()
        .input("sOrder", mssql.VarChar, sOrder)
        .query(
          "UPDATE New_Sales_Order SET Costing_Status = 'Rejected' WHERE S_Order = @sOrder",
        );

      await transaction.commit();
      res.json({ message: "Costing rejected and synced❌" });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route: Sales Orders
app.get("/sales-orders", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
                SELECT NS.*, COALESCE(O.Net_Amount - O.Paid_Amount, 0) as Outstanding_Balance
                FROM New_Sales_Order NS
                LEFT JOIN Outstanding O ON NS.S_Order = O.S_Order
                WHERE LTRIM(RTRIM(NS.Status)) = 'A'
                ORDER BY NS.Tr_Date DESC
            `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put(
  "/sales-orders/:id/approve-costing",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query(
          "UPDATE New_Sales_Order SET Costing_Status = 'Approved' WHERE ID = @id",
        );
      res.json({ message: "Costing status approved✅" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

app.put(
  "/sales-orders/:id/reject-costing",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query(
          "UPDATE New_Sales_Order SET Costing_Status = 'Rejected' WHERE ID = @id",
        );
      res.json({ message: "Costing status rejected❌" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

app.put(
  "/sales-orders/:id/approve-quotation",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query(
          "UPDATE New_Sales_Order SET Quatation_Status = 'Approved' WHERE ID = @id",
        );
      res.json({ message: "Quotation status approved✅" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

app.put(
  "/sales-orders/:id/reject-quotation",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query(
          "UPDATE New_Sales_Order SET Quatation_Status = 'Rejected' WHERE ID = @id",
        );
      res.json({ message: "Quotation status rejected❌" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// Route: Dashboard
app.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;

    // Sales Orders Stats
    const salesStats = await pool.request().query(`
            SELECT 
                COUNT(*) as TotalOrders,
                SUM(Rate) as TotalValue
            FROM New_Sales_Order
            WHERE LTRIM(RTRIM(Status)) = 'A'
        `);

    // Open Costings from Pre_Costing table
    const costingCount = await pool
      .request()
      .query(
        "SELECT COUNT(*) as count FROM Pre_Costing WHERE LTRIM(RTRIM(Status)) = 'A'",
      );
    // Open Quotations from Quatation table
    const quotationCount = await pool
      .request()
      .query(
        "SELECT COUNT(*) as count FROM Quatation WHERE LTRIM(RTRIM(Status)) = 'A'",
      );

    // Pending Payments aggregation
    const supplierPayCount = await pool
      .request()
      .query(
        "SELECT COUNT(*) as count FROM Supplier_payment_H WHERE Approvel = 'READY'",
      );
    const techPayCount = await pool
      .request()
      .query(
        "SELECT COUNT(*) as count FROM Outside_Technician_Pay WHERE Status = 'READY'",
      );
    const voucherPayCount = await pool
      .request()
      .query(
        "SELECT COUNT(*) as count FROM Payment_Voucher WHERE Status = 'READY'",
      );

    // Pending Cheques aggregation
    const supplierChqCount = await pool
      .request()
      .query("SELECT COUNT(*) as count FROM Supplier_Payment_Cheq_D");
    const voucherChqCount = await pool
      .request()
      .query("SELECT COUNT(*) as count FROM Payment_Voucher_Chq");

    const ahCounts = await Promise.all([
      pool.request().query("SELECT COUNT(*) as count FROM Pre_Costing WHERE LTRIM(RTRIM(Status)) IN ('Approved', 'A')"),
      pool.request().query("SELECT COUNT(*) as count FROM Pre_Costing WHERE LTRIM(RTRIM(Status)) = 'Rejected'"),
      pool.request().query("SELECT COUNT(*) as count FROM Quatation WHERE LTRIM(RTRIM(Status)) IN ('Approved', 'A')"),
      pool.request().query("SELECT COUNT(*) as count FROM Quatation WHERE LTRIM(RTRIM(Status)) = 'Rejected'"),
      pool.request().query("SELECT COUNT(*) as count FROM Supplier_payment_H WHERE LTRIM(RTRIM(Approvel)) IN ('Approved', 'A')"),
      pool.request().query("SELECT COUNT(*) as count FROM Supplier_payment_H WHERE LTRIM(RTRIM(Approvel)) = 'Rejected'"),
      pool.request().query("SELECT COUNT(*) as count FROM Outside_Technician_Pay WHERE LTRIM(RTRIM(Status)) IN ('Approved', 'A')"),
      pool.request().query("SELECT COUNT(*) as count FROM Outside_Technician_Pay WHERE LTRIM(RTRIM(Status)) = 'Rejected'"),
      pool.request().query("SELECT COUNT(*) as count FROM Payment_Voucher WHERE LTRIM(RTRIM(Status)) IN ('Approved', 'A')"),
      pool.request().query("SELECT COUNT(*) as count FROM Payment_Voucher WHERE LTRIM(RTRIM(Status)) = 'Rejected'")
    ]);

    const approvalHubStats = {
      Costing: { Approved: ahCounts[0].recordset[0].count, Rejected: ahCounts[1].recordset[0].count },
      Quotations: { Approved: ahCounts[2].recordset[0].count, Rejected: ahCounts[3].recordset[0].count },
      Supplier: { Approved: ahCounts[4].recordset[0].count, Rejected: ahCounts[5].recordset[0].count },
      Technician: { Approved: ahCounts[6].recordset[0].count, Rejected: ahCounts[7].recordset[0].count },
      Voucher: { Approved: ahCounts[8].recordset[0].count, Rejected: ahCounts[9].recordset[0].count }
    };

    const summary = {
      TotalOrders: salesStats.recordset[0].TotalOrders || 0,
      ReadyCostings: costingCount.recordset[0].count || 0,
      ReadyQuotations: quotationCount.recordset[0].count || 0,
      PendingPayments:
        (supplierPayCount.recordset[0].count || 0) +
        (techPayCount.recordset[0].count || 0) +
        (voucherPayCount.recordset[0].count || 0),
      PendingCheques:
        (supplierChqCount.recordset[0].count || 0) +
        (voucherChqCount.recordset[0].count || 0),
      TotalValue: salesStats.recordset[0].TotalValue || 0,
      SupplierPending: supplierPayCount.recordset[0].count || 0,
      TechPending: techPayCount.recordset[0].count || 0,
      VoucherPending: voucherPayCount.recordset[0].count || 0,
      ApprovalHubStats: approvalHubStats,
    };

    const outstandingStats = await pool.request().query(`
            SELECT 
                SUM(Net_Amount) as TotalNet,
                SUM(Paid_Amount) as TotalPaid,
                SUM(Net_Amount - Paid_Amount) as TotalBalance
            FROM OutStanding
        `);
    console.log("Outstanding Stats Found:", outstandingStats.recordset[0]);

    // Outstanding List - Fetch individual records for the modal
    const outstandingList = await pool.request().query(`
            SELECT 
                ID, S_Order, Ref_No, Tr_Date, Tr_Type, Customer_Name, Net_Amount, Paid_Amount,
                (Net_Amount - Paid_Amount) as Balance
            FROM OutStanding
            ORDER BY Tr_Date DESC
        `);
    console.log("Outstanding List Rows:", outstandingList.recordset.length);

    // Approved History - latest 10 approved items with clear type and accurate ranking
    const history = await pool.request().query(`
            SELECT TOP 10 
                ID, S_Order, Customer_Name, Product_Name, Rate, Tr_Date,
                CASE 
                    WHEN LTRIM(RTRIM(Quatation_Status)) = 'Approved' AND LTRIM(RTRIM(Costing_Status)) = 'Approved' THEN 'Both'
                    WHEN LTRIM(RTRIM(Quatation_Status)) = 'Approved' THEN 'Quotation'
                    WHEN LTRIM(RTRIM(Costing_Status)) = 'Approved' THEN 'Costing'
                    ELSE 'Order'
                END as ApprovedType
            FROM New_Sales_Order
            WHERE LTRIM(RTRIM(Status)) = 'A' 
              AND (LTRIM(RTRIM(Costing_Status)) = 'Approved' OR LTRIM(RTRIM(Quatation_Status)) = 'Approved')
            ORDER BY Tr_Date DESC, ID DESC
        `);

    res.json({
      summary: summary,
      outstanding: outstandingStats.recordset[0] || {
        TotalNet: 0,
        TotalPaid: 0,
        TotalBalance: 0,
      },
      outstandingList: outstandingList.recordset || [],
      history: history.recordset,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route: Active Orders
app.get("/active-orders", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const activeOrders = await pool.request().query(`
            SELECT ID, S_Order, Customer_Name, Product_Name, Rate, Tr_Date
            FROM New_Sales_Order
            WHERE LTRIM(RTRIM(Status)) = 'A'
            ORDER BY Tr_Date DESC
        `);
    res.json(activeOrders.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route: Approval Hub Category Details
app.get("/approval-hub/:category", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const category = req.params.category;
    let query = "";

    if (category === "Costing") {
      query = "SELECT ID, S_Order as OrderNo, Item_Name as Product, Total as Rate, LTRIM(RTRIM(Status)) as Status, Tr_Date as Date FROM Pre_Costing WHERE LTRIM(RTRIM(Status)) IN ('Approved', 'A', 'Rejected') ORDER BY Tr_Date DESC";
    } else if (category === "Quotations") {
      query = "SELECT ID, S_Order as OrderNo, Item_Name as Product, Rate, LTRIM(RTRIM(Status)) as Status, Tr_Date as Date FROM Quatation WHERE LTRIM(RTRIM(Status)) IN ('Approved', 'A', 'Rejected') ORDER BY Tr_Date DESC";
    } else if (category === "Supplier") {
      query = "SELECT ID, Pay_No as OrderNo, Supplier_Name as Product, Amount as Rate, LTRIM(RTRIM(Approvel)) as Status, Tr_Date as Date FROM Supplier_payment_H WHERE LTRIM(RTRIM(Approvel)) IN ('Approved', 'A', 'Rejected') ORDER BY Tr_Date DESC";
    } else if (category === "Technician") {
      query = "SELECT ID, S_Order as OrderNo, Technician_Name as Product, Amount as Rate, LTRIM(RTRIM(Status)) as Status, Tr_Date as Date FROM Outside_Technician_Pay WHERE LTRIM(RTRIM(Status)) IN ('Approved', 'A', 'Rejected') ORDER BY Tr_Date DESC";
    } else if (category === "Voucher") {
      query = "SELECT ID, Voucher_No as OrderNo, Acc_Name as Product, Amount as Rate, LTRIM(RTRIM(Status)) as Status, Tr_Date as Date FROM Payment_Voucher WHERE LTRIM(RTRIM(Status)) IN ('Approved', 'A', 'Rejected') ORDER BY Tr_Date DESC";
    } else {
      return res.status(400).json({ message: "Invalid category" });
    }
    
    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Supplier Payments Endpoints ---

// List all payments (join with details for count or simple list)
app.get("/supplier-payments", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT H.ID, H.GRN_No, H.Pay_No, H.Tr_Date, H.Supplier_Name, H.Pay_Type, H.Amount, H.Approvel,
                   (SELECT COUNT(*) FROM Supplier_Payment_Cheq_D d WHERE d.Pay_No = H.Pay_No) as ChequeCount
            FROM Supplier_payment_H H
            WHERE H.Approvel = 'READY'
            ORDER BY H.Tr_Date DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get payment details (cheques)
app.get(
  "/supplier-payments/:payNo/details",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("payNo", mssql.VarChar, req.params.payNo)
        .query(
          "SELECT * FROM Supplier_Payment_Cheq_D WHERE LTRIM(RTRIM(Pay_No)) = @payNo",
        );
      res.json(result.recordset);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

app.put(
  "/supplier-payments/:id/approve",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query(
          "UPDATE Supplier_payment_H SET Approvel = 'Approved' WHERE ID = @id",
        );
      res.json({ message: "Payment approved successfully✅" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

app.put(
  "/supplier-payments/:id/reject",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query(
          "UPDATE Supplier_payment_H SET Approvel = 'Rejected' WHERE ID = @id",
        );
      res.json({ message: "Payment rejected successfully❌" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// Helper for standalone counts if needed specifically
app.get(
  "/api/supplier-payments/pending-count",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .query(
          "SELECT COUNT(*) as count FROM Supplier_payment_H WHERE Approvel = 'READY'",
        );
      res.json({ count: result.recordset[0].count });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

app.get(
  "/api/supplier-payments/cheque-count",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .query("SELECT COUNT(*) as count FROM Supplier_Payment_Cheq_D");
      res.json({ count: result.recordset[0].count });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// --- Technician Payments Endpoints ---

app.get("/technician-payments", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT ID, Voucher_No, S_Order, Tr_Date, Tr_Type, Technician_Name, Tobe_Paid, Amount, Status
            FROM Outside_Technician_Pay
            WHERE Status = 'READY'
            ORDER BY Tr_Date DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put(
  "/technician-payments/:id/approve",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query(
          "UPDATE Outside_Technician_Pay SET Status = 'Approved' WHERE ID = @id",
        );
      io.emit("DATA_UPDATED");
      res.json({ message: "Technician payment approved successfully✅" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

app.put(
  "/technician-payments/:id/reject",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query(
          "UPDATE Outside_Technician_Pay SET Status = 'Rejected' WHERE ID = @id",
        );
      res.json({ message: "Technician payment rejected successfully❌" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

// --- General Payments (Voucher) Endpoints ---

app.get("/voucher-payments", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT H.ID, H.Voucher_No, H.Tr_Type, H.Tr_Date, H.Acc_Name, H.Amount, H.Status,
                   (SELECT COUNT(*) FROM Payment_Voucher_Chq d WHERE d.Pay_No = H.Voucher_No) as ChequeCount
            FROM Payment_Voucher H
            WHERE H.Status = 'READY'
            ORDER BY H.Tr_Date DESC
        `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get(
  "/voucher-payments/:voucherNo/details",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("voucherNo", mssql.NChar, req.params.voucherNo)
        .query(
          "SELECT * FROM Payment_Voucher_Chq WHERE LTRIM(RTRIM(Pay_No)) = @voucherNo",
        );
      res.json(result.recordset);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

app.put(
  "/voucher-payments/:id/approve",
  authenticateToken,
  async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("id", mssql.Int, req.params.id)
        .query("UPDATE Payment_Voucher SET Status = 'Approved' WHERE ID = @id");
      io.emit("DATA_UPDATED");
      res.json({ message: "Voucher payment approved successfully✅" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
);

app.put("/voucher-payments/:id/reject", authenticateToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", mssql.Int, req.params.id)
      .query("UPDATE Payment_Voucher SET Status = 'Rejected' WHERE ID = @id");
    res.json({ message: "Voucher payment rejected successfully❌" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const PORT = process.env.PORT || 5000;

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Menama backend running 🚀",
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Menama Backend running on port ${PORT} with Socket.io Support 🚀`,
  );
});
