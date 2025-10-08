import { useState, useEffect } from 'react';
import { studentAPI, branchAPI, type Student, type Branch } from '../services/api';
import { PlusIcon, EyeIcon, MagnifyingGlassIcon, UsersIcon } from '../components/Icons';

export function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const fetchBranches = async () => {
    try {
      const result = await branchAPI.getAll();
      if (result.success && result.data) {
        setBranches(result.data.branches);
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    }
  };

  const fetchStudents = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      if (selectedBranch) params.branchId = selectedBranch;
      if (selectedSemester) params.semester = selectedSemester;
      if (showActiveOnly) params.isActive = true;

      const result = await studentAPI.getAll(params);
      if (result.success && result.data) {
        setStudents(result.data.students);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || 'Failed to fetch students');
      }
    } catch (err) {
      setError('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchStudents(1);
  }, [searchTerm, selectedBranch, selectedSemester, showActiveOnly]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleAddStudent = () => {
    setShowAddModal(true);
  };

  const handleViewStudent = async (student: Student) => {
    try {
      const result = await studentAPI.getById(student.id);
      if (result.success && result.data) {
        setViewingStudent(result.data.student as Student);
      } else {
        alert(result.error || 'Failed to fetch student details');
      }
    } catch (err) {
      alert('Failed to fetch student details');
    }
  };

  const handleModalSubmit = async (formData: {
    name: string;
    rollNumber: string;
    email?: string;
    phone?: string;
    branchId: number;
    semester: number;
    fingerId: number;
    fingerPrintId?: string;
    admissionYear: number;
  }) => {
    try {
      const result = await studentAPI.create(formData);
      if (result.success) {
        setShowAddModal(false);
        fetchStudents(pagination.currentPage);
      } else {
        alert(result.error || 'Failed to add student');
      }
    } catch (err) {
      alert('Failed to add student');
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
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
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <button
              onClick={() => fetchStudents(1)}
              className="mt-3 bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Students Management</h1>
        <button
          onClick={handleAddStudent}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value ? parseInt(e.target.value) : '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>

          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value ? parseInt(e.target.value) : '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Active only</span>
          </label>

          <div className="text-sm text-gray-500 flex items-center">
            Total: {pagination.totalCount} students
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {students.length === 0 ? (
          <div className="p-8 text-center">
            <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedBranch || selectedSemester 
                ? 'Try adjusting your search or filters.' 
                : 'Get started by adding your first student.'}
            </p>
            {!searchTerm && !selectedBranch && !selectedSemester && (
              <button
                onClick={handleAddStudent}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Student
              </button>
            )}
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
                    Roll Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Semester
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admission Year
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        {student.email && (
                          <div className="text-sm text-gray-500">{student.email}</div>
                        )}
                        {student.phone && (
                          <div className="text-sm text-gray-500">{student.phone}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                        {student.rollNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{student.branch.name}</div>
                      <div className="text-sm text-gray-500">{student.branch.code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        Semester {student.semester}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        student.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {student.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.admissionYear}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleViewStudent(student)}
                          className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded"
                          title="View student details"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => fetchStudents(pagination.currentPage - 1)}
                  disabled={!pagination.hasPreviousPage}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchStudents(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page <span className="font-medium">{pagination.currentPage}</span> of{' '}
                    <span className="font-medium">{pagination.totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => fetchStudents(pagination.currentPage - 1)}
                      disabled={!pagination.hasPreviousPage}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchStudents(pagination.currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <StudentModal
          branches={branches}
          onSubmit={handleModalSubmit}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* View Student Modal */}
      {viewingStudent && (
        <StudentDetailsModal
          student={viewingStudent}
          onClose={() => setViewingStudent(null)}
        />
      )}
    </div>
  );
}

interface StudentModalProps {
  branches: Branch[];
  onSubmit: (data: {
    name: string;
    rollNumber: string;
    email?: string;
    phone?: string;
    branchId: number;
    semester: number;
    fingerId: number;
    fingerPrintId?: string;
    admissionYear: number;
  }) => void;
  onClose: () => void;
}

function StudentModal({ branches, onSubmit, onClose }: StudentModalProps) {
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    email: '',
    phone: '',
    branchId: branches[0]?.id || '',
    semester: 1,
    fingerId: '',
    fingerPrintId: '',
    admissionYear: currentYear,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.rollNumber.trim() || !formData.branchId || !formData.fingerId) {
      alert('Please fill in all required fields');
      return;
    }
    onSubmit({
      name: formData.name.trim(),
      rollNumber: formData.rollNumber.trim(),
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      branchId: Number(formData.branchId),
      semester: formData.semester,
      fingerId: Number(formData.fingerId),
      fingerPrintId: formData.fingerPrintId.trim() || undefined,
      admissionYear: formData.admissionYear,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Student</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Full Name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roll Number *
              </label>
              <input
                type="text"
                value={formData.rollNumber}
                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., CS2021001"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="student@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="10-digit number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch *
              </label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Semester *
              </label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Finger ID * (Numeric)
              </label>
              <input
                type="number"
                value={formData.fingerId}
                onChange={(e) => setFormData({ ...formData, fingerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 12345"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admission Year *
              </label>
              <select
                value={formData.admissionYear}
                onChange={(e) => setFormData({ ...formData, admissionYear: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {Array.from({ length: 10 }, (_, i) => currentYear - i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fingerprint ID (Optional)
            </label>
            <input
              type="text"
              value={formData.fingerPrintId}
              onChange={(e) => setFormData({ ...formData, fingerPrintId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Alternative fingerprint identifier"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Add Student
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface StudentDetailsModalProps {
  student: Student & { recentAttendances?: any[] };
  onClose: () => void;
}

function StudentDetailsModal({ student, onClose }: StudentDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Student Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Name:</span>
                <p className="text-gray-900">{student.name}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Roll Number:</span>
                <p className="text-gray-900">{student.rollNumber}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Email:</span>
                <p className="text-gray-900">{student.email || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Phone:</span>
                <p className="text-gray-900">{student.phone || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Branch:</span>
                <p className="text-gray-900">{student.branch.name} ({student.branch.code})</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Current Semester:</span>
                <p className="text-gray-900">Semester {student.semester}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Admission Year:</span>
                <p className="text-gray-900">{student.admissionYear}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Status:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  student.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {student.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Biometric Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Biometric Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Finger ID:</span>
                <p className="text-gray-900">{student.fingerId}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Fingerprint ID:</span>
                <p className="text-gray-900">{student.fingerPrintId || 'Not set'}</p>
              </div>
            </div>
          </div>

          {/* Recent Attendance */}
          {student.recentAttendances && student.recentAttendances.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Recent Attendance (Last 10 records)</h4>
              <div className="space-y-2">
                {student.recentAttendances.map((attendance: any, index: number) => (
                  <div key={index} className="flex justify-between items-center bg-white p-2 rounded">
                    <div>
                      <span className="text-sm font-medium">
                        {attendance.subject?.name || 'Unknown Subject'}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {new Date(attendance.date).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      attendance.status === 'PRESENT' ? 'bg-green-100 text-green-800' :
                      attendance.status === 'LATE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {attendance.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Record Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Created:</span>
                <p className="text-gray-900">{new Date(student.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Last Updated:</span>
                <p className="text-gray-900">{new Date(student.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}