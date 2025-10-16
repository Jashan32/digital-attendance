import React, { useState, useEffect } from 'react';
import { 
  attendanceAPI, 
  timetableAPI,
  branchAPI,
  studentAPI,
  type AttendanceRecord, 
  type Branch, 
  type Timetable,
  type Student 
} from '../services/api';
import { 
  ClipboardDocumentListIcon, 
  CheckIcon, 
  XMarkIcon, 
  MagnifyingGlassIcon,
  CalendarIcon 
} from '../components/Icons';

interface ExtendedAttendanceRecord {
  student: Student;
  timeSlot?: {
    id: number;
    subject: {
      id: number;
      name: string;
      code: string;
    };
    timeSlot: string;
    startTime: string;
    endTime: string;
    dayOfWeek: number;
    scheduleType: string;
    inchargeName: string;
    roomNumber?: string;
  };
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  scanTime?: string;
  attendanceId?: number;
}

export function Attendance() {
  const [todayAttendance, setTodayAttendance] = useState<{
    summary: { totalPresent: number; totalLate: number; totalAbsent: number; totalRecords: number; };
    attendanceRecords: AttendanceRecord[];
  } | null>(null);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [comprehensiveAttendance, setComprehensiveAttendance] = useState<ExtendedAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('PRESENT');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [simulationDate, setSimulationDate] = useState(new Date().toISOString().split('T')[0]);
  const [showComprehensiveView, setShowComprehensiveView] = useState(true);

  const fetchBranches = async () => {
    try {
      const result = await branchAPI.getAll();
      if (result.success && result.data?.branches) {
        setBranches(result.data.branches);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const fetchTimetables = async () => {
    try {
      const params: any = {
        isActive: true,
        limit: 100 // Get all active timetables
      };

      if (selectedBranch) params.branchId = Number(selectedBranch);
      if (selectedSemester) params.semester = Number(selectedSemester);

      const result = await timetableAPI.getAll(params);
      if (result.success && result.data) {
        setTimetables(result.data.timetables || []);
      }
    } catch (err) {
      console.error('Error fetching timetables:', err);
    }
  };

  const fetchStudents = async () => {
    try {
      const params: any = { 
        isActive: true,
        limit: 1000 // Get all active students
      };
      
      if (selectedBranch) params.branchId = Number(selectedBranch);
      if (selectedSemester) params.semester = Number(selectedSemester);

      const result = await studentAPI.getAll(params);
      if (result.success && result.data?.students) {
        setAllStudents(result.data.students);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  const fetchTodayAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      // Send date in YYYY-MM-DD format - the backend expects this format
      // and will handle timezone conversion properly
      const formattedDate = simulationDate; // Already in YYYY-MM-DD format
      console.log('Fetching attendance for date:', formattedDate);
      
      const result = await attendanceAPI.getToday(formattedDate);
      if (result.success && result.data) {
        console.log('Attendance API response:', result.data);
        console.log('API returned date:', result.data.date);
        setTodayAttendance(result.data);
      } else {
        console.error('Attendance API error:', result.error);
        setError(result.error || 'Failed to fetch attendance data');
      }
    } catch (err) {
      console.error('Attendance fetch error:', err);
      setError('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  const createComprehensiveAttendance = async () => {
    if (!todayAttendance || !timetables.length || !allStudents.length) return;

    const comprehensive: ExtendedAttendanceRecord[] = [];

    // Fix timezone handling - parse date without timezone conversion
    const dateParts = simulationDate.split('-');
    const selectedDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    
    console.log('Selected date:', simulationDate, 'Day of week:', dayOfWeek, ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayOfWeek]);

    console.log('Available attendance records:', todayAttendance.attendanceRecords);
    console.log('Available timetables:', timetables.length);
    console.log('Available students:', allStudents.length);

    // For each active timetable
    for (const timetable of timetables) {
      if (!timetable.weeklySchedule) continue;

      // Get today's schedule
      const dayName = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayOfWeek];
      const todaySlots = timetable.weeklySchedule[dayName] || [];
      
      console.log(`Checking timetable "${timetable.name}" for ${dayName}:`, todaySlots);

      // For each time slot today
      for (const timeSlot of todaySlots) {
        // Find students for this branch and semester
        const relevantStudents = allStudents.filter(student => 
          student.branchId === timetable.branch.id && 
          student.semester === timetable.semester &&
          student.isActive
        );

        // For each student who should be in this class
        for (const student of relevantStudents) {
          // Check if they have an attendance record - improved matching logic
          const attendanceRecord = todayAttendance.attendanceRecords.find(record => {
            if (!record.student) return false;
            
            // Match by roll number (primary)
            const rollNumberMatch = student.rollNumber === record.student.rollNumber;
            
            // Match by subject name (handle both exact and partial matches)
            const subjectMatch = record.timeSlot?.subject?.name === timeSlot.subject.name ||
                                record.timeSlot?.subject?.code === timeSlot.subject.code;
            
            console.log(`Checking student ${student.name} (${student.rollNumber}) against record:`, {
              recordStudent: record.student.name,
              recordRoll: record.student.rollNumber,
              recordSubject: record.timeSlot?.subject?.name,
              timeSlotSubject: timeSlot.subject.name,
              rollNumberMatch,
              subjectMatch
            });
            
            return rollNumberMatch && subjectMatch;
          });

          comprehensive.push({
            student,
            timeSlot: {
              id: timeSlot.id,
              subject: timeSlot.subject,
              timeSlot: `${timeSlot.startTime}-${timeSlot.endTime}`,
              startTime: timeSlot.startTime,
              endTime: timeSlot.endTime,
              dayOfWeek: dayOfWeek,
              scheduleType: timeSlot.scheduleType,
              inchargeName: timeSlot.inchargeName,
              roomNumber: timeSlot.roomNumber
            },
            status: (attendanceRecord?.status === 'EXCUSED' ? 'ABSENT' : attendanceRecord?.status) || 'ABSENT',
            scanTime: attendanceRecord?.checkInTime,
            attendanceId: attendanceRecord?.id
          });
          
          if (attendanceRecord) {
            console.log(`Found attendance record for ${student.name}: ${attendanceRecord.status}`);
          }
        }
      }
    }

    console.log('Total comprehensive records created:', comprehensive.length);

    // If no time slots for today but we have students, show them as not having classes
    if (comprehensive.length === 0 && allStudents.length > 0) {
      console.log('No time slots found for today, showing all students as having no classes');
      const relevantStudents = allStudents.filter(student => {
        if (selectedBranch && student.branchId !== Number(selectedBranch)) return false;
        if (selectedSemester && student.semester !== Number(selectedSemester)) return false;
        return student.isActive;
      });

      // But still check if they have attendance records for today
      for (const student of relevantStudents) {
        const attendanceRecord = todayAttendance.attendanceRecords.find(record => 
          record.student && student.rollNumber === record.student.rollNumber
        );
        
        comprehensive.push({
          student,
          status: attendanceRecord?.status as 'PRESENT' | 'LATE' | 'ABSENT' || 'ABSENT',
          scanTime: attendanceRecord?.checkInTime,
          attendanceId: attendanceRecord?.id,
          timeSlot: attendanceRecord?.timeSlot ? {
            id: 0,
            subject: {
              id: 0,
              name: attendanceRecord.timeSlot.subject?.name || 'Unknown',
              code: attendanceRecord.timeSlot.subject?.code || 'UNK'
            },
            timeSlot: attendanceRecord.timeSlot.timeSlot || 'N/A',
            startTime: '',
            endTime: '',
            dayOfWeek: dayOfWeek,
            scheduleType: attendanceRecord.timeSlot.scheduleType || 'LECTURE',
            inchargeName: attendanceRecord.timeSlot.inchargeName || '',
            roomNumber: attendanceRecord.timeSlot.roomNumber
          } : undefined
        });
      }
    }

    setComprehensiveAttendance(comprehensive);
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchTimetables();
    fetchStudents();
  }, [selectedBranch, selectedSemester]);

  useEffect(() => {
    fetchTodayAttendance();
  }, [simulationDate]);

  useEffect(() => {
    createComprehensiveAttendance();
  }, [todayAttendance, timetables, allStudents]);

  // Use comprehensive view or original scanned-only view based on toggle
  const displayRecords = showComprehensiveView 
    ? comprehensiveAttendance 
    : todayAttendance?.attendanceRecords.map(record => ({
        student: {
          id: 0, // Placeholder ID
          name: record.student?.name || 'Unknown',
          rollNumber: record.student?.rollNumber || 'N/A',
          email: '',
          phone: '',
          branchId: 0,
          semester: 0,
          fingerId: 0,
          admissionYear: 0,
          isActive: true,
          branch: record.student?.branch || { id: 0, name: 'Unknown', code: 'UNK' }
        } as Student,
        timeSlot: record.timeSlot ? {
          id: 0,
          subject: {
            id: 0,
            name: record.timeSlot.subject?.name || 'Unknown',
            code: record.timeSlot.subject?.code || 'UNK'
          },
          timeSlot: record.timeSlot.timeSlot || 'N/A',
          startTime: '',
          endTime: '',
          dayOfWeek: 0,
          scheduleType: record.timeSlot.scheduleType || 'LECTURE',
          inchargeName: record.timeSlot.inchargeName || '',
          roomNumber: record.timeSlot.roomNumber
        } : undefined,
        status: record.status as 'PRESENT' | 'LATE' | 'ABSENT',
        scanTime: record.checkInTime,
        attendanceId: record.id
      } as ExtendedAttendanceRecord)) || [];

  // Get unique subjects from current display records for filter dropdown
  const availableSubjects = React.useMemo(() => {
    const subjects = new Set<string>();
    displayRecords.forEach(record => {
      if (record.timeSlot?.subject?.name) {
        subjects.add(record.timeSlot.subject.name);
      }
    });
    return Array.from(subjects).sort();
  }, [displayRecords]);

  const filteredRecords = displayRecords.filter((record) => {
    const matchesSearch = !searchTerm || 
      record.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.timeSlot?.subject.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !selectedStatus || record.status === selectedStatus;
    
    const matchesBranch = !selectedBranch || record.student.branchId === Number(selectedBranch);
    const matchesSemester = !selectedSemester || record.student.semester === Number(selectedSemester);
    
    const matchesSubject = !selectedSubject || record.timeSlot?.subject?.name === selectedSubject;
    
    return matchesSearch && matchesStatus && matchesBranch && matchesSemester && matchesSubject;
  });

  const handleManualUpdate = async (data: {
    rollNumber: string;
    subjectName: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE';
    date: string;
    remarks?: string;
  }) => {
    try {
      const result = await attendanceAPI.updateManual(data);

      if (result.success) {
        setShowUpdateModal(false);
        fetchTodayAttendance();
        // Show success message with details
        const responseData = result.data as any;
        alert(`Attendance ${responseData.attendance.wasUpdated ? 'updated' : 'created'} successfully!\n\nStudent: ${responseData.student.name}\nSubject: ${responseData.timeSlot.subject.name}\nStatus: ${responseData.attendance.status}\nDate: ${data.date}`);
      } else {
        alert(result.error || 'Failed to update attendance');
      }
    } catch (err) {
      console.error('Error updating attendance:', err);
      alert('Failed to update attendance');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 p-6">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <XMarkIcon className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Attendance Management</h1>
          <p className="text-gray-600">Track and manage student attendance</p>
        </div>

        {/* Date and Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={simulationDate}
                onChange={(e) => setSimulationDate(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : '')}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Semester
              </label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value ? Number(e.target.value) : '')}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">All Subjects</option>
                {availableSubjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">All Status</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LATE">Late</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowUpdateModal(true)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Update Attendance
              </button>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={showComprehensiveView}
                  onChange={(e) => setShowComprehensiveView(e.target.checked)}
                  className="mr-2"
                />
                Show all students
              </label>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {displayRecords.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Present</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {displayRecords.filter(r => r.status === 'PRESENT').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClipboardDocumentListIcon className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Late</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {displayRecords.filter(r => r.status === 'LATE').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <XMarkIcon className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Absent</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {displayRecords.filter(r => r.status === 'ABSENT').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CalendarIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {showComprehensiveView ? 'Total Students' : 'Scanned Records'}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {displayRecords.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Timetables Section */}
        {timetables.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-6 p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Active Timetables</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {timetables.slice(0, 6).map((timetable) => (
                <div key={timetable.id} className="border rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900">{timetable.name}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {timetable.branch?.name} • Semester {timetable.semester} • {timetable.totalSlots} slots
                  </div>
                </div>
              ))}
            </div>
            {timetables.length > 6 && (
              <div className="mt-3 text-sm text-gray-500 text-center">
                And {timetables.length - 6} more active timetables...
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search by student name, roll number, or subject..."
            />
          </div>
        </div>

        {/* Attendance Records */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Attendance Records ({filteredRecords.length})
            </h3>

            {filteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No students found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No students found for the selected date and filters. Try adjusting your filters or check if there are active timetables for today.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time Slot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scan Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRecords.map((record, index) => (
                      <tr key={record.attendanceId || `${record.student.id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {record.student.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {record.student.rollNumber}
                              </div>
                              <div className="text-sm text-gray-400">
                                {record.student.branch.name} - Sem {record.student.semester}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {record.timeSlot?.subject?.name || 'No class scheduled'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {record.timeSlot?.subject?.code || 'N/A'}
                          </div>
                          {record.timeSlot?.inchargeName && (
                            <div className="text-xs text-gray-400">
                              Instructor: {record.timeSlot.inchargeName}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.timeSlot ? (
                            <div>
                              <div>{record.timeSlot.timeSlot}</div>
                              {record.timeSlot.roomNumber && (
                                <div className="text-xs text-gray-400">
                                  Room: {record.timeSlot.roomNumber}
                                </div>
                              )}
                            </div>
                          ) : (
                            'No class'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'PRESENT'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'LATE'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.scanTime ? new Date(record.scanTime).toLocaleTimeString() : 'Not scanned'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Manual Attendance Update Modal */}
        {showUpdateModal && (
          <ManualAttendanceModal
            isOpen={showUpdateModal}
            onClose={() => setShowUpdateModal(false)}
            onUpdate={handleManualUpdate}
            timetables={timetables}
            defaultDate={simulationDate}
          />
        )}
      </div>
    </div>
  );
}

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (data: {
    rollNumber: string;
    subjectName: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE';
    date: string;
    remarks?: string;
  }) => void;
  timetables: Timetable[];
  defaultDate: string;
}

function ManualAttendanceModal({ isOpen, onClose, onUpdate, timetables, defaultDate }: ManualAttendanceModalProps) {
  const [rollNumber, setRollNumber] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [status, setStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE'>('PRESENT');
  const [remarks, setRemarks] = useState('');
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  // Get all unique subjects from timetables
  const allSubjectsFromTimetables = React.useMemo(() => {
    const subjects = new Set<string>();
    timetables.forEach(timetable => {
      if (timetable.weeklySchedule) {
        Object.values(timetable.weeklySchedule).forEach(daySlots => {
          daySlots.forEach(slot => {
            if (slot.subject?.name) {
              subjects.add(slot.subject.name);
            }
          });
        });
      }
    });
    return Array.from(subjects).sort();
  }, [timetables]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rollNumber.trim() && subjectName.trim() && selectedDate) {
      onUpdate({
        rollNumber: rollNumber.trim(),
        subjectName: subjectName.trim(),
        status,
        date: selectedDate,
        remarks: remarks.trim() || undefined,
      });
      // Reset form
      setRollNumber('');
      setSubjectName('');
      setStatus('PRESENT');
      setRemarks('');
      setSelectedDate(defaultDate);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Update Attendance</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roll Number
            </label>
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="Enter student roll number"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            {allSubjectsFromTimetables.length > 0 ? (
              <select
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                required
              >
                <option value="">Select Subject</option>
                {allSubjectsFromTimetables.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
                placeholder="Enter subject name"
                required
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              Select from available subjects or type a subject name
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'PRESENT' | 'ABSENT' | 'LATE')}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks (Optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              rows={3}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Update Attendance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}