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
        const queries = [
            "INSERT INTO Outside_Technician_Pay (Voucher_No, S_Order, Tr_Type, Tr_Date, Technician_Name, Tobe_Paid, Amount, Status) VALUES ('TV001', 'SO-101', 'Contract', GETDATE(), 'Kamal Perera', 15000, 15000, 'READY')",
            "INSERT INTO Outside_Technician_Pay (Voucher_No, S_Order, Tr_Type, Tr_Date, Technician_Name, Tobe_Paid, Amount, Status) VALUES ('TV002', 'SO-102', 'DayWork', GETDATE(), 'Sunil Shantha', 25000, 25000, 'READY')",
            "INSERT INTO Payment_Voucher (Voucher_No, Tr_Type, Tr_Date, Acc_Name, Amount, Status) VALUES ('V001', 'General', GETDATE(), 'Office Rent', 55000, 'READY')",
            "INSERT INTO Payment_Voucher (Voucher_No, Tr_Type, Tr_Date, Acc_Name, Amount, Status) VALUES ('V002', 'Utility', GETDATE(), 'Electricity Bill', 12500, 'READY')",
            "INSERT INTO Payment_Voucher_Chq (Pay_No, Acc_No, Chq_No, Amount) VALUES ('V001', '800123', 'CHQ9988', 55000)",
            "INSERT INTO Supplier_Payment_Cheq_D (Pay_No, Acc_No, Chq_No, DOR, Amount) VALUES ('CHQ/001', '900456', 'SUPP-CHQ-1', GETDATE(), 75000)",
            "INSERT INTO Supplier_Payment_Cheq_D (Pay_No, Acc_No, Chq_No, DOR, Amount) VALUES ('PV-2026-002', '900457', 'SUPP-CHQ-2', GETDATE(), 45000)"
        ];
        for (const q of queries) {
            try {
                await mssql.query(q);
                console.log('Executed: ' + q);
            } catch (e) {
                console.warn('Skipped (likely already exists): ' + q);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
