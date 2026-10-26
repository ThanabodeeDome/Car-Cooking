-- Run once on the PRODUCTION CarBookingDB (idempotent: safe to run twice).
-- Adds: remember-me tokens, system feedback (thumbs up/down).
USE CarBookingDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RememberTokens')
BEGIN
    CREATE TABLE RememberTokens (
        id INT IDENTITY PRIMARY KEY,
        user_id INT NOT NULL,
        selector VARCHAR(24) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_RememberTokens_Users FOREIGN KEY (user_id) REFERENCES Users(id)
    );
    CREATE UNIQUE INDEX IX_RememberTokens_Selector ON RememberTokens(selector);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CarBookings') AND name = 'SystemFeedback')
    ALTER TABLE CarBookings ADD SystemFeedback VARCHAR(10) NULL;
GO

-- Optional housekeeping: purge expired remember-me tokens
-- DELETE FROM RememberTokens WHERE expires_at < GETDATE();

-- ===== GPS stamp at check-in / return (added 2026-09-20) =====
-- Geo = 'ok' (inside a site radius) | 'far' (outside) | 'none' (no location) | 'nosite' (no site configured yet)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CarBookings') AND name = 'CheckInLat')
BEGIN
    ALTER TABLE CarBookings ADD
        CheckInLat DECIMAL(9,6) NULL, CheckInLng DECIMAL(9,6) NULL, CheckInAcc INT NULL,
        CheckInGeo VARCHAR(10) NULL, CheckInDist INT NULL,
        ReturnLat DECIMAL(9,6) NULL, ReturnLng DECIMAL(9,6) NULL, ReturnAcc INT NULL,
        ReturnGeo VARCHAR(10) NULL, ReturnDist INT NULL;
END
GO
