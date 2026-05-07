USE Menama_Cloud;

-- Create Users table (for authentication)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
    CREATE TABLE Users (
        ID INT PRIMARY KEY IDENTITY(1,1),
        Username VARCHAR(50) UNIQUE,
        Password VARCHAR(50)
    );
END

-- Insert initial user (menama/1234)
IF NOT EXISTS (SELECT * FROM Users WHERE Username = 'menama')
BEGIN
    INSERT INTO Users (Username, Password) VALUES ('menama', '1234');
END

-- Create User_Logging table (as requested, for audit/actions)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='User_Logging' AND xtype='U')
BEGIN
    CREATE TABLE User_Logging (
        LogID INT PRIMARY KEY IDENTITY(1,1),
        Username VARCHAR(50),
        Action VARCHAR(250),
        LogDate DATETIME DEFAULT GETDATE()
    );
END

-- Optional: Dummy data for testing if tables are empty
IF EXISTS (SELECT * FROM sysobjects WHERE name='Quatation' AND xtype='U')
BEGIN
    IF (SELECT COUNT(*) FROM Quatation) = 0
    INSERT INTO Quatation (S_Order, Q_No, Tr_Date, Item_Name, Rate, Status) 
    VALUES ('ORD101', 'Q001', GETDATE(), 'Sample Product', 1500.00, 'Pending');
END

IF EXISTS (SELECT * FROM sysobjects WHERE name='Pre_Costing' AND xtype='U')
BEGIN
    IF (SELECT COUNT(*) FROM Pre_Costing) = 0
    INSERT INTO Pre_Costing (S_Order, Item_Name, Material_Name, Rate, Qty, Total, Status) 
    VALUES ('ORD101', 'Sample Product', 'Steel', 500.00, 2, 1000.00, 'Pending');
END

IF EXISTS (SELECT * FROM sysobjects WHERE name='OutStanding' AND xtype='U')
BEGIN
    IF (SELECT COUNT(*) FROM OutStanding) = 0
    INSERT INTO OutStanding (S_Order, Ref_No, Tr_Date, Tr_Type, Customer_Name, Net_Amount, Paid_Amount) 
    VALUES ('ORD101', 'REF101', GETDATE(), 'Sale', 'TechNova Solutions', 1500.00, 0.00);
END
