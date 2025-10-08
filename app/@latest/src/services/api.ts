const API_BASE_URL = 'http://localhost:3003';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      return result;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // GET request
  async get<T>(endpoint: string): Promise<{ success: boolean; data?: T; error?: string }> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST request
  async post<T>(
    endpoint: string,
    data: any
  ): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put<T>(
    endpoint: string,
    data: any
  ): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete<T>(
    endpoint: string
  ): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create API client instance
export const apiClient = new ApiClient(API_BASE_URL);

// Type definitions for API responses
export interface Branch {
  id: number;
  name: string;
  code: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    studentCount: number;
    subjectCount: number;
  };
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  credits: number;
  semester: number;
  branchId: number;
  description?: string;
  branch: {
    id: number;
    name: string;
    code: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: number;
  name: string;
  rollNumber: string;
  email?: string;
  phone?: string;
  branchId: number;
  semester: number;
  fingerId: number;
  fingerPrintId?: string;
  admissionYear: number;
  isActive: boolean;
  branch: {
    id: number;
    name: string;
    code: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  id: number;
  subject: {
    id: number;
    name: string;
    code: string;
  };
  inchargeName: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  roomNumber?: string;
  scheduleType: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
  isActive: boolean;
}

export interface Timetable {
  id: number;
  name: string;
  branch: {
    id: number;
    name: string;
    code: string;
  };
  semester: number;
  academicYear: string;
  isActive: boolean;
  weeklySchedule: Record<string, TimeSlot[]>;
  totalSlots: number;
}

export interface AttendanceRecord {
  id: number;
  student?: {
    name: string;
    rollNumber: string;
    branch: {
      name: string;
      code: string;
    };
  };
  timeSlot?: {
    subject: {
      name: string;
      code: string;
    };
    timeSlot: string;
    inchargeName: string;
    roomNumber?: string;
    scheduleType: string;
    dayOfWeek: string;
  };
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  checkInTime?: string;
  checkOutTime?: string;
  remarks?: string;
}

// API service functions
export const branchAPI = {
  getAll: (params?: { includeStats?: boolean; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.includeStats) query.append('includeStats', 'true');
    if (params?.search) query.append('search', params.search);
    
    return apiClient.get<{ branches: Branch[] }>(`/branch/all?${query}`);
  },
  
  getById: (id: number) => apiClient.get<{ branch: Branch }>(`/branch/${id}`),
  
  create: (data: { name: string; code: string; description?: string }) =>
    apiClient.post<{ branch: Branch }>('/branch/create', data),
  
  update: (id: number, data: { name: string; code: string; description?: string }) =>
    apiClient.put<{ branch: Branch }>(`/branch/${id}`, data),
  
  delete: (id: number) => apiClient.delete(`/branch/${id}`),
};

export const subjectAPI = {
  getAll: (params?: { 
    branchId?: number; 
    semester?: number; 
    search?: string; 
    page?: number; 
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.branchId) query.append('branchId', params.branchId.toString());
    if (params?.semester) query.append('semester', params.semester.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    
    return apiClient.get<{ 
      subjects: Subject[]; 
      pagination: { currentPage: number; totalPages: number; totalCount: number; hasNextPage: boolean; hasPreviousPage: boolean; } 
    }>(`/subject/all?${query}`);
  },
  
  getById: (id: number) => apiClient.get<{ subject: Subject }>(`/subject/${id}`),
  
  getByBranch: (branchId: number, semester?: number) => {
    const query = semester ? `?semester=${semester}` : '';
    return apiClient.get<{ 
      subjects: Subject[]; 
      subjectsBySemester: Record<string, Subject[]>; 
      totalCount: number; 
    }>(`/subject/branch/${branchId}${query}`);
  },
  
  create: (data: { 
    name: string; 
    code: string; 
    credits?: number; 
    semester: number; 
    branchId: number; 
    description?: string; 
  }) => apiClient.post<{ subject: Subject }>('/subject/create', data),
  
  update: (id: number, data: { 
    name: string; 
    code: string; 
    credits?: number; 
    semester: number; 
    branchId: number; 
    description?: string; 
  }) => apiClient.put<{ subject: Subject }>(`/subject/${id}`, data),
  
  delete: (id: number) => apiClient.delete(`/subject/${id}`),
};

export const studentAPI = {
  getAll: (params?: { 
    branchId?: number; 
    semester?: number; 
    isActive?: boolean; 
    search?: string; 
    page?: number; 
    limit?: number; 
  }) => {
    const query = new URLSearchParams();
    if (params?.branchId) query.append('branchId', params.branchId.toString());
    if (params?.semester) query.append('semester', params.semester.toString());
    if (params?.isActive !== undefined) query.append('isActive', params.isActive.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    
    return apiClient.get<{ 
      students: Student[]; 
      pagination: { currentPage: number; totalPages: number; totalCount: number; hasNextPage: boolean; hasPreviousPage: boolean; } 
    }>(`/student/all?${query}`);
  },
  
  getById: (id: number) => apiClient.get<{ student: Student & { recentAttendances: AttendanceRecord[] } }>(`/student/${id}`),
  
  create: (data: {
    name: string;
    rollNumber: string;
    email?: string;
    phone?: string;
    branchId: number;
    semester: number;
    fingerId: number;
    fingerPrintId?: string;
    admissionYear: number;
    isActive?: boolean;
  }) => apiClient.post<{ student: Student }>('/student/register', data),
};

export const timetableAPI = {
  getAll: (params?: { 
    branchId?: number; 
    semester?: number; 
    isActive?: boolean; 
    page?: number; 
    limit?: number; 
  }) => {
    const query = new URLSearchParams();
    if (params?.branchId) query.append('branchId', params.branchId.toString());
    if (params?.semester) query.append('semester', params.semester.toString());
    if (params?.isActive !== undefined) query.append('isActive', params.isActive.toString());
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    
    return apiClient.get<{ 
      timetables: (Timetable & { createdAt: string; updatedAt: string; })[]; 
      pagination: { currentPage: number; totalPages: number; totalCount: number; hasNextPage: boolean; hasPreviousPage: boolean; } 
    }>(`/timetable/all?${query}`);
  },

  getActive: (branchId: number, semester: number) => {
    const query = new URLSearchParams();
    query.append('branchId', branchId.toString());
    query.append('semester', semester.toString());
    
    return apiClient.get<{ timetable: Timetable }>(`/timetable/active?${query}`);
  },
  
  create: (data: {
    name: string;
    branchId: number;
    semester: number;
    academicYear: string;
    timeSlots: {
      subjectId: number;
      inchargeName: string;
      inchargeId?: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      roomNumber?: string;
      scheduleType?: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
    }[];
  }) => apiClient.post<{ timetable: any }>('/timetable/create', data),

  update: (id: number, data: {
    name?: string;
    academicYear?: string;
    isActive?: boolean;
  }) => apiClient.put<{ timetable: Timetable }>(`/timetable/${id}`, data),

  delete: (id: number) => apiClient.delete(`/timetable/${id}`),

  toggleStatus: (id: number) => apiClient.post<{ timetable: Timetable }>(`/timetable/${id}/toggle-status`, {}),
  
  updateTimeSlot: (id: number, data: {
    subjectId?: number;
    inchargeName?: string;
    inchargeId?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    roomNumber?: string;
    scheduleType?: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
    isActive?: boolean;
  }) => apiClient.put<{ timeSlot: TimeSlot }>(`/timetable/timeslot/${id}`, data),
  
  deleteTimeSlot: (id: number) => apiClient.delete(`/timetable/timeslot/${id}`),
};

export const attendanceAPI = {
  getToday: (currentDate?: string) => {
    const query = currentDate ? `?currentDate=${currentDate}` : '';
    return apiClient.get<{ 
      summary: { totalPresent: number; totalLate: number; totalAbsent: number; totalRecords: number; };
      date: string;
      usingSimulation: boolean;
      attendanceRecords: AttendanceRecord[];
    }>(`/attendance/today${query}`);
  },
  
  getStudentAttendance: (studentId: number, params?: { 
    startDate?: string; 
    endDate?: string; 
    status?: string; 
    page?: number; 
    limit?: number; 
  }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    
    return apiClient.get<{ 
      attendanceRecords: AttendanceRecord[]; 
      pagination: { currentPage: number; totalPages: number; totalCount: number; hasNextPage: boolean; hasPreviousPage: boolean; } 
    }>(`/attendance/student/${studentId}?${query}`);
  },
  
  scan: (data: { 
    fingerId: number; 
    timestamp: string; 
    currentDateTime?: string; 
  }) => apiClient.post('/attendance/scan', data),
};