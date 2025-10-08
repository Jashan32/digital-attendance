import { useState, useEffect } from 'react';
import { 
  attendanceAPI, 
  timetableAPI,
  branchAPI,
  type AttendanceRecord, 
  type Branch, 
  type Timetable 
} from '../services/api';
import { 
  ClipboardDocumentListIcon, 
  CheckIcon, 
  XMarkIcon, 
  MagnifyingGlassIcon,
  CalendarIcon 
} from '../components/Icons';

export function Attendance() {
  const [todayAttendance, setTodayAttendance] = useState<{
    summary: { totalPresent: number; totalLate: number; totalAbsent: number; totalRecords: number; };
    attendanceRecords: AttendanceRecord[];
  } | null>(null);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');
  const [showScanModal, setShowScanModal] = useState(false);
  const [simulationDate, setSimulationDate] = useState(new Date().toISOString().split('T')[0]);

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

  const fetchTodayAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await attendanceAPI.getToday(simulationDate);
      if (result.success && result.data) {
        setTodayAttendance(result.data);
      } else {
        setError(result.error || 'Failed to fetch attendance data');
      }
    } catch (err) {
      setError('Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchTimetables();
  }, [selectedBranch, selectedSemester]);

  useEffect(() => {
    fetchTodayAttendance();
  }, [simulationDate]);

  const filteredRecords = todayAttendance?.attendanceRecords.filter((record) => {
    const matchesSearch = !searchTerm || 
      record.student?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.student?.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.timeSlot?.subject.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !selectedStatus || record.status === selectedStatus;
    
    const matchesBranch = !selectedBranch || record.student?.branch?.name.toLowerCase().includes(branches.find(b => b.id === Number(selectedBranch))?.name.toLowerCase() || '');
    const matchesSemester = true; // Semester filtering not available in current type
    
    return matchesSearch && matchesStatus && matchesBranch && matchesSemester;
  }) || [];

  const handleScanFingerprint = async (fingerId: number) => {
    try {
      const timestamp = new Date().toISOString();
      const currentDateTime = new Date(`${simulationDate}T${new Date().toTimeString().split(' ')[0]}`).toISOString();
      
      const result = await attendanceAPI.scan({
        fingerId,
        timestamp,
        currentDateTime,
      });

      if (result.success) {
        setShowScanModal(false);
        fetchTodayAttendance();
        // Show success message with details
        const data = result.data as any;
        alert(`Attendance marked successfully!\n\nStudent: ${data.student.name}\nSubject: ${data.timeSlot.subject.name}\nStatus: ${data.attendance.status}\nTime: ${data.attendance.scanTime}`);
      } else {
        alert(result.error || 'Failed to mark attendance');
      }
    } catch (err) {
      alert('Failed to mark attendance');
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

            <div className="flex items-end">
              <button
                onClick={() => setShowScanModal(true)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Scan Fingerprint
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {todayAttendance && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Present</dt>
                    <dd className="text-lg font-medium text-gray-900">{todayAttendance.summary.totalPresent}</dd>
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
                    <dd className="text-lg font-medium text-gray-900">{todayAttendance.summary.totalLate}</dd>
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
                    <dd className="text-lg font-medium text-gray-900">{todayAttendance.summary.totalAbsent}</dd>
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
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Records</dt>
                    <dd className="text-lg font-medium text-gray-900">{todayAttendance.summary.totalRecords}</dd>
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">No attendance records</h3>
                <p className="mt-1 text-sm text-gray-500">
                  No attendance records found for the selected date and filters.
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
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {record.student?.name || 'Unknown'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {record.student?.rollNumber || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {record.timeSlot?.subject?.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {record.timeSlot?.subject?.code || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.timeSlot?.timeSlot || 'N/A'}
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
                          {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Fingerprint Scan Modal */}
        {showScanModal && (
          <FingerprintScanModal
            isOpen={showScanModal}
            onClose={() => setShowScanModal(false)}
            onScan={handleScanFingerprint}
          />
        )}
      </div>
    </div>
  );
}

interface FingerprintScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (fingerId: number) => void;
}

function FingerprintScanModal({ isOpen, onClose, onScan }: FingerprintScanModalProps) {
  const [fingerId, setFingerId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fingerId && Number(fingerId) > 0) {
      onScan(Number(fingerId));
      setFingerId('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Fingerprint Scanner</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Finger ID
            </label>
            <input
              type="number"
              value={fingerId}
              onChange={(e) => setFingerId(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="Enter finger ID to simulate scan"
              min="1"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Simulates fingerprint scanning by entering a finger ID
            </p>
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
              Scan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}