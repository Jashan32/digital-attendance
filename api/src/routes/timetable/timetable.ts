import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface CreateTimetableRequest {
  name: string;
  branchId: number;
  semester: number;
  academicYear: string;
  timeSlots: TimeSlotData[];
}

interface TimeSlotData {
  subjectId: number;
  inchargeName: string;
  inchargeId?: string;
  dayOfWeek: number; // 1=Monday, 2=Tuesday, ..., 7=Sunday
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "10:00"
  roomNumber?: string;
  scheduleType?: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
}

interface UpdateTimeSlotRequest {
  subjectId?: number;
  inchargeName?: string;
  inchargeId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  roomNumber?: string;
  scheduleType?: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
  isActive?: boolean;
}

// POST /timetable/create - Create a new timetable with multiple time slots
router.post('/create', async (req: Request, res: Response) => {
  try {
    const {
      name,
      branchId,
      semester,
      academicYear,
      timeSlots
    }: CreateTimetableRequest = req.body;

    // Validate required fields
    if (!name || !branchId || !semester || !academicYear || !timeSlots || !Array.isArray(timeSlots)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, branchId, semester, academicYear, timeSlots (array)'
      });
    }

    // Validate semester
    if (semester < 1 || semester > 8) {
      return res.status(400).json({
        success: false,
        error: 'Semester must be between 1 and 8'
      });
    }

    // Validate branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        error: 'Branch not found'
      });
    }

    // Validate time slots
    const validationErrors: string[] = [];
    const subjectIds = new Set<number>();

    for (let i = 0; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      const errors: string[] = [];

      if (!slot.subjectId) errors.push('subjectId is required');
      if (!slot.inchargeName) errors.push('inchargeName is required');
      if (!slot.dayOfWeek || slot.dayOfWeek < 1 || slot.dayOfWeek > 7) {
        errors.push('dayOfWeek must be between 1-7');
      }
      if (!slot.startTime) errors.push('startTime is required');
      if (!slot.endTime) errors.push('endTime is required');

      // Validate time format
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (slot.startTime && !timeRegex.test(slot.startTime)) {
        errors.push('invalid startTime format (use HH:MM)');
      }
      if (slot.endTime && !timeRegex.test(slot.endTime)) {
        errors.push('invalid endTime format (use HH:MM)');
      }

      // Validate time logic
      if (slot.startTime && slot.endTime) {
        const startMinutes = getMinutesFromTime(slot.startTime);
        const endMinutes = getMinutesFromTime(slot.endTime);
        if (startMinutes >= endMinutes) {
          errors.push('startTime must be before endTime');
        }
      }

      if (slot.subjectId) {
        subjectIds.add(slot.subjectId);
      }

      if (errors.length > 0) {
        validationErrors.push(`TimeSlot ${i + 1}: ${errors.join(', ')}`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation errors in time slots',
        details: validationErrors
      });
    }

    // Check if all subjects exist and belong to the same branch
    const subjects = await prisma.subject.findMany({
      where: { 
        id: { in: Array.from(subjectIds) },
        branchId: branchId 
      }
    });

    if (subjects.length !== subjectIds.size) {
      return res.status(404).json({
        success: false,
        error: 'One or more subjects not found or do not belong to the specified branch'
      });
    }

    // Check for time conflicts within the same timetable
    const conflicts = checkTimeConflicts(timeSlots);
    if (conflicts.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Time conflicts detected',
        details: conflicts
      });
    }

    // Create timetable with time slots in transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete ALL existing timetables (only one timetable should exist at a time)
      // First delete all time slots, then delete all timetables
      await tx.timeSlot.deleteMany({});
      await tx.timetable.deleteMany({});

      // Create new timetable
      const newTimetable = await tx.timetable.create({
        data: {
          name,
          branchId,
          semester,
          academicYear,
          isActive: true
        }
      });

      // Create time slots
      const createdTimeSlots = await Promise.all(
        timeSlots.map(slot =>
          tx.timeSlot.create({
            data: {
              timetableId: newTimetable.id,
              subjectId: slot.subjectId,
              inchargeName: slot.inchargeName,
              inchargeId: slot.inchargeId,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              roomNumber: slot.roomNumber,
              scheduleType: slot.scheduleType || 'LECTURE',
              isActive: true
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
          })
        )
      );

      return {
        timetable: newTimetable,
        timeSlots: createdTimeSlots
      };
    });

    return res.status(201).json({
      success: true,
      message: 'Timetable created successfully',
      data: {
        timetable: {
          id: result.timetable.id,
          name: result.timetable.name,
          branch: {
            id: branch.id,
            name: branch.name,
            code: branch.code
          },
          semester: result.timetable.semester,
          academicYear: result.timetable.academicYear,
          isActive: result.timetable.isActive,
          timeSlots: result.timeSlots.map((slot: any) => ({
            id: slot.id,
            subject: slot.subject,
            inchargeName: slot.inchargeName,
            dayOfWeek: slot.dayOfWeek,
            dayName: getDayName(slot.dayOfWeek),
            startTime: slot.startTime,
            endTime: slot.endTime,
            roomNumber: slot.roomNumber,
            scheduleType: slot.scheduleType
          }))
        }
      }
    });

  } catch (error) {
    console.error('Error creating timetable:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while creating timetable'
    });
  }
});

