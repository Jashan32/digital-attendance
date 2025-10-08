import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface SetScheduleRequest {
  subjectId: number;
  inchargeName: string;
  inchargeId?: string;
  dayOfWeek: number; // 1=Monday, 2=Tuesday, ..., 7=Sunday
  startTime: string; // e.g., "09:00" (24-hour format)
  endTime: string; // e.g., "10:00"
  roomNumber?: string;
  scheduleType?: 'LECTURE' | 'PRACTICAL' | 'TUTORIAL' | 'SEMINAR' | 'EXAM';
  semester: number;
  academicYear: string; // e.g., "2023-24"
}

// POST /schedule/set - Remove previous schedule and set new one
router.post('/set', async (req: Request, res: Response) => {
  try {
    const {
      subjectId,
      inchargeName,
      inchargeId,
      dayOfWeek,
      startTime,
      endTime,
      roomNumber,
      scheduleType = 'LECTURE',
      semester,
      academicYear
    }: SetScheduleRequest = req.body;

    // Validate required fields
    if (!subjectId || !inchargeName || !dayOfWeek || !startTime || !endTime || !semester || !academicYear) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: subjectId, inchargeName, dayOfWeek, startTime, endTime, semester, academicYear'
      });
    }

    // Validate dayOfWeek range
    if (dayOfWeek < 1 || dayOfWeek > 7) {
      return res.status(400).json({
        success: false,
        error: 'dayOfWeek must be between 1 (Monday) and 7 (Sunday)'
      });
    }

    // Validate time format (basic check for HH:MM format)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid time format. Use HH:MM format (e.g., "09:00", "14:30")'
      });
    }

    // Validate that startTime is before endTime
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
    
    if (startMinutes >= endMinutes) {
      return res.status(400).json({
        success: false,
        error: 'Start time must be before end time'
      });
    }

    // Validate semester range
    if (semester < 1 || semester > 8) {
      return res.status(400).json({
        success: false,
        error: 'Semester must be between 1 and 8'
      });
    }

    // Check if subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: { branch: true }
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Step 1: Delete all existing schedules (as per requirement - only 1 schedule in project)
      const deletedSchedules = await tx.schedule.deleteMany({});
      
      // Step 2: Create the new schedule
      const newSchedule = await tx.schedule.create({
        data: {
          subjectId,
          inchargeName,
          inchargeId,
          dayOfWeek,
          startTime,
          endTime,
          roomNumber,
          scheduleType,
          semester,
          academicYear,
          isActive: true
        },
        include: {
          subject: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          }
        }
      });

      return {
        deletedCount: deletedSchedules.count,
        newSchedule
      };
    });

    // Format response
    const response = {
      success: true,
      message: `Successfully replaced schedule. Deleted ${result.deletedCount} previous schedule(s) and created new schedule.`,
      data: {
        schedule: {
          id: result.newSchedule.id,
          subject: {
            id: result.newSchedule.subject.id,
            name: result.newSchedule.subject.name,
            code: result.newSchedule.subject.code,
            branch: {
              name: result.newSchedule.subject.branch.name,
              code: result.newSchedule.subject.branch.code
            }
          },
          inchargeName: result.newSchedule.inchargeName,
          inchargeId: result.newSchedule.inchargeId,
          dayOfWeek: result.newSchedule.dayOfWeek,
          dayName: getDayName(result.newSchedule.dayOfWeek),
          startTime: result.newSchedule.startTime,
          endTime: result.newSchedule.endTime,
          roomNumber: result.newSchedule.roomNumber,
          scheduleType: result.newSchedule.scheduleType,
          semester: result.newSchedule.semester,
          academicYear: result.newSchedule.academicYear,
          isActive: result.newSchedule.isActive,
          createdAt: result.newSchedule.createdAt,
          updatedAt: result.newSchedule.updatedAt
        },
        previousSchedulesDeleted: result.deletedCount
      }
    };

    return res.status(201).json(response);

  } catch (error) {
    console.error('Error setting schedule:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while setting schedule'
    });
  }
});

// GET /schedule/current - Get current active schedule
router.get('/current', async (req: Request, res: Response) => {
  try {
    const currentSchedule = await prisma.schedule.findFirst({
      where: { isActive: true },
      include: {
        subject: {
          include: {
            branch: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!currentSchedule) {
      return res.status(404).json({
        success: false,
        message: 'No active schedule found'
      });
    }

    const response = {
      success: true,
      data: {
        schedule: {
          id: currentSchedule.id,
          subject: {
            id: currentSchedule.subject.id,
            name: currentSchedule.subject.name,
            code: currentSchedule.subject.code,
            branch: {
              name: currentSchedule.subject.branch.name,
              code: currentSchedule.subject.branch.code
            }
          },
          inchargeName: currentSchedule.inchargeName,
          inchargeId: currentSchedule.inchargeId,
          dayOfWeek: currentSchedule.dayOfWeek,
          dayName: getDayName(currentSchedule.dayOfWeek),
          startTime: currentSchedule.startTime,
          endTime: currentSchedule.endTime,
          roomNumber: currentSchedule.roomNumber,
          scheduleType: currentSchedule.scheduleType,
          semester: currentSchedule.semester,
          academicYear: currentSchedule.academicYear,
          isActive: currentSchedule.isActive,
          createdAt: currentSchedule.createdAt,
          updatedAt: currentSchedule.updatedAt
        }
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching current schedule:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching current schedule'
    });
  }
});

// Helper function to get day name from day number
function getDayName(dayOfWeek: number): string {
  const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayOfWeek] || 'Unknown';
}

export { router as setScheduleRouter };