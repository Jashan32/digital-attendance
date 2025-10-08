import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /reports/attendance/summary - Get attendance summary statistics
router.get('/attendance/summary', async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate, 
      branchId, 
      semester,
      subjectId 
    } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {
        date: {
          ...(startDate && { gte: new Date(startDate as string) }),
          ...(endDate && { lte: new Date(endDate as string) })
        }
      };
    }

    const where: any = { ...dateFilter };

    if (branchId || semester) {
      where.student = {
        ...(branchId && { branchId: branchId as string }),
        ...(semester && { semester: parseInt(semester as string) })
      };
    }

    if (subjectId) {
      where.schedule = {
        subjectId: subjectId as string
      };
    }

    const [
      totalAttendance,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      uniqueStudents,
      branchWiseStats
    ] = await Promise.all([
      // Total attendance records
      prisma.attendance.count({ where }),
      
      // Present count
      prisma.attendance.count({
        where: { ...where, status: 'PRESENT' }
      }),
      
      // Absent count
      prisma.attendance.count({
        where: { ...where, status: 'ABSENT' }
      }),
      
      // Late count
      prisma.attendance.count({
        where: { ...where, status: 'LATE' }
      }),
      
      // Excused count
      prisma.attendance.count({
        where: { ...where, status: 'EXCUSED' }
      }),
      
      // Unique students
      prisma.attendance.findMany({
        where,
        select: { studentId: true },
        distinct: ['studentId']
      }),
      
      // Branch-wise statistics
      prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: {
          status: true
        }
      })
    ]);

    const attendancePercentage = totalAttendance > 0 
      ? Math.round(((presentCount + lateCount) / totalAttendance) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRecords: totalAttendance,
          uniqueStudents: uniqueStudents.length,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          attendancePercentage,
          statusDistribution: branchWiseStats.reduce((acc: any, item: any) => {
            acc[item.status] = item._count.status;
            return acc;
          }, {})
        },
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          branchId: branchId || null,
          semester: semester || null,
          subjectId: subjectId || null
        }
      }
    });

  } catch (error) {
    console.error('Error generating attendance summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating attendance summary'
    });
  }
});

// GET /reports/attendance/detailed - Get detailed attendance report
router.get('/attendance/detailed', async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate, 
      branchId, 
      semester,
      subjectId,
      status,
      page = 1,
      limit = 100,
      format = 'json'
    } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {
        date: {
          ...(startDate && { gte: new Date(startDate as string) }),
          ...(endDate && { lte: new Date(endDate as string) })
        }
      };
    }

    const where: any = { ...dateFilter };

    if (status) {
      where.status = status as string;
    }

    if (branchId || semester) {
      where.student = {
        ...(branchId && { branchId: branchId as string }),
        ...(semester && { semester: parseInt(semester as string) })
      };
    }

    if (subjectId) {
      where.schedule = {
        subjectId: subjectId as string
      };
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 100;
    const skip = (pageNum - 1) * limitNum;

    const [attendanceRecords, totalCount] = await Promise.all([
      prisma.attendance.findMany({
        where,
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
        orderBy: [
          { date: 'desc' },
          { checkInTime: 'desc' }
        ],
        skip,
        take: limitNum
      }),
      prisma.attendance.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedRecords = attendanceRecords.map((record: any) => ({
      id: record.id,
      date: record.date,
      status: record.status,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      student: {
        name: record.student.name,
        rollNumber: record.student.rollNumber,
        semester: record.student.semester,
        branch: record.student.branch
      },
      subject: record.schedule.subject,
      schedule: {
        inchargeName: record.schedule.inchargeName,
        startTime: record.schedule.startTime,
        endTime: record.schedule.endTime,
        roomNumber: record.schedule.roomNumber
      },
      markedBy: record.markedBy,
      remarks: record.remarks
    }));

    if (format === 'csv') {
      // Generate CSV format
      const csvHeaders = [
        'Date', 'Student Name', 'Roll Number', 'Branch', 'Subject', 
        'Status', 'Check In', 'Check Out', 'Incharge', 'Room', 'Remarks'
      ].join(',');

      const csvRows = formattedRecords.map((record: any) => [
        record.date,
        record.student.name,
        record.student.rollNumber,
        record.student.branch.code,
        record.subject.code,
        record.status,
        record.checkInTime || '',
        record.checkOutTime || '',
        record.schedule.inchargeName,
        record.schedule.roomNumber || '',
        record.remarks || ''
      ].join(','));

      const csv = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance-report.csv');
      return res.send(csv);
    }

    return res.status(200).json({
      success: true,
      data: {
        attendanceRecords: formattedRecords,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        },
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          branchId: branchId || null,
          semester: semester || null,
          subjectId: subjectId || null,
          status: status || null
        }
      }
    });

  } catch (error) {
    console.error('Error generating detailed attendance report:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating detailed attendance report'
    });
  }
});

