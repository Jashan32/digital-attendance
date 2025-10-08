import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /admin/dashboard - Get system dashboard statistics
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [
      totalStudents,
      totalBranches,
      totalSubjects,
      totalSchedules,
      activeStudents,
      todayAttendance,
      thisMonthAttendance,
      recentActivity
    ] = await Promise.all([
      // Total students
      prisma.student.count(),
      
      // Total branches
      prisma.branch.count(),
      
      // Total subjects
      prisma.subject.count(),
      
      // Total schedules
      prisma.schedule.count(),
      
      // Active students
      prisma.student.count({
        where: { isActive: true }
      }),
      
      // Today's attendance
      prisma.attendance.count({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      }),
      
      // This month's attendance
      prisma.attendance.count({
        where: {
          date: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
          }
        }
      }),
      
      // Recent activity (last 10 attendance records)
      prisma.attendance.findMany({
        include: {
          student: {
            select: {
              name: true,
              rollNumber: true
            }
          },
          schedule: {
            include: {
              subject: {
                select: {
                  name: true,
                  code: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    // Get branch-wise student distribution
    const branchStats = await prisma.branch.findMany({
      include: {
        _count: {
          select: {
            students: true,
            subjects: true
          }
        }
      }
    });

    // Get attendance statistics for the last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date;
    }).reverse();

    const weeklyAttendance = await Promise.all(
      last7Days.map(async (date) => {
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));
        
        const [total, present, absent, late] = await Promise.all([
          prisma.attendance.count({
            where: { date: { gte: dayStart, lte: dayEnd } }
          }),
          prisma.attendance.count({
            where: { 
              date: { gte: dayStart, lte: dayEnd },
              status: 'PRESENT'
            }
          }),
          prisma.attendance.count({
            where: { 
              date: { gte: dayStart, lte: dayEnd },
              status: 'ABSENT'
            }
          }),
          prisma.attendance.count({
            where: { 
              date: { gte: dayStart, lte: dayEnd },
              status: 'LATE'
            }
          })
        ]);

        return {
          date: dayStart.toISOString().split('T')[0],
          total,
          present,
          absent,
          late
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalBranches,
          totalSubjects,
          totalSchedules,
          activeStudents,
          inactiveStudents: totalStudents - activeStudents
        },
        attendance: {
          today: todayAttendance,
          thisMonth: thisMonthAttendance,
          weeklyTrend: weeklyAttendance
        },
        branchDistribution: branchStats.map((branch: any) => ({
          id: branch.id,
          name: branch.name,
          code: branch.code,
          studentCount: branch._count.students,
          subjectCount: branch._count.subjects
        })),
        recentActivity: recentActivity.map((record: any) => ({
          id: record.id,
          timestamp: record.createdAt,
          student: record.student,
          subject: record.schedule.subject,
          status: record.status,
          checkInTime: record.checkInTime
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching dashboard data'
    });
  }
});

// POST /admin/bulk/students - Bulk import students
router.post('/bulk/students', async (req: Request, res: Response) => {
  try {
    const { students }: { students: any[] } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Students array is required and must not be empty'
      });
    }

    // Validate each student record
    const validationErrors: string[] = [];
    const validStudents: any[] = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const errors: string[] = [];

      if (!student.name) errors.push('name is required');
      if (!student.rollNumber) errors.push('rollNumber is required');
      if (!student.branchId) errors.push('branchId is required');
      if (!student.semester || student.semester < 1 || student.semester > 8) {
        errors.push('semester must be between 1 and 8');
      }
      if (!student.fingerId) errors.push('fingerId is required');
      if (!student.admissionYear) errors.push('admissionYear is required');

      if (errors.length > 0) {
        validationErrors.push(`Student ${i + 1}: ${errors.join(', ')}`);
      } else {
        validStudents.push({
          name: student.name.trim(),
          rollNumber: student.rollNumber.trim().toUpperCase(),
          email: student.email?.trim().toLowerCase(),
          phone: student.phone?.replace(/[\s\-\(\)]/g, ''),
          branchId: student.branchId,
          semester: student.semester,
          fingerId: parseInt(student.fingerId),
          fingerPrintId: student.fingerPrintId?.trim(),
          admissionYear: student.admissionYear,
          isActive: student.isActive !== undefined ? student.isActive : true
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation errors found',
        details: validationErrors
      });
    }

    // Check for duplicate roll numbers and finger IDs within the batch
    const rollNumbers = validStudents.map(s => s.rollNumber);
    const fingerIds = validStudents.map(s => s.fingerId);
    
    const duplicateRolls = rollNumbers.filter((item, index) => rollNumbers.indexOf(item) !== index);
    const duplicateFingers = fingerIds.filter((item, index) => fingerIds.indexOf(item) !== index);

    if (duplicateRolls.length > 0 || duplicateFingers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate entries found in batch',
        details: {
          duplicateRollNumbers: [...new Set(duplicateRolls)],
          duplicateFingerIds: [...new Set(duplicateFingers)]
        }
      });
    }

    // Check for existing records in database
    const [existingRolls, existingFingers] = await Promise.all([
      prisma.student.findMany({
        where: { rollNumber: { in: rollNumbers } },
        select: { rollNumber: true }
      }),
      prisma.student.findMany({
        where: { fingerId: { in: fingerIds } },
        select: { fingerId: true }
      })
    ]);

    const existingRollNumbers = existingRolls.map((s: any) => s.rollNumber);
    const existingFingerIds = existingFingers.map((s: any) => s.fingerId);

    if (existingRollNumbers.length > 0 || existingFingerIds.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Some records already exist in database',
        details: {
          existingRollNumbers,
          existingFingerIds
        }
      });
    }

    // Bulk create students
    const createdStudents = await prisma.student.createMany({
      data: validStudents,
      skipDuplicates: true
    });

    return res.status(201).json({
      success: true,
      message: `Successfully created ${createdStudents.count} students`,
      data: {
        createdCount: createdStudents.count,
        totalProcessed: students.length
      }
    });

  } catch (error) {
    console.error('Error in bulk student import:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while importing students'
    });
  }
});

