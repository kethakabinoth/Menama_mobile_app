const mssql = require('mssql');
const dotenv = require('dotenv');
dotenv.config({path: '../backend/.env'});

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        await mssql.connect(dbConfig);
        
        console.log('Cleaning and Syncing All Payment Tables...');

        // 1. Supplier Payments
        // Ensure CHQ/001 is consistent at 75,000
        await mssql.query("UPDATE Supplier_payment_H SET Amount = 75000 WHERE RTRIM(Pay_No) = 'CHQ/001'");
        await mssql.query("UPDATE Supplier_Payment_Cheq_D SET Amount = 75000 WHERE RTRIM(Pay_No) = 'CHQ/001'");
        
        // Ensure PV-2026-002 is consistent at 245,000
        await mssql.query("UPDATE Supplier_payment_H SET Amount = 245000 WHERE RTRIM(Pay_No) = 'PV-2026-002'");
        await mssql.query("UPDATE Supplier_Payment_Cheq_D SET Amount = 245000 WHERE RTRIM(Pay_No) = 'PV-2026-002'");

        // 2. Payment Vouchers (General)
        // Match Voucher V001
        await mssql.query("UPDATE Payment_Voucher SET Amount = 55000 WHERE RTRIM(Voucher_No) = 'V001'");
        await mssql.query("UPDATE Payment_Voucher_Chq SET Amount = 55000 WHERE RTRIM(Pay_No) = 'V001'");

        // 3. Update Status and extra info for Technicians
        await mssql.query("UPDATE Outside_Technician_Pay SET Status = 'READY' WHERE Status IS NULL");
        await mssql.query("UPDATE Outside_Technician_Pay SET S_Order = 'SO-2026-099' WHERE S_Order IS NULL");

        console.log('Final Sync Complete.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
