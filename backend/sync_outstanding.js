const mssql = require('mssql');
require('dotenv').config({ path: '.env' });

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: { encrypt: true, trustServerCertificate: true }
};

async function run() {
    try {
        await mssql.connect(dbConfig);
        console.log("Connected to DB to sync OutStanding table...");
        
        try {
            await mssql.query(`ALTER TABLE [OutStanding] ALTER COLUMN [Ref_No] VARCHAR(50)`);
            console.log("Expanded Ref_No column limit.");
        } catch (e) {
            console.log("Column resize skipped/unnecessary.", e.message);
        }

        const query = `
            INSERT INTO [OutStanding] (
                [S_Order], 
                [Ref_No], 
                [Tr_Date], 
                [Tr_Type], 
                [Customer_Name], 
                [Net_Amount], 
                [Paid_Amount]
            )
            SELECT 
                nso.[S_Order],
                nso.[S_Order], 
                nso.[Tr_Date],
                'SO', 
                nso.[Customer_Name],
                nso.[Rate],
                0 
            FROM [New_Sales_Order] nso
            LEFT JOIN [OutStanding] o 
                ON nso.[S_Order] = o.[S_Order]
            WHERE o.[S_Order] IS NULL 
              AND LTRIM(RTRIM(nso.[Status])) = 'A';
        `;

        const result = await mssql.query(query);
        console.log("Success! Inserted rows: " + result.rowsAffected);
    } catch (err) {
        console.error("Error executing query:", err.message);
    } finally {
        mssql.close();
    }
}

run();
