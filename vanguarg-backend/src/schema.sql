IF OBJECT_ID('dbo.Users','U') IS NULL
CREATE TABLE dbo.Users (
  Id          INT IDENTITY(1,1) PRIMARY KEY,
  ClerkUserId NVARCHAR(100) NOT NULL UNIQUE,
  FullName    NVARCHAR(120) NULL,
  Email       NVARCHAR(200) NULL,
  Role        NVARCHAR(20)  NOT NULL CONSTRAINT DF_Users_Role DEFAULT 'client',
  CreatedAt   DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Users_Role CHECK (Role IN ('owner','client','admin'))
);

IF OBJECT_ID('dbo.Properties','U') IS NULL
CREATE TABLE dbo.Properties (
  Id           INT IDENTITY(1,1) PRIMARY KEY,
  OwnerId      INT NOT NULL REFERENCES dbo.Users(Id),
  ClientId     INT NULL REFERENCES dbo.Users(Id),
  Title        NVARCHAR(200) NOT NULL,
  TitleEn      NVARCHAR(200) NULL,
  Description  NVARCHAR(MAX) NULL,
  Price        DECIMAL(12,2) NOT NULL,
  ListingType  NVARCHAR(20) NOT NULL CONSTRAINT DF_Properties_ListingType DEFAULT 'sale',
  AreaM2       DECIMAL(8,2) NULL,
  Rooms        INT NULL,
  City         NVARCHAR(100) NOT NULL,
  CityId       NVARCHAR(80) NULL,
  Neighborhood NVARCHAR(100) NULL,
  PlaceId      NVARCHAR(80) NULL,
  Address      NVARCHAR(200) NULL,
  Lat          DECIMAL(9,6) NULL,
  Lng          DECIMAL(9,6) NULL,
  Status       NVARCHAR(20) NOT NULL CONSTRAINT DF_Properties_Status DEFAULT 'available',
  Visibility   NVARCHAR(20) NOT NULL CONSTRAINT DF_Properties_Visibility DEFAULT 'public',
  CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_Properties_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Properties_ListingType CHECK (ListingType IN ('sale','rent')),
  CONSTRAINT CK_Properties_Status CHECK (Status IN ('available','sold','rented')),
  CONSTRAINT CK_Properties_Visibility CHECK (Visibility IN ('public','private')),
  CONSTRAINT CK_Properties_Price CHECK (Price > 0),
  CONSTRAINT CK_Properties_Rooms CHECK (Rooms IS NULL OR Rooms > 0),
  CONSTRAINT CK_Properties_Area CHECK (AreaM2 IS NULL OR AreaM2 > 0)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Properties_Location')
CREATE INDEX IX_Properties_Location ON dbo.Properties (City, Neighborhood);

IF OBJECT_ID('dbo.PropertyImages','U') IS NULL
CREATE TABLE dbo.PropertyImages (
  Id         INT IDENTITY(1,1) PRIMARY KEY,
  PropertyId INT NOT NULL REFERENCES dbo.Properties(Id) ON DELETE CASCADE,
  Url        NVARCHAR(400) NOT NULL,
  IsCover    BIT NOT NULL CONSTRAINT DF_PropertyImages_IsCover DEFAULT 0,
  SortOrder  INT NOT NULL CONSTRAINT DF_PropertyImages_SortOrder DEFAULT 0
);

IF OBJECT_ID('dbo.Messages','U') IS NULL
CREATE TABLE dbo.Messages (
  Id         INT IDENTITY(1,1) PRIMARY KEY,
  SenderId   INT NOT NULL REFERENCES dbo.Users(Id),
  ReceiverId INT NOT NULL REFERENCES dbo.Users(Id),
  PropertyId INT NULL REFERENCES dbo.Properties(Id) ON DELETE SET NULL,
  Body       NVARCHAR(2000) NOT NULL,
  IsRead     BIT NOT NULL CONSTRAINT DF_Messages_IsRead DEFAULT 0,
  SentAt     DATETIME2 NOT NULL CONSTRAINT DF_Messages_SentAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Messages_Participants CHECK (SenderId <> ReceiverId)
);

IF OBJECT_ID('dbo.Issues','U') IS NULL
CREATE TABLE dbo.Issues (
  Id          INT IDENTITY(1,1) PRIMARY KEY,
  ClientId    INT NOT NULL REFERENCES dbo.Users(Id),
  PropertyId  INT NOT NULL REFERENCES dbo.Properties(Id),
  Category    NVARCHAR(40) NOT NULL,
  Description NVARCHAR(2000) NOT NULL,
  Status      NVARCHAR(20) NOT NULL CONSTRAINT DF_Issues_Status DEFAULT 'new',
  CreatedAt   DATETIME2 NOT NULL CONSTRAINT DF_Issues_CreatedAt DEFAULT SYSUTCDATETIME(),
  ResolvedAt  DATETIME2 NULL,
  CONSTRAINT CK_Issues_Status CHECK (Status IN ('new','in_progress','resolved'))
);

-- Rregullime për tabelat që ekzistojnë tashmë
IF COL_LENGTH('dbo.Properties', 'TitleEn') IS NULL
  ALTER TABLE dbo.Properties ADD TitleEn NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Properties', 'CityId') IS NULL
  ALTER TABLE dbo.Properties ADD CityId NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.Properties', 'PlaceId') IS NULL
  ALTER TABLE dbo.Properties ADD PlaceId NVARCHAR(80) NULL;
IF COL_LENGTH('dbo.Properties', 'Visibility') IS NULL
  ALTER TABLE dbo.Properties ADD Visibility NVARCHAR(20) NOT NULL CONSTRAINT DF_Properties_Visibility DEFAULT 'public';
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Properties_Visibility')
  ALTER TABLE dbo.Properties ADD CONSTRAINT CK_Properties_Visibility CHECK (Visibility IN ('public','private'));

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Properties_Place')
  CREATE INDEX IX_Properties_Place ON dbo.Properties (CityId, PlaceId);

DECLARE @dropType nvarchar(max) = N'';
SELECT @dropType = @dropType + N'ALTER TABLE dbo.Properties DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.Properties')
  AND cc.definition LIKE '%PropertyType%';
SELECT @dropType = @dropType + N'ALTER TABLE dbo.Properties DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.Properties') AND c.name = 'PropertyType';
IF @dropType <> N'' EXEC sp_executesql @dropType;

IF COL_LENGTH('dbo.Properties', 'PropertyType') IS NOT NULL
  ALTER TABLE dbo.Properties DROP COLUMN PropertyType;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Properties_Price')
  ALTER TABLE dbo.Properties ADD CONSTRAINT CK_Properties_Price CHECK (Price > 0);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Properties_Rooms')
  ALTER TABLE dbo.Properties ADD CONSTRAINT CK_Properties_Rooms CHECK (Rooms IS NULL OR Rooms > 0);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Properties_Area')
  ALTER TABLE dbo.Properties ADD CONSTRAINT CK_Properties_Area CHECK (AreaM2 IS NULL OR AreaM2 > 0);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Messages_Participants')
  ALTER TABLE dbo.Messages ADD CONSTRAINT CK_Messages_Participants CHECK (SenderId <> ReceiverId);

DECLARE @messageFk sysname;
SELECT @messageFk = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.Messages')
  AND c.name = 'PropertyId'
  AND fk.delete_referential_action_desc <> 'SET_NULL';

IF @messageFk IS NOT NULL
BEGIN
  DECLARE @dropFk nvarchar(max) = N'ALTER TABLE dbo.Messages DROP CONSTRAINT ' + QUOTENAME(@messageFk);
  EXEC sp_executesql @dropFk;
END

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.Messages') AND c.name = 'PropertyId'
)
  ALTER TABLE dbo.Messages ADD CONSTRAINT FK_Messages_Property
    FOREIGN KEY (PropertyId) REFERENCES dbo.Properties(Id) ON DELETE SET NULL;

DECLARE @dropRole nvarchar(max) = N'';
SELECT @dropRole = @dropRole + N'ALTER TABLE dbo.Users DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.Users')
  AND cc.definition LIKE '%Role%'
  AND cc.definition NOT LIKE '%admin%';
IF @dropRole <> N'' EXEC sp_executesql @dropRole;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Role')
  ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role
    CHECK (Role IN ('owner','client','admin'));

IF OBJECT_ID('dbo.Services','U') IS NULL
CREATE TABLE dbo.Services (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  SortOrder INT NOT NULL,
  TitleDe   NVARCHAR(160) NOT NULL,
  TitleEn   NVARCHAR(160) NOT NULL,
  TextDe    NVARCHAR(800) NOT NULL,
  TextEn    NVARCHAR(800) NOT NULL
);

IF OBJECT_ID('dbo.PropertyRooms','U') IS NULL
CREATE TABLE dbo.PropertyRooms (
  Id         INT IDENTITY(1,1) PRIMARY KEY,
  PropertyId INT NOT NULL REFERENCES dbo.Properties(Id) ON DELETE CASCADE,
  RoomType   NVARCHAR(40) NOT NULL,
  Quantity   INT NOT NULL,
  CONSTRAINT CK_PropertyRooms_Type CHECK (RoomType IN ('living','bedroom','kitchen','bathroom','wc','balcony')),
  CONSTRAINT CK_PropertyRooms_Qty CHECK (Quantity > 0),
  CONSTRAINT UQ_PropertyRooms UNIQUE (PropertyId, RoomType)
);
