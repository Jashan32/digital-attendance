import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface FingerprintScanRequest {
  fingerId: number;
  timestamp: string; // ISO 8601 format
  currentDateTime?: string; // Optional: for simulation - current date/time from frontend
}

// POST /attendance/scan - Mark attendance via fingerprint scan (Updated for timetable system)
// Simulation Support: Pass 'currentDateTime' in request body to simulate system time for testing
// The system will use currentDateTime for all time-based logic if provided, otherwise uses server time
// All times are processed in UTC to ensure consistency across timezones
// Example: { "fingerId": 123, "timestamp": "2025-10-08T09:30:00.000Z", "currentDateTime": "2025-10-08T09:30:00.000Z" }
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { fingerId, timestamp, currentDateTime }: FingerprintScanRequest = req.body;

    // Validate required fields
    if (!fingerId || !timestamp) {
      return res.status(401).json({
        success: false,
        error: 'Missing required fields: fingerId, timestamp'
      });
    }

    // Parse and validate timestamp
    const scanTime = new Date(timestamp);
    if (isNaN(scanTime.getTime())) {
      return res.status(402).json({
        success: false,
        error: 'Invalid timestamp format. Use ISO 8601 format (e.g., 2025-10-08T18:35:00Z)'
      });
    }

    // Use current date/time from frontend for simulation, or server time as fallback
    let systemTime: Date;
    if (currentDateTime) {
      systemTime = new Date(currentDateTime);
      if (isNaN(systemTime.getTime())) {
        return res.status(403).json({
          success: false,
          error: 'Invalid currentDateTime format. Use ISO 8601 format (e.g., 2025-10-08T09:30:00Z)'
        });
      }
    } else {
      systemTime = new Date(); // Use server time if not provided
    }

    // Find student by fingerId
    const student = await prisma.student.findUnique({
      where: { fingerId },
      include: {
        branch: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found with this fingerprint ID'
      });
    }

    if (!student.isActive) {
      return res.status(405).json({
        success: false,
        error: 'Student account is inactive'
      });
    }

    // Use system time (simulation or server time) for all time-based logic
    const currentDay = systemTime.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const currentTimeStr = `${systemTime.getUTCHours().toString().padStart(2, '0')}:${systemTime.getUTCMinutes().toString().padStart(2, '0')}`; // HH:MM format in UTC
    const currentMinutes = getMinutesFromTimeString(currentTimeStr);

    // Also get scan time details for recording
    const scanTimeStr = `${scanTime.getUTCHours().toString().padStart(2, '0')}:${scanTime.getUTCMinutes().toString().padStart(2, '0')}`; // HH:MM format in UTC
    const scanMinutes = getMinutesFromTimeString(scanTimeStr);

    // Convert JS day format to our format (1=Monday, 7=Sunday)
    const dayOfWeek = currentDay === 0 ? 7 : currentDay;

    // Find active timetable for student's branch and semester
    const activeTimetable = await prisma.timetable.findFirst({
    });

    if (!activeTimetable) {
      return res.status(406).json({
        success: false,
        error: 'No active timetable found for this student\'s branch and semester'
      });
    }

    // Find matching time slots for current day (based on system time)
    const matchingTimeSlots = await prisma.timeSlot.findMany({
      where: {
        timetableId: activeTimetable.id,
        dayOfWeek: dayOfWeek,
        isActive: true
      },
      include: {
        subject: {
          include: {
            branch: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    if (matchingTimeSlots.length === 0) {
      return res.status(407).json({
        success: false,
        error: `No classes scheduled for today (${getDayName(dayOfWeek)})`
      });
    }

    // Find the time slot that matches the current system time (within allowed window)
    let currentTimeSlot = null;
    const earlyAllowance = 15; // 15 minutes before
    const lateAllowance = 30;  // 30 minutes after

    for (const slot of matchingTimeSlots) {
      const startMinutes = getMinutesFromTimeString(slot.startTime);
      const endMinutes = getMinutesFromTimeString(slot.endTime);

      const earliestTime = startMinutes - earlyAllowance;
      const latestTime = endMinutes + lateAllowance;

      // Use current system time to determine if we're in the time window
      if (currentMinutes >= earliestTime && currentMinutes <= latestTime) {
        currentTimeSlot = slot;
        break;
      }
    }

    if (!currentTimeSlot) {
      const availableSlots = matchingTimeSlots.map((slot: any) =>
        `${slot.subject.name} (${slot.startTime}-${slot.endTime})`
      ).join(', ');

      return res.status(408).json({
        success: false,
        error: `No class found for current time (${currentTimeStr}). Today's classes: ${availableSlots}`
      });
    }

    // Use system date for attendance date (simulation date or server date) - using UTC to avoid timezone issues
    const attendanceDate = new Date(Date.UTC(systemTime.getUTCFullYear(), systemTime.getUTCMonth(), systemTime.getUTCDate()));

    let existingAttendance = await prisma.attendance.findUnique({
      where: {
        studentId_timeSlotId_date: {
          studentId: student.id,
          timeSlotId: currentTimeSlot.id,
          date: attendanceDate
        }
      }
    });

    // Determine attendance status based on scan time vs class start time
    const startMinutes = getMinutesFromTimeString(currentTimeSlot.startTime);
    let attendanceStatus: 'PRESENT' | 'LATE' = 'PRESENT';

    // Student is late if scan time is more than 10 minutes after start time
    if (scanMinutes > startMinutes + 10) {
      attendanceStatus = 'LATE';
    }

    const attendanceData = {
      studentId: student.id,
      timeSlotId: currentTimeSlot.id,
      date: attendanceDate,
      status: attendanceStatus,
      markedBy: 'fingerprint_scanner',
      remarks: `Scanned at ${scanTimeStr} UTC (System time: ${currentTimeStr} UTC)`
    };

    let attendance;

    if (existingAttendance) {
      // Check if attendance is already marked
      return res.status(409).json({
        success: false,
        error: 'Already Marked',
        message: `Attendance for ${student.name} in ${currentTimeSlot.subject.name} is already marked`,
        data: {
          student: {
            id: student.id,
            name: student.name,
            rollNumber: student.rollNumber,
            branch: student.branch,
            semester: student.semester
          },
          timeSlot: {
            id: currentTimeSlot.id,
            subject: {
              name: currentTimeSlot.subject.name,
              code: currentTimeSlot.subject.code
            },
            inchargeName: currentTimeSlot.inchargeName,
            timeSlot: `${currentTimeSlot.startTime} - ${currentTimeSlot.endTime}`,
            dayOfWeek: getDayName(currentTimeSlot.dayOfWeek),
            roomNumber: currentTimeSlot.roomNumber,
            scheduleType: currentTimeSlot.scheduleType
          },
          existingAttendance: {
            id: existingAttendance.id,
            status: existingAttendance.status,
            checkInTime: existingAttendance.checkInTime,
            date: existingAttendance.date
          }
        }
      });
    } else {
      // Create new attendance record
      attendance = await prisma.attendance.create({
        data: {
          ...attendanceData,
          checkInTime: scanTime,
        }
      });
    }

    // Prepare response
    const response = {
      success: true,
      message: 'Attendance marked successfully',
      data: {
        student: {
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          branch: student.branch,
          semester: student.semester
        },
        timeSlot: {
          id: currentTimeSlot.id,
          subject: {
            name: currentTimeSlot.subject.name,
            code: currentTimeSlot.subject.code
          },
          inchargeName: currentTimeSlot.inchargeName,
          timeSlot: `${currentTimeSlot.startTime} - ${currentTimeSlot.endTime}`,
          dayOfWeek: getDayName(currentTimeSlot.dayOfWeek),
          roomNumber: currentTimeSlot.roomNumber,
          scheduleType: currentTimeSlot.scheduleType
        },
        attendance: {
          id: attendance.id,
          date: attendance.date,
          status: attendance.status,
          checkInTime: attendance.checkInTime,
          scanTime: scanTime,
          isLate: attendanceStatus === 'LATE',
          remarks: attendance.remarks
        },
        timing: {
          systemTime: systemTime.toISOString(),
          scanTime: scanTime.toISOString(),
          systemTimeStr: currentTimeStr,
          scanTimeStr: scanTimeStr,
          usingSimulation: !!currentDateTime,
          dayOfWeek: getDayName(dayOfWeek)
        }
      }
    };
    if (attendanceStatus == 'PRESENT') {
      return res.status(200).json(response);
    }
    else if (attendanceStatus == 'LATE') {
      return res.status(201).json(response);
    }

  } catch (error) {
    console.error('Error processing fingerprint scan:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while processing fingerprint scan'
    });
  }
});

// GET /attendance/today - Get today's attendance summary (Updated for timetable system)
// Simulation Support: Pass 'currentDate' query parameter to get attendance for a specific date
// Example: GET /attendance/today?currentDate=2025-10-08
router.get('/today', async (req: Request, res: Response) => {
  try {
    const { currentDate } = req.query;

    // Use simulation date from frontend, or server date as fallback
    let today: Date;
    if (currentDate) {
      // Parse date string as YYYY-MM-DD and create UTC date to avoid timezone issues
      const dateString = currentDate as string;
      const dateParts = dateString.split('-');
      if (dateParts.length !== 3) {
        return res.status(400).json({
          success: false,
          error: 'Invalid currentDate format. Use YYYY-MM-DD format'
        });
      }
      today = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
      if (isNaN(today.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid currentDate format. Use YYYY-MM-DD format'
        });
      }
    } else {
      today = new Date();
      today.setUTCHours(0, 0, 0, 0);
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        date: today
      },
      include: {
        student: {
          include: {
            branch: {
              select: {
                name: true,
                code: true
              }
            }
          }
        },
        timeSlot: {
          include: {
            subject: {
              select: {
                name: true,
                code: true
              }
            },
            timetable: {
              include: {
                branch: {
                  select: {
                    name: true,
                    code: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { checkInTime: 'desc' }
      ]
    });

    const summary = {
      totalPresent: attendanceRecords.filter((a: any) => a.status === 'PRESENT').length,
      totalLate: attendanceRecords.filter((a: any) => a.status === 'LATE').length,
      totalAbsent: attendanceRecords.filter((a: any) => a.status === 'ABSENT').length,
      totalRecords: attendanceRecords.length
    };

    return res.status(200).json({
      success: true,
      data: {
        summary,
        date: today,
        usingSimulation: !!currentDate,
        attendanceRecords: attendanceRecords.map((record: any) => ({
          id: record.id,
          student: {
            name: record.student.name,
            rollNumber: record.student.rollNumber,
            branch: record.student.branch
          },
          timeSlot: {
            subject: record.timeSlot.subject,
            timeSlot: `${record.timeSlot.startTime} - ${record.timeSlot.endTime}`,
            inchargeName: record.timeSlot.inchargeName,
            roomNumber: record.timeSlot.roomNumber,
            scheduleType: record.timeSlot.scheduleType
          },
          status: record.status,
          checkInTime: record.checkInTime,
          remarks: record.remarks
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching attendance data'
    });
  }
});

// PUT /attendance/update - Manually update attendance by roll number, subject, and date
router.put('/update', async (req: Request, res: Response) => {
  try {
    const { rollNumber, subjectName, date, status, remarks } = req.body;

    // Validate required fields
    if (!rollNumber || !subjectName || !date || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: rollNumber, subjectName, date, status'
      });
    }

    // Validate status
    if (!['PRESENT', 'ABSENT', 'LATE'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be PRESENT, ABSENT, or LATE'
      });
    }

    // Parse and validate date
    let attendanceDate: Date;
    try {
      const dateParts = date.split('-');
      if (dateParts.length !== 3) {
        throw new Error('Invalid date format');
      }
      attendanceDate = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
      if (isNaN(attendanceDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format'
      });
    }

    // Find student by roll number
    const student = await prisma.student.findFirst({
      where: {
        rollNumber: rollNumber,
        isActive: true
      },
      include: {
        branch: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found with this roll number'
      });
    }

    // Find active timetable for student's branch and semester
    const activeTimetable = await prisma.timetable.findFirst({
    });

    if (!activeTimetable) {
      return res.status(404).json({
        success: false,
        error: 'No active timetable found for this student\'s branch and semester'
      });
    }

    // Find time slot by subject name for the given date
    const dayOfWeek = attendanceDate.getUTCDay() === 0 ? 7 : attendanceDate.getUTCDay();

    const timeSlot = await prisma.timeSlot.findFirst({
      where: {
        timetableId: activeTimetable.id,
        dayOfWeek: dayOfWeek,
        isActive: true,
        subject: {
          OR: [
            { name: { contains: subjectName, mode: 'insensitive' } },
            { code: { contains: subjectName, mode: 'insensitive' } }
          ]
        }
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        error: `No time slot found for subject "${subjectName}" on ${getDayName(dayOfWeek)}`
      });
    }

    // Check if attendance record already exists
    let existingAttendance = await prisma.attendance.findUnique({
      where: {
        studentId_timeSlotId_date: {
          studentId: student.id,
          timeSlotId: timeSlot.id,
          date: attendanceDate
        }
      }
    });

    const attendanceData = {
      studentId: student.id,
      timeSlotId: timeSlot.id,
      date: attendanceDate,
      status: status as 'PRESENT' | 'ABSENT' | 'LATE',
      markedBy: 'manual_update',
      remarks: remarks || `Manually updated to ${status}`
    };

    let attendance;

    if (existingAttendance) {
      // Check if trying to set the same status
      if (existingAttendance.status === status) {
        return res.status(400).json({
          success: false,
          error: 'Attendance already marked with same status',
          message: `Attendance for ${student.name} in ${timeSlot.subject.name} is already marked as ${status}`,
          data: {
            student: {
              id: student.id,
              name: student.name,
              rollNumber: student.rollNumber,
              branch: student.branch,
              semester: student.semester
            },
            timeSlot: {
              id: timeSlot.id,
              subject: timeSlot.subject,
              inchargeName: timeSlot.inchargeName,
              timeSlot: `${timeSlot.startTime} - ${timeSlot.endTime}`,
              dayOfWeek: getDayName(timeSlot.dayOfWeek),
              roomNumber: timeSlot.roomNumber,
              scheduleType: timeSlot.scheduleType
            },
            existingAttendance: {
              id: existingAttendance.id,
              status: existingAttendance.status,
              checkInTime: existingAttendance.checkInTime,
              date: existingAttendance.date,
              remarks: existingAttendance.remarks
            }
          }
        });
      }

      // Update existing attendance with different status
      attendance = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          ...attendanceData,
          checkInTime: status !== 'ABSENT' ? (existingAttendance.checkInTime || new Date()) : null,
          remarks: `${existingAttendance.remarks || ''} | Updated from ${existingAttendance.status} to ${status} manually`.trim()
        }
      });
    } else {
      // Create new attendance record
      attendance = await prisma.attendance.create({
        data: {
          ...attendanceData,
          checkInTime: status !== 'ABSENT' ? new Date() : null,
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: `Attendance ${existingAttendance ? 'updated' : 'created'} successfully`,
      data: {
        student: {
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          branch: student.branch,
          semester: student.semester
        },
        timeSlot: {
          id: timeSlot.id,
          subject: timeSlot.subject,
          inchargeName: timeSlot.inchargeName,
          timeSlot: `${timeSlot.startTime} - ${timeSlot.endTime}`,
          dayOfWeek: getDayName(timeSlot.dayOfWeek),
          roomNumber: timeSlot.roomNumber,
          scheduleType: timeSlot.scheduleType
        },
        attendance: {
          id: attendance.id,
          date: attendance.date,
          status: attendance.status,
          checkInTime: attendance.checkInTime,
          remarks: attendance.remarks,
          wasUpdated: !!existingAttendance
        }
      }
    });

  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while updating attendance'
    });
  }
});

// GET /attendance/student/:studentId - Get student attendance history
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const {
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50
    } = req.query;

    const studentIdNum = parseInt(studentId);
    if (isNaN(studentIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid student ID'
      });
    }

    const where: any = { studentId: studentIdNum };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    if (status) {
      where.status = status as string;
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [attendanceRecords, totalCount] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          timeSlot: {
            include: {
              subject: {
                select: {
                  name: true,
                  code: true
                }
              },
              timetable: {
                include: {
                  branch: {
                    select: {
                      name: true,
                      code: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.attendance.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        attendanceRecords: attendanceRecords.map((record: any) => ({
          id: record.id,
          date: record.date,
          status: record.status,
          checkInTime: record.checkInTime,
          timeSlot: {
            subject: record.timeSlot.subject,
            timeSlot: `${record.timeSlot.startTime} - ${record.timeSlot.endTime}`,
            inchargeName: record.timeSlot.inchargeName,
            roomNumber: record.timeSlot.roomNumber,
            scheduleType: record.timeSlot.scheduleType,
            dayOfWeek: getDayName(record.timeSlot.dayOfWeek)
          },
          remarks: record.remarks
        })),
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching student attendance:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching student attendance'
    });
  }
});

// Helper functions
function getDayName(dayOfWeek: number): string {
  const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayOfWeek] || 'Unknown';
}

function getMinutesFromTimeString(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export { router as attendanceRouter };