// GET /timetable/all - Get all timetables with optional filters
router.get('/all', async (req: Request, res: Response) => {
  try {
    const { branchId, semester, isActive, page = 1, limit = 50 } = req.query;

    const where: any = {};
    if (branchId) where.branchId = parseInt(branchId as string);
    if (semester) where.semester = parseInt(semester as string);
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [timetables, totalCount] = await Promise.all([
      prisma.timetable.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          timeSlots: {
            include: {
              subject: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            },
            orderBy: [
              { dayOfWeek: 'asc' },
              { startTime: 'asc' }
            ]
          },
          _count: {
            select: {
              timeSlots: true
            }
          }
        },
        orderBy: [
          { isActive: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limitNum
      }),
      prisma.timetable.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    // Format timetables with weekly schedule
    const formattedTimetables = timetables.map((timetable: any) => {
      const weeklySchedule: any = {};
      const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      timetable.timeSlots.forEach((slot: any) => {
        const dayName = days[slot.dayOfWeek];
        if (!weeklySchedule[dayName]) {
          weeklySchedule[dayName] = [];
        }
        weeklySchedule[dayName].push({
          id: slot.id,
          subject: slot.subject,
          inchargeName: slot.inchargeName,
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomNumber: slot.roomNumber,
          scheduleType: slot.scheduleType,
          isActive: slot.isActive
        });
      });

      return {
        id: timetable.id,
        name: timetable.name,
        branch: timetable.branch,
        semester: timetable.semester,
        academicYear: timetable.academicYear,
        isActive: timetable.isActive,
        weeklySchedule,
        totalSlots: timetable._count.timeSlots,
        createdAt: timetable.createdAt,
        updatedAt: timetable.updatedAt
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        timetables: formattedTimetables,
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
    console.error('Error fetching all timetables:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching timetables'
    });
  }
});

// GET /timetable/active - Get active timetable for branch/semester
router.get('/active', async (req: Request, res: Response) => {
  try {
    const { branchId, semester } = req.query;

    if (!branchId || !semester) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: branchId, semester'
      });
    }

    const timetable = await prisma.timetable.findFirst({
      where: {
        branchId: parseInt(branchId as string),
        semester: parseInt(semester as string),
        isActive: true
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        timeSlots: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' }
          ]
        }
      }
    });

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'No active timetable found for the specified branch and semester'
      });
    }

    // Group time slots by day
    const weeklySchedule: any = {};
    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    timetable.timeSlots.forEach((slot: any) => {
      const dayName = days[slot.dayOfWeek];
      if (!weeklySchedule[dayName]) {
        weeklySchedule[dayName] = [];
      }
      weeklySchedule[dayName].push({
        id: slot.id,
        subject: slot.subject,
        inchargeName: slot.inchargeName,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber,
        scheduleType: slot.scheduleType,
        isActive: slot.isActive
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        timetable: {
          id: timetable.id,
          name: timetable.name,
          branch: timetable.branch,
          semester: timetable.semester,
          academicYear: timetable.academicYear,
          weeklySchedule,
          totalSlots: timetable.timeSlots.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching active timetable:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching timetable'
    });
  }
});