// GET /reports/student/:studentId/attendance - Get individual student attendance report
router.get('/student/:studentId/attendance', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const { 
      startDate, 
      endDate, 
      subjectId 
    } = req.query;

    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
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
        error: 'Student not found'
      });
    }

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {
        date: {
          ...(startDate && { gte: new Date(startDate as string) }),
          ...(endDate && { lte: new Date(endDate as string) })
        }
      };
    }

    const where: any = { 
      studentId,
      ...dateFilter,
      ...(subjectId && {
        schedule: {
          subjectId: subjectId as string
        }
      })
    };

    const [
      attendanceRecords,
      totalClasses,
      presentCount,
      absentCount,
      lateCount,
      excusedCount
    ] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
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
        orderBy: { date: 'desc' }
      }),
      
      prisma.attendance.count({ where }),
      
      prisma.attendance.count({
        where: { ...where, status: 'PRESENT' }
      }),
      
      prisma.attendance.count({
        where: { ...where, status: 'ABSENT' }
      }),
      
      prisma.attendance.count({
        where: { ...where, status: 'LATE' }
      }),
      
      prisma.attendance.count({
        where: { ...where, status: 'EXCUSED' }
      })
    ]);

    const attendancePercentage = totalClasses > 0 
      ? Math.round(((presentCount + lateCount) / totalClasses) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          branch: student.branch,
          semester: student.semester,
          admissionYear: student.admissionYear
        },
        statistics: {
          totalClasses,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          attendancePercentage
        },
        attendanceRecords: attendanceRecords.map((record: any) => ({
          id: record.id,
          date: record.date,
          status: record.status,
          checkInTime: record.checkInTime,
          checkOutTime: record.checkOutTime,
          subject: record.schedule.subject,
          remarks: record.remarks
        })),
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          subjectId: subjectId || null
        }
      }
    });

  } catch (error) {
    console.error('Error generating student attendance report:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating student attendance report'
    });
  }
});

// GET /reports/branch/:branchId/attendance - Get branch-wise attendance analytics
router.get('/branch/:branchId/attendance', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const { 
      startDate, 
      endDate, 
      semester 
    } = req.query;

    // Get branch details
    const branch = await prisma.branch.findUnique({
      where: { id: parseInt(branchId) },
      include: {
        _count: {
          select: {
            students: true,
            subjects: true
          }
        }
      }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        error: 'Branch not found'
      });
    }

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {
        date: {
          ...(startDate && { gte: new Date(startDate as string) }),
          ...(endDate && { lte: new Date(endDate as string) })
        }
      };
    }

    const where: any = { 
      student: {
        branchId,
        ...(semester && { semester: parseInt(semester as string) })
      },
      ...dateFilter
    };

    const [
      attendanceSummary,
      semesterWiseStats,
      subjectWiseStats,
      studentWiseStats
    ] = await Promise.all([
      // Overall attendance summary
      prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: {
          status: true
        }
      }),
      
      // Semester-wise statistics
      prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: {
          status: true
        }
      }),
      
      // Subject-wise statistics
      prisma.attendance.findMany({
        where,
        include: {
          schedule: {
            include: {
              subject: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          }
        }
      }),
      
      // Student-wise statistics
      prisma.attendance.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              semester: true
            }
          }
        }
      })
    ]);

    // Process subject-wise stats
    const subjectStats = subjectWiseStats.reduce((acc: any, record: any) => {
      const subjectId = record.schedule.subject.id;
      if (!acc[subjectId]) {
        acc[subjectId] = {
          subject: record.schedule.subject,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0
        };
      }
      acc[subjectId][record.status.toLowerCase()]++;
      acc[subjectId].total++;
      return acc;
    }, {});

    // Process student-wise stats
    const studentStats = studentWiseStats.reduce((acc: any, record: any) => {
      const studentId = record.student.id;
      if (!acc[studentId]) {
        acc[studentId] = {
          student: record.student,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0
        };
      }
      acc[studentId][record.status.toLowerCase()]++;
      acc[studentId].total++;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        branch: {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          totalStudents: branch._count.students,
          totalSubjects: branch._count.subjects
        },
        summary: attendanceSummary.reduce((acc: any, item: any) => {
          acc[item.status.toLowerCase()] = item._count.status;
          return acc;
        }, { present: 0, absent: 0, late: 0, excused: 0 }),
        subjectWiseAnalytics: Object.values(subjectStats),
        studentWiseAnalytics: Object.values(studentStats).map((stat: any) => ({
          ...stat,
          attendancePercentage: stat.total > 0 
            ? Math.round(((stat.present + stat.late) / stat.total) * 100)
            : 0
        })),
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          semester: semester || null
        }
      }
    });

  } catch (error) {
    console.error('Error generating branch attendance analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating branch attendance analytics'
    });
  }
});

export { router as reportsRouter };