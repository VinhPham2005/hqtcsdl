# Web SQL Query Interface

## 1. Mục tiêu

Xây dựng một trang web đơn giản cho phép người dùng (dùng nodejs):

- Nhập câu truy vấn SQL
- Nhấn nút Execute
- Hệ thống gửi truy vấn đến backend
- Backend truy cập cơ sở dữ liệu SQL Server
- Lấy kết quả và trả về
- Hiển thị kết quả trên trang web

Hệ thống chỉ cho phép thực thi các câu lệnh SELECT để tránh thay đổi dữ liệu hoặc gây lỗi hệ thống.

---

# 2. Ý tưởng hệ thống

Hệ thống được thiết kế theo mô hình Web Client – Backend – Database.

Luồng hoạt động của hệ thống:

Trình duyệt Web  
↓  
Frontend (HTML / JavaScript)  
↓  
Backend API (Java / .NET / Node / PHP)  
↓  
SQL Server Database  
↓  
Kết quả truy vấn (ResultSet)  
↓  
Backend xử lý  
↓  
Trả dữ liệu về Web  
↓  
Hiển thị kết quả

Frontend có nhiệm vụ:

- Nhận câu truy vấn SQL từ người dùng
- Gửi truy vấn đến backend
- Nhận kết quả và hiển thị

Backend có nhiệm vụ:

- Kiểm tra câu truy vấn
- Kết nối cơ sở dữ liệu
- Thực thi truy vấn SQL
- Trả dữ liệu về frontend

---

# 3. Giao diện Web

Trang web cần có ba thành phần chính:

Ô nhập câu truy vấn SQL  
Người dùng nhập câu lệnh SQL vào ô này.

Nút Execute  
Khi nhấn nút này, câu truy vấn sẽ được gửi đến backend.

Khu vực hiển thị kết quả  
Hiển thị dữ liệu được trả về từ cơ sở dữ liệu.

---

# 4. Quy trình thực hiện

## Bước 1: Tạo giao diện Web

Xây dựng một trang web đơn giản gồm:

- Ô nhập câu truy vấn SQL
- Nút Execute
- Khu vực hiển thị kết quả

Frontend có thể sử dụng HTML và JavaScript.

---

## Bước 2: Gửi truy vấn từ Web đến Backend

Khi người dùng nhấn Execute:

1. Frontend lấy nội dung câu truy vấn SQL
2. Gửi request HTTP đến backend
3. Backend nhận câu truy vấn

---

## Bước 3: Backend kiểm tra truy vấn

Hệ thống chấp nhận mọi loại câu truy vấn 

---

## Bước 4: Kết nối SQL Server

Backend sử dụng driver kết nối tới SQL Server.

Các thông tin cần thiết:

- Server database
- Username
- Password
- Tên database

Sau khi kết nối thành công, backend có thể thực thi truy vấn.

---

## Bước 5: Thực thi truy vấn

Backend gửi câu lệnh SQL đến SQL Server.

SQL Server xử lý truy vấn và trả về kết quả dưới dạng ResultSet.

ResultSet bao gồm:

- Danh sách các dòng dữ liệu
- Các cột tương ứng

---

## Bước 6: Trả dữ liệu về Web

Backend xử lý dữ liệu nhận được từ ResultSet.

Sau đó chuyển dữ liệu sang dạng JSON và gửi về frontend.

---

## Bước 7: Hiển thị kết quả

Frontend nhận dữ liệu trả về từ backend.

Sau đó hiển thị kết quả trong khu vực Result trên trang web.

Dữ liệu có thể được hiển thị dưới dạng:

- Bảng dữ liệu
- Hoặc dạng JSON

---

# 5. Cơ sở dữ liệu

Hệ thống sử dụng cơ sở dữ liệu quản lý câu lạc bộ bóng đá.

Các bảng chính bao gồm:

Club  
Sponsors  
Injuries  
Matches  
Customers  
Fund  
Staffs  
Players  
Contracts  
InjuryStats  
PlayerMatchStats  
Tickets  
SellHistory  

Database lưu trữ các thông tin về:

- Câu lạc bộ
- Cầu thủ
- Trận đấu
- Chấn thương
- Hợp đồng
- Vé trận đấu
- Khách hàng

Cấu trúc bảng (không cần tạo lại bảng cũng như databse):

CREATE TABLE Club (  

ClubID INT PRIMARY KEY,  

ClubName NVARCHAR (100) NOT NULL,   

Stadium NVARCHAR (100) NOT NULL);  

 

CREATE TABLE Sponsors (  

SponsorID INT PRIMARY KEY,  

BrandName NVARCHAR (100) NOT NULL,  

Industry NVARCHAR (100) NOT NULL); 

 

CREATE TABLE Injuries (  

InjuryID INT PRIMARY KEY,  

InjuryName NVARCHAR (100) NOT NULL,  

Type NVARCHAR (50) NOT NULL,  

Detail NVARCHAR(MAX)); 

 