// GET /timetable/current-slot - Get current time slot based on current time
// Simulation Support: Pass 'currentDateTime' query parameter to get time slot for a specific date/time
// Example: GET /timetable/current-slot?branchId=1&semester=3&currentDateTime=2025-10-08T09:30:00Z
router.get('/current-slot', async (req: Request, res: Response) => {
  try {
    const { branchId, semester, currentDateTime } = req.query;

    if (!branchId || !semester) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: branchId, semester'
      });
    }

    // Use simulation time from frontend, or server time as fallback
    let now: Date;
    if (currentDateTime) {
      now = new Date(currentDateTime as string);
      if (isNaN(now.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid currentDateTime format. Use ISO 8601 format (e.g., 2025-10-08T09:30:00Z)'
        });
      }
    } else {
      now = new Date();
    }

    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    const currentMinutes = getMinutesFromTime(currentTime);

    // Convert JS day (0=Sunday) to our format (1=Monday, 7=Sunday)
    const dayOfWeek = currentDay === 0 ? 7 : currentDay;

    // Find active timetable
    const timetable = await prisma.timetable.findFirst({
      where: {
        branchId: parseInt(branchId as string),
        semester: parseInt(semester as string),
        isActive: true
      }
    });

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'No active timetable found'
      });
    }

    // Find current or next time slot
    const currentSlot = await prisma.timeSlot.findFirst({
      where: {
        timetableId: timetable.id,
        dayOfWeek: dayOfWeek,
        isActive: true
      },
      include: {
        subject: {
          include: {
            branch: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    if (!currentSlot) {
      return res.status(404).json({
        success: false,
        message: 'No classes scheduled for today'
      });
    }

    const startMinutes = getMinutesFromTime(currentSlot.startTime);
    const endMinutes = getMinutesFromTime(currentSlot.endTime);

    let status = 'upcoming';
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      status = 'ongoing';
    } else if (currentMinutes > endMinutes) {
      status = 'completed';
    }

    return res.status(200).json({
      success: true,
      data: {
        currentSlot: {
          id: currentSlot.id,
          subject: currentSlot.subject,
          inchargeName: currentSlot.inchargeName,
          startTime: currentSlot.startTime,
          endTime: currentSlot.endTime,
          roomNumber: currentSlot.roomNumber,
          scheduleType: currentSlot.scheduleType,
          status,
          isActive: currentSlot.isActive
        },
        currentTime,
        dayOfWeek: getDayName(dayOfWeek),
        simulation: {
          usedSimulationTime: !!currentDateTime,
          simulationDateTime: currentDateTime || now.toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error fetching current time slot:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching current time slot'
    });
  }
});

// PUT /timetable/timeslot/:id - Update a specific time slot
router.put('/timeslot/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: UpdateTimeSlotRequest = req.body;

    // Check if time slot exists
    const existingSlot = await prisma.timeSlot.findUnique({
      where: { id: parseInt(id) },
      include: {
        timetable: true,
        subject: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!existingSlot) {
      return res.status(404).json({
        success: false,
        error: 'Time slot not found'
      });
    }

    // Validate updates
    if (updates.dayOfWeek && (updates.dayOfWeek < 1 || updates.dayOfWeek > 7)) {
      return res.status(400).json({
        success: false,
        error: 'dayOfWeek must be between 1 and 7'
      });
    }

    // Validate time format if provided
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (updates.startTime && !timeRegex.test(updates.startTime)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startTime format. Use HH:MM format'
      });
    }
    if (updates.endTime && !timeRegex.test(updates.endTime)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid endTime format. Use HH:MM format'
      });
    }

    // Validate time logic
    const newStartTime = updates.startTime || existingSlot.startTime;
    const newEndTime = updates.endTime || existingSlot.endTime;
    
    if (getMinutesFromTime(newStartTime) >= getMinutesFromTime(newEndTime)) {
      return res.status(400).json({
        success: false,
        error: 'Start time must be before end time'
      });
    }

    // Update the time slot
    const updatedSlot = await prisma.timeSlot.update({
      where: { id: parseInt(id) },
      data: updates,
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

    return res.status(200).json({
      success: true,
      message: 'Time slot updated successfully',
      data: {
        timeSlot: {
          id: updatedSlot.id,
          subject: updatedSlot.subject,
          inchargeName: updatedSlot.inchargeName,
          dayOfWeek: updatedSlot.dayOfWeek,
          dayName: getDayName(updatedSlot.dayOfWeek),
          startTime: updatedSlot.startTime,
          endTime: updatedSlot.endTime,
          roomNumber: updatedSlot.roomNumber,
          scheduleType: updatedSlot.scheduleType,
          isActive: updatedSlot.isActive
        }
      }
    });

  } catch (error) {
    console.error('Error updating time slot:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while updating time slot'
    });
  }
});

// DELETE /timetable/timeslot/:id - Delete a time slot
router.delete('/timeslot/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingSlot = await prisma.timeSlot.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            attendances: true
          }
        }
      }
    });

    if (!existingSlot) {
      return res.status(404).json({
        success: false,
        error: 'Time slot not found'
      });
    }

    // Check if there are attendance records
    if (existingSlot._count.attendances > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete time slot. It has ${existingSlot._count.attendances} attendance records.`
      });
    }

    await prisma.timeSlot.delete({
      where: { id: parseInt(id) }
    });

    return res.status(200).json({
      success: true,
      message: 'Time slot deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting time slot:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while deleting time slot'
    });
  }
});

// Helper functions
function getMinutesFromTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getDayName(dayOfWeek: number): string {
  const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayOfWeek] || 'Unknown';
}

function checkTimeConflicts(timeSlots: TimeSlotData[]): string[] {
  const conflicts: string[] = [];
  
  for (let i = 0; i < timeSlots.length; i++) {
    for (let j = i + 1; j < timeSlots.length; j++) {
      const slot1 = timeSlots[i];
      const slot2 = timeSlots[j];
      
      // Check if same day
      if (slot1.dayOfWeek === slot2.dayOfWeek) {
        const start1 = getMinutesFromTime(slot1.startTime);
        const end1 = getMinutesFromTime(slot1.endTime);
        const start2 = getMinutesFromTime(slot2.startTime);
        const end2 = getMinutesFromTime(slot2.endTime);
        
        // Check for overlap
        if ((start1 < end2 && end1 > start2)) {
          conflicts.push(
            `Time conflict on ${getDayName(slot1.dayOfWeek)}: ` +
            `${slot1.startTime}-${slot1.endTime} overlaps with ${slot2.startTime}-${slot2.endTime}`
          );
        }
      }
    }
  }
  
  return conflicts;
}

export { router as timetableRouter };