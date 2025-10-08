# Fingerprint Attendance System API

## 🚀 Server Status
✅ **Server is running on:** http://localhost:3003

## 📋 Available Endpoints

### **Schedule Management**
- `POST /schedule/set` - Set/Replace schedule
- `GET /schedule/current` - Get current schedule

### **Student Management**
- `POST /student/register` - Register new student
- `GET /student/all` - List all students
- `GET /student/:id` - Get student details
- `GET /student/fingerprint/:fingerId` - Get student by finger ID

### **Attendance (Main Feature)**
- `POST /attendance/scan` - **Fingerprint scanning endpoint**
- `GET /attendance/today` - Today's attendance summary
- `GET /attendance/student/:studentId` - Student attendance history

### **Branch Management**
- `POST /branch/create` - Create branch/department
- `GET /branch/all` - List all branches
- `GET /branch/:id` - Get branch details
- `PUT /branch/:id` - Update branch
- `DELETE /branch/:id` - Delete branch

### **Subject Management**
- `POST /subject/create` - Create subject
- `GET /subject/all` - List all subjects
- `GET /subject/:id` - Get subject details
- `GET /subject/branch/:branchId` - Get subjects by branch
- `PUT /subject/:id` - Update subject
- `DELETE /subject/:id` - Delete subject

### **Reports & Analytics**
- `GET /reports/attendance/summary` - Attendance statistics
- `GET /reports/attendance/detailed` - Detailed reports (JSON/CSV)
- `GET /reports/student/:studentId/attendance` - Individual student reports
- `GET /reports/branch/:branchId/attendance` - Branch analytics

### **Admin Functions**
- `GET /admin/dashboard` - System dashboard
- `POST /admin/bulk/students` - Bulk import students
- `DELETE /admin/cleanup/attendance` - Clean old records
- `GET /admin/system/status` - System health check
- `POST /admin/maintenance/reset-fingerprints` - Reset finger IDs

## 🔧 Quick Test Commands

### Test Server Health
```bash
curl http://localhost:3003/admin/system/status
```

### Create a Branch
```bash
curl -X POST http://localhost:3003/branch/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Computer Science", "code": "CS", "description": "Computer Science Department"}'
```

### Create a Subject
```bash
curl -X POST http://localhost:3003/subject/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Data Structures", "code": "CS101", "semester": 3, "branchId": "BRANCH_ID_HERE", "credits": 4}'
```

### Register a Student
```bash
curl -X POST http://localhost:3003/student/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "rollNumber": "CS2023001", 
    "fingerId": 1,
    "branchId": "BRANCH_ID_HERE",
    "semester": 3,
    "admissionYear": 2023,
    "email": "john@example.com"
  }'
```

### Set Schedule
```bash
curl -X POST http://localhost:3003/schedule/set \
  -H "Content-Type: application/json" \
  -d '{
    "subjectId": "SUBJECT_ID_HERE",
    "inchargeName": "Dr. Smith",
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "10:00",
    "semester": 3,
    "academicYear": "2023-24"
  }'
```

### **🔥 Main Feature: Fingerprint Attendance Scanning**
```bash
curl -X POST http://localhost:3003/attendance/scan \
  -H "Content-Type: application/json" \
  -d '{
    "fingerId": 1,
    "timestamp": "2025-10-08T18:35:00Z"
  }'
```

## 🗄️ Database Setup
The database has been migrated and is ready to use. The schema includes:
- ✅ Students with `fingerId` support
- ✅ Branches/Departments
- ✅ Subjects with branch association
- ✅ Schedules with time validation
- ✅ Attendance tracking with check-in/check-out

## 🚀 Next Steps
1. **Test the endpoints** using the curl commands above
2. **Create some test data** (branches, subjects, students)
3. **Set up a schedule** for testing
4. **Test fingerprint scanning** with the main attendance endpoint
5. **View reports** and analytics

Your fingerprint-based attendance system is ready for use! 🎯