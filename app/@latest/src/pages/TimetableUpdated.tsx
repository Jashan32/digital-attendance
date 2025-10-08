import { useState, useEffect } from 'react';
import { 
  branchAPI,
  timetableAPI,
  type Branch,
  type Timetable
} from '../services/api';

export function Timetable() {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
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
      if (result.success && result.data?.branches) {
        setBranches(result.data.branches);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const fetchTimetables = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        page: pagination.currentPage,
        limit: 10,
        isActive: showActiveOnly
      };

      if (selectedBranch) params.branchId = Number(selectedBranch);
      if (selectedSemester) params.semester = Number(selectedSemester);

      const result = await timetableAPI.getAll(params);
      if (result.success && result.data) {
        setTimetables(result.data.timetables || []);
        setPagination({
          currentPage: result.data.pagination?.currentPage || 1,
          totalPages: result.data.pagination?.totalPages || 1,
          totalCount: result.data.pagination?.totalCount || 0,
          hasNextPage: result.data.pagination?.hasNextPage || false,
          hasPreviousPage: result.data.pagination?.hasPreviousPage || false,
        });
      } else {
        setTimetables([]);
        setError(result.error || 'Failed to fetch timetables');
      }
    } catch (err) {
      setError('Failed to fetch timetables');
      setTimetables([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchTimetables();
  }, [selectedBranch, selectedSemester, showActiveOnly]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-lg text-gray-600">Loading timetables...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">All Timetables</h1>
          <p className="text-gray-600">View and manage all timetables across branches and semesters</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">Show Active Only</span>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Timetables Grid */}
        <div className="grid gap-6">
          {timetables.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Timetables Found</h3>
              <p className="text-gray-600">
                {selectedBranch || selectedSemester 
                  ? 'No timetables match your current filters.' 
                  : 'No timetables have been created yet.'
                }
              </p>
            </div>
          ) : (
            timetables.map((timetable) => (
              <div key={timetable.id} className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{timetable.name}</h3>
                      <div className="text-sm text-gray-600 mt-1">
                        <span>Branch: {timetable.branch?.name || 'N/A'}</span>
                        <span className="mx-2">•</span>
                        <span>Semester {timetable.semester}</span>
                        <span className="mx-2">•</span>
                        <span>Academic Year: {timetable.academicYear}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        timetable.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {timetable.isActive ? 'Active' : 'Inactive'}
                      </span>
                      
                      <div className="text-sm text-gray-500">
                        Total Slots: {timetable.totalSlots}
                      </div>
                    </div>
                  </div>

                  {/* Weekly Schedule Display */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Weekly Schedule</h4>
                    <div className="grid grid-cols-7 gap-2 text-xs">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <div key={day} className="text-center">
                          <div className="font-medium text-gray-700 mb-1">{day}</div>
                          <div className="bg-gray-50 rounded p-2 min-h-[60px]">
                            <div className="text-gray-500">No slots</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t text-center text-sm text-gray-500">
                    <div>
                      Timetable ID: {timetable.id} • Active: {timetable.isActive ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow mt-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPreviousPage}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {Math.min((pagination.currentPage - 1) * 10 + 1, pagination.totalCount)}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.currentPage * 10, pagination.totalCount)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.totalCount}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPreviousPage}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    const page = i + Math.max(1, pagination.currentPage - 2);
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === pagination.currentPage
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    ›
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}