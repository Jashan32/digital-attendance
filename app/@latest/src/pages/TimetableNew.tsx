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

  const [showCreateModal, setShowCreateModal] = useState(false);
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
      const result = await timetableAPI.getAll({ page: 1, limit: 10 });
      if (result.success && result.data) {
        setTimetables(result.data.timetables || []);
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
    fetchTimetables();
  }, []);

  const handleCreateNewTimetable = async (data: {
    name: string;
    branchId: number;
    semester: number;
    academicYear: string;
  }) => {
    try {
      const result = await timetableAPI.create({
        name: data.name,
        branchId: data.branchId,
        semester: data.semester,
        academicYear: data.academicYear,
        timeSlots: [] // Start with empty time slots, can be added later
      });

      if (result.success) {
        setShowCreateModal(false);
        fetchTimetables(); // Refresh the timetables list
        setError(null);
      } else {
        setError(result.error || 'Failed to create timetable');
      }
    } catch (err) {
      setError('Failed to create timetable');
    }
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
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Timetable Management</h1>
              <p className="text-gray-600">Manage the current active timetable - only one timetable can be active at a time</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Timetable
            </button>
          </div>
          {timetables.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Creating a new timetable will replace the current one. If the current timetable has attendance records, it will be archived instead of deleted.
              </p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {timetables.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{timetables[0]?.totalSlots || 0}</div>
                <div className="text-sm text-gray-600">Total Classes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{timetables[0]?.branch?.name || 'N/A'}</div>
                <div className="text-sm text-gray-600">Branch</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">Sem {timetables[0]?.semester || 'N/A'}</div>
                <div className="text-sm text-gray-600">Semester</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{timetables[0]?.academicYear || 'N/A'}</div>
                <div className="text-sm text-gray-600">Academic Year</div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Current Timetable Display */}
        <div className="grid gap-6">
          {timetables.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Timetable Found</h3>
              <p className="text-gray-600 mb-4">
                No timetable has been created yet. Create your first timetable to get started.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create First Timetable
              </button>
            </div>
          ) : (
            timetables.map((timetable) => (
              <div key={timetable.id} className={`bg-white rounded-lg shadow-lg ${timetable.isActive ? 'ring-2 ring-green-500' : ''}`}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-xl font-semibold text-gray-900 mr-3">{timetable.name}</h3>
                        {timetable.isActive && (
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            Current Active
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Branch:</span> {timetable.branch?.name || 'N/A'} ({timetable.branch?.code || 'N/A'})
                        <span className="mx-3">•</span>
                        <span className="font-medium">Semester:</span> {timetable.semester}
                        <span className="mx-3">•</span>
                        <span className="font-medium">Academic Year:</span> {timetable.academicYear}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {timetable.totalSlots} Classes
                      </div>
                      <div className="text-sm text-gray-500">
                        Total Weekly Slots
                      </div>
                    </div>
                  </div>

                  {/* Weekly Schedule Display */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Weekly Schedule Preview</h4>
                    <div className="grid grid-cols-7 gap-2 text-xs">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
                        const daySlots = timetable.weeklySchedule?.[day] || [];
                        const shortDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index];
                        
                        return (
                          <div key={day} className="text-center">
                            <div className="font-medium text-gray-700 mb-1">{shortDay}</div>
                            <div className="bg-gray-50 rounded p-2 min-h-[80px]">
                              {daySlots.length > 0 ? (
                                <div className="space-y-1">
                                  {daySlots.slice(0, 2).map((slot) => (
                                    <div 
                                      key={slot.id} 
                                      className="bg-blue-100 text-blue-800 rounded px-1 py-0.5 text-[10px] leading-tight"
                                      title={`${slot.subject.name} (${slot.subject.code})\n${slot.startTime} - ${slot.endTime}\nInstructor: ${slot.inchargeName}${slot.roomNumber ? `\nRoom: ${slot.roomNumber}` : ''}`}
                                    >
                                      <div className="font-medium truncate">
                                        {slot.subject.code}
                                      </div>
                                      <div className="truncate">
                                        {slot.startTime}-{slot.endTime}
                                      </div>
                                    </div>
                                  ))}
                                  {daySlots.length > 2 && (
                                    <div className="text-gray-600 text-[9px] py-0.5">
                                      +{daySlots.length - 2} more
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-gray-500 py-2">No classes</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      Timetable ID: {timetable.id} • Status: {timetable.isActive ? 'Active' : 'Inactive'}
                    </div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
                    >
                      Replace Timetable
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>



        {/* Create New Timetable Modal */}
        {showCreateModal && (
          <CreateTimetableModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateNewTimetable}
            branches={branches}
          />
        )}
      </div>
    </div>
  );
}

// Create Timetable Modal Component
interface CreateTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    branchId: number;
    semester: number;
    academicYear: string;
  }) => void;
  branches: Branch[];
}

function CreateTimetableModal({ isOpen, onClose, onCreate, branches }: CreateTimetableModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    branchId: branches[0]?.id || '',
    semester: 1,
    academicYear: new Date().getFullYear().toString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.branchId) {
      alert('Please fill in all required fields');
      return;
    }
    
    onCreate({
      name: formData.name,
      branchId: Number(formData.branchId),
      semester: formData.semester,
      academicYear: formData.academicYear,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Create New Timetable</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>Warning:</strong> This will replace any existing timetable. Proceed only if you're sure.
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timetable Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Fall 2024 Timetable"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch *
              </label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: Number(e.target.value) })}
                className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Semester *
              </label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Academic Year *
              </label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 2024-2025"
                required
              />
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
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
              Create Timetable
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}