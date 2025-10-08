import { useState, useEffect } from 'react';
import { timetableAPI, branchAPI, subjectAPI, type Timetable, type Branch, type Subject, type TimeSlot } from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon, CalendarIcon } from '../components/Icons';

export function Timetable() {
  const [timetables, setTimetables] = useState<(Timetable & { createdAt: string; updatedAt: string; })[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null);
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
        if (result.data.branches.length > 0 && !selectedBranch) {
          setSelectedBranch(result.data.branches[0].id);
          setSelectedSemester(1);
        }
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    }
  };

  const fetchSubjects = async () => {
    if (!selectedBranch) return;
    try {
      const result = await subjectAPI.getByBranch(selectedBranch as number, selectedSemester as number);
      if (result.success && result.data) {
        setSubjects(result.data.subjects);
      }
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
    }
  };

  const fetchTimetables = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: {
        page?: number;
        limit?: number;
        branchId?: number;
        semester?: number;
        isActive?: boolean;
      } = {
        page: pagination.currentPage,
        limit: 10,
        isActive: showActiveOnly
      };

      if (selectedBranch) params.branchId = Number(selectedBranch);
      if (selectedSemester) params.semester = Number(selectedSemester);

      const result = await timetableAPI.getAll(params);
      if (result.success && result.data) {
        setTimetables(result.data.timetables);
        setPagination({
          currentPage: result.data.pagination.page,
          totalPages: result.data.pagination.totalPages,
          totalCount: result.data.pagination.totalCount,
          hasNextPage: result.data.pagination.hasNextPage,
          hasPreviousPage: result.data.pagination.hasPreviousPage,
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
    fetchSubjects();
  }, [selectedBranch, selectedSemester]);

  useEffect(() => {
    fetchTimetables();
  }, [selectedBranch, selectedSemester, pagination.currentPage, showActiveOnly]);

  const handleCreateTimetable = () => {
    setShowCreateModal(true);
  };

  const handleEditTimeSlot = (timeSlot: TimeSlot) => {
    setEditingTimeSlot(timeSlot);
  };

  const handleDeleteTimeSlot = async (timeSlot: TimeSlot) => {
    if (!confirm(`Are you sure you want to delete this time slot?`)) {
      return;
    }

    try {
      const result = await timetableAPI.deleteTimeSlot(timeSlot.id);
      if (result.success) {
        fetchTimetable();
      } else {
        alert(result.error || 'Failed to delete time slot');
      }
    } catch (err) {
      alert('Failed to delete time slot');
    }
  };

  const handleTimeSlotSubmit = async (formData: {
    subjectId?: number;
    inchargeName?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    roomNumber?: string;
    scheduleType?: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
  }) => {
    if (!editingTimeSlot) return;

    try {
      const result = await timetableAPI.updateTimeSlot(editingTimeSlot.id, formData);
      if (result.success) {
        setEditingTimeSlot(null);
        fetchTimetable();
      } else {
        alert(result.error || 'Failed to update time slot');
      }
    } catch (err) {
      alert('Failed to update time slot');
    }
  };

  const handleCreateTimetableSubmit = async (formData: {
    name: string;
    academicYear: string;
    timeSlots: {
      subjectId: number;
      inchargeName: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      roomNumber?: string;
      scheduleType?: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
    }[];
  }) => {
    try {
      const result = await timetableAPI.create({
        name: formData.name,
        branchId: selectedBranch as number,
        semester: selectedSemester as number,
        academicYear: formData.academicYear,
        timeSlots: formData.timeSlots,
      });

      if (result.success) {
        setShowCreateModal(false);
        fetchTimetable();
      } else {
        alert(result.error || 'Failed to create timetable');
      }
    } catch (err) {
      alert('Failed to create timetable');
    }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  if (error && selectedBranch && selectedSemester) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <button
              onClick={fetchTimetable}
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
        <h1 className="text-2xl font-bold text-gray-900">Timetable Management</h1>
        {timetable && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{timetable.name}</span>
            <span className="mx-2">•</span>
            <span>{timetable.branch.name} ({timetable.branch.code})</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value ? parseInt(e.target.value) : '');
                setTimetable(null);
              }}
              className="px-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value ? parseInt(e.target.value) : '');
                setTimetable(null);
              }}
              className="px-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            {selectedBranch && selectedSemester && !timetable && !loading && (
              <button
                onClick={handleCreateTimetable}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Create Timetable
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {!selectedBranch || !selectedSemester ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select Branch and Semester</h3>
          <p className="text-gray-500">Choose a branch and semester to view or create a timetable.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-7 gap-4">
              {days.map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-6 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : !timetable ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Timetable Found</h3>
          <p className="text-gray-500 mb-4">
            No active timetable exists for {branches.find(b => b.id === selectedBranch)?.name} - Semester {selectedSemester}.
          </p>
          <button
            onClick={handleCreateTimetable}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Timetable
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{timetable.name}</h3>
                <p className="text-sm text-gray-500">
                  Academic Year: {timetable.academicYear} • Total Slots: {timetable.totalSlots}
                </p>
              </div>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                timetable.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {timetable.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Weekly Schedule Grid */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 min-w-full">
              {days.map((day) => (
                <div key={day} className="border-r border-gray-200 last:border-r-0">
                  <div className="bg-gray-50 p-3 text-center border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">{day}</h4>
                  </div>
                  <div className="p-2 min-h-96">
                    {timetable.weeklySchedule[day]?.length > 0 ? (
                      <div className="space-y-2">
                        {timetable.weeklySchedule[day].map((slot) => (
                          <div
                            key={slot.id}
                            className="bg-blue-50 border border-blue-200 rounded p-2 text-xs"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-blue-900 truncate">
                                {slot.subject.name}
                              </span>
                              <div className="flex space-x-1 ml-2">
                                <button
                                  onClick={() => handleEditTimeSlot(slot)}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Edit"
                                >
                                  <PencilIcon className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTimeSlot(slot)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete"
                                >
                                  <TrashIcon className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="text-blue-700">
                              <div>{slot.startTime} - {slot.endTime}</div>
                              <div className="truncate">{slot.inchargeName}</div>
                              {slot.roomNumber && (
                                <div className="truncate">Room: {slot.roomNumber}</div>
                              )}
                              <div className="mt-1">
                                <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                                  {slot.scheduleType}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-400 text-center py-8 text-sm">
                        No classes
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Timetable Modal */}
      {showCreateModal && (
        <CreateTimetableModal
          branch={branches.find(b => b.id === selectedBranch)!}
          semester={selectedSemester as number}
          subjects={subjects}
          onSubmit={handleCreateTimetableSubmit}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Time Slot Modal */}
      {editingTimeSlot && (
        <EditTimeSlotModal
          timeSlot={editingTimeSlot}
          subjects={subjects}
          onSubmit={handleTimeSlotSubmit}
          onClose={() => setEditingTimeSlot(null)}
        />
      )}
    </div>
  );
}

interface CreateTimetableModalProps {
  branch: Branch;
  semester: number;
  subjects: Subject[];
  onSubmit: (data: {
    name: string;
    academicYear: string;
    timeSlots: {
      subjectId: number;
      inchargeName: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      roomNumber?: string;
      scheduleType?: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
    }[];
  }) => void;
  onClose: () => void;
}

function CreateTimetableModal({ branch, semester, subjects, onSubmit, onClose }: CreateTimetableModalProps) {
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    name: `${branch.code} Semester ${semester} - ${currentYear}`,
    academicYear: `${currentYear}-${currentYear + 1}`,
  });
  const [timeSlots, setTimeSlots] = useState<any[]>([]);

  const addTimeSlot = () => {
    setTimeSlots([
      ...timeSlots,
      {
        id: Date.now(),
        subjectId: subjects[0]?.id || '',
        inchargeName: '',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
        roomNumber: '',
        scheduleType: 'LECTURE',
      },
    ]);
  };

  const updateTimeSlot = (index: number, field: string, value: any) => {
    const updated = [...timeSlots];
    updated[index] = { ...updated[index], [field]: value };
    setTimeSlots(updated);
  };

  const removeTimeSlot = (index: number) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.academicYear.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    if (timeSlots.length === 0) {
      alert('Please add at least one time slot');
      return;
    }
    
    const validTimeSlots = timeSlots.filter(slot => 
      slot.subjectId && slot.inchargeName.trim() && slot.startTime && slot.endTime
    );
    
    if (validTimeSlots.length === 0) {
      alert('Please complete at least one time slot');
      return;
    }

    onSubmit({
      ...formData,
      timeSlots: validTimeSlots.map(slot => ({
        subjectId: parseInt(slot.subjectId),
        inchargeName: slot.inchargeName,
        dayOfWeek: parseInt(slot.dayOfWeek),
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber || undefined,
        scheduleType: slot.scheduleType,
      })),
    });
  };

  const days = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-screen overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Create Timetable for {branch.name} - Semester {semester}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timetable Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Year *
              </label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 2024-25"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-gray-900">Time Slots</h4>
              <button
                type="button"
                onClick={addTimeSlot}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Add Slot
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {timeSlots.map((slot, index) => (
                <div key={slot.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-sm text-gray-700">Slot {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Subject
                      </label>
                      <select
                        value={slot.subjectId}
                        onChange={(e) => updateTimeSlot(index, 'subjectId', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name} ({subject.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Instructor
                      </label>
                      <input
                        type="text"
                        value={slot.inchargeName}
                        onChange={(e) => updateTimeSlot(index, 'inchargeName', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        placeholder="Instructor name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Day
                      </label>
                      <select
                        value={slot.dayOfWeek}
                        onChange={(e) => updateTimeSlot(index, 'dayOfWeek', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      >
                        {days.map((day) => (
                          <option key={day.value} value={day.value}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <select
                        value={slot.scheduleType}
                        onChange={(e) => updateTimeSlot(index, 'scheduleType', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="LECTURE">Lecture</option>
                        <option value="PRACTICAL">Practical</option>
                        <option value="TUTORIAL">Tutorial</option>
                        <option value="SEMINAR">Seminar</option>
                        <option value="EXAM">Exam</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateTimeSlot(index, 'startTime', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateTimeSlot(index, 'endTime', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Room Number
                      </label>
                      <input
                        type="text"
                        value={slot.roomNumber}
                        onChange={(e) => updateTimeSlot(index, 'roomNumber', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        placeholder="Room/Lab number"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {timeSlots.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No time slots added yet. Click "Add Slot" to get started.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
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
              Create Timetable
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditTimeSlotModalProps {
  timeSlot: TimeSlot;
  subjects: Subject[];
  onSubmit: (data: {
    subjectId?: number;
    inchargeName?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    roomNumber?: string;
    scheduleType?: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
  }) => void;
  onClose: () => void;
}

function EditTimeSlotModal({ timeSlot, subjects, onSubmit, onClose }: EditTimeSlotModalProps) {
  const [formData, setFormData] = useState({
    subjectId: timeSlot.subject.id,
    inchargeName: timeSlot.inchargeName,
    dayOfWeek: timeSlot.dayOfWeek,
    startTime: timeSlot.startTime,
    endTime: timeSlot.endTime,
    roomNumber: timeSlot.roomNumber || '',
    scheduleType: timeSlot.scheduleType,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const changes: any = {};
    
    if (formData.subjectId !== timeSlot.subject.id) changes.subjectId = formData.subjectId;
    if (formData.inchargeName !== timeSlot.inchargeName) changes.inchargeName = formData.inchargeName;
    if (formData.dayOfWeek !== timeSlot.dayOfWeek) changes.dayOfWeek = formData.dayOfWeek;
    if (formData.startTime !== timeSlot.startTime) changes.startTime = formData.startTime;
    if (formData.endTime !== timeSlot.endTime) changes.endTime = formData.endTime;
    if (formData.roomNumber !== (timeSlot.roomNumber || '')) changes.roomNumber = formData.roomNumber;
    if (formData.scheduleType !== timeSlot.scheduleType) changes.scheduleType = formData.scheduleType;

    onSubmit(changes);
  };

  const days = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Time Slot</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <select
              value={formData.subjectId}
              onChange={(e) => setFormData({ ...formData, subjectId: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructor Name
            </label>
            <input
              type="text"
              value={formData.inchargeName}
              onChange={(e) => setFormData({ ...formData, inchargeName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day
              </label>
              <select
                value={formData.dayOfWeek}
                onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {days.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.scheduleType}
                onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="LECTURE">Lecture</option>
                <option value="PRACTICAL">Practical</option>
                <option value="TUTORIAL">Tutorial</option>
                <option value="SEMINAR">Seminar</option>
                <option value="EXAM">Exam</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Number
            </label>
            <input
              type="text"
              value={formData.roomNumber}
              onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Room/Lab number"
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
              Update Time Slot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}