CREATE TABLE Matches (  

MatchID INT PRIMARY KEY,  

Opponent NVARCHAR (100) NOT NULL,  

MatchDate DATE NOT NULL,  

Venue NVARCHAR (100) NOT NULL CHECK (Venue IN ('Home', 'Away')),  

Competition NVARCHAR (100));  

 

CREATE TABLE Customers (  

CustomerID INT PRIMARY KEY,  

CustomerName NVARCHAR (100),  

Email NVARCHAR (100),  

PhoneNumber NVARCHAR (20));  

 

CREATE TABLE Fund (  

SponsorID INT,  

ClubID INT,  

StartDate DATE NOT NULL,  

ValidUntil DATE NOT NULL,  

PRIMARY KEY (SponsorID, ClubID),  

FOREIGN KEY (SponsorID) REFERENCES Sponsors (SponsorID), FOREIGN KEY (ClubID) REFERENCES Club (ClubID));  

 

CREATE TABLE Staffs ( 

StaffID INT PRIMARY KEY,  

StaffName NVARCHAR (100) NOT NULL,  

Role NVARCHAR (50) NOT NULL, 

ClubID INT,  

FOREIGN KEY (ClubID) REFERENCES Club (ClubID));  

 

CREATE TABLE Players (  

PlayerID INT PRIMARY KEY,  

DoB DATE NOT NULL,  

PlayerName NVARCHAR (100) NOT NULL,  

Status NVARCHAR (50) NOT NULL CHECK(Status IN ('Ready', 'NotReady')),  

Nationality NVARCHAR (50) NOT NULL,   

Position NVARCHAR (50) NOT NULL,  

ClubID INT,  

FOREIGN KEY (ClubID) REFERENCES Club (ClubID));  

 

CREATE TABLE Contracts (  

ContractID INT PRIMARY KEY,  

StartDate DATE NOT NULL,  

EndDate DATE NOT NULL,  

Salary DECIMAL (18,2) NOT NULL,  

BonusTerms NVARCHAR(MAX),  

PlayerID INT,  

FOREIGN KEY (PlayerID) REFERENCES Players (PlayerID));  

 

CREATE TABLE InjuryStats (  

InjuryID INT,  

PlayerID INT,  

StartDate DATE NOT NULL,  

ExpectedReturn DATE NOT NULL,  

PRIMARY KEY (InjuryID, PlayerID),  

FOREIGN KEY (InjuryID) REFERENCES Injuries (InjuryID),  

FOREIGN KEY (PlayerID) REFERENCES Players (PlayerID));  

 

CREATE TABLE PlayerMatchStats (  

MatchID INT,  

PlayerID INT,  

MinutesPlayed INT NOT NULL DEFAULT 0,  

Goals INT NOT NULL DEFAULT 0,  

Assists INT NOT NULL DEFAULT 0,  

PRIMARY KEY (MatchID, PlayerID),  

FOREIGN KEY (MatchID) REFERENCES Matches (MatchID),  

FOREIGN KEY (PlayerID) REFERENCES Players (PlayerID)); 	 

 

CREATE TABLE Tickets (  

TicketID INT PRIMARY KEY,  

SeatNumber NVARCHAR (20) NOT NULL,  

TicketType NVARCHAR (50) NOT NULL CHECK (TicketType IN ('Standard', 'VIP')),  

MatchID INT,  

FOREIGN KEY (MatchID) REFERENCES Matches (MatchID));  

 

CREATE TABLE SellHistory (  

TicketID INT,  

CustomerID INT,  

PurchaseDate DATE NOT NULL,  

FinalPrice DECIMAL (18,2) NOT NULL,  

PRIMARY KEY (TicketID, CustomerID),  

FOREIGN KEY (TicketID) REFERENCES Tickets (TicketID),  

FOREIGN KEY (CustomerID) REFERENCES Customers (CustomerID)); 

---

# 6. Ví dụ truy vấn

Một số truy vấn có thể thực hiện:

Lấy danh sách cầu thủ  
SELECT * FROM Players

Lấy danh sách trận đấu  
SELECT * FROM Matches

Thống kê số bàn thắng của cầu thủ  
SELECT PlayerID, SUM(Goals) FROM PlayerMatchStats GROUP BY PlayerID

---

# 7. Tổng kết

Hệ thống hoạt động theo quy trình:

1. Người dùng nhập câu truy vấn SQL
2. Frontend gửi truy vấn đến backend
3. Backend kiểm tra câu lệnh
4. Backend kết nối SQL Server
5. Thực thi truy vấn
6. Nhận kết quả
7. Trả dữ liệu về web
8. Hiển thị kết quả cho người dùng

Mô hình này minh họa cách truy cập và truy vấn cơ sở dữ liệu thông qua ứng dụng Web.