// DELETE /admin/cleanup/attendance - Clean up old attendance records
router.delete('/cleanup/attendance', async (req: Request, res: Response) => {
  try {
    const { olderThanDays = 365 } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays as string));

    const deletedRecords = await prisma.attendance.deleteMany({
      where: {
        date: {
          lt: cutoffDate
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${deletedRecords.count} attendance records older than ${olderThanDays} days`,
      data: {
        deletedCount: deletedRecords.count,
        cutoffDate: cutoffDate.toISOString()
      }
    });

  } catch (error) {
    console.error('Error cleaning up attendance records:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while cleaning up attendance records'
    });
  }
});

// GET /admin/system/status - Get system status
router.get('/system/status', async (req: Request, res: Response) => {
  try {
    const [
      dbStatus,
      totalRecords,
      lastAttendanceRecord,
      activeSchedules
    ] = await Promise.all([
      // Database connection test
      prisma.$queryRaw`SELECT 1`,
      
      // Total records count
      Promise.all([
        prisma.student.count(),
        prisma.branch.count(),
        prisma.subject.count(),
        prisma.schedule.count(),
        prisma.attendance.count()
      ]),
      
      // Last attendance record
      prisma.attendance.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: { name: true, rollNumber: true }
          }
        }
      }),
      
      // Active schedules
      prisma.schedule.count({
        where: { isActive: true }
      })
    ]);

    const [studentCount, branchCount, subjectCount, scheduleCount, attendanceCount] = totalRecords;

    return res.status(200).json({
      success: true,
      data: {
        system: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database: {
            connected: true,
            lastQuery: new Date().toISOString()
          }
        },
        statistics: {
          students: studentCount,
          branches: branchCount,
          subjects: subjectCount,
          schedules: scheduleCount,
          attendanceRecords: attendanceCount,
          activeSchedules
        },
        lastActivity: lastAttendanceRecord ? {
          timestamp: lastAttendanceRecord.createdAt,
          student: lastAttendanceRecord.student,
          status: lastAttendanceRecord.status
        } : null
      }
    });

  } catch (error) {
    console.error('Error fetching system status:', error);
    return res.status(200).json({
      success: false,
      data: {
        system: {
          status: 'error',
          timestamp: new Date().toISOString(),
          database: {
            connected: false,
            error: 'Database connection failed'
          }
        },
        error: 'System health check failed'
      }
    });
  }
});

// POST /admin/maintenance/reset-fingerprints - Reset all fingerprint IDs (for testing)
router.post('/maintenance/reset-fingerprints', async (req: Request, res: Response) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'RESET_ALL_FINGERPRINTS') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send { "confirm": "RESET_ALL_FINGERPRINTS" }'
      });
    }

    // Update all students with sequential finger IDs
    const students = await prisma.student.findMany({
      orderBy: { rollNumber: 'asc' }
    });

    const updates = students.map((student: any, index: number) => 
      prisma.student.update({
        where: { id: student.id },
        data: { fingerId: index + 1 }
      })
    );

    await prisma.$transaction(updates);

    return res.status(200).json({
      success: true,
      message: `Reset fingerprint IDs for ${students.length} students`,
      data: {
        updatedCount: students.length,
        newRange: `1 to ${students.length}`
      }
    });

  } catch (error) {
    console.error('Error resetting fingerprint IDs:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while resetting fingerprint IDs'
    });
  }
});

export { router as adminRouter };