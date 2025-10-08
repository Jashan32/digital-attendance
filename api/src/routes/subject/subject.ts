import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface CreateSubjectRequest {
  name: string;
  code: string;
  credits?: number;
  semester: number;
  branchId: number;
  description?: string;
}

// POST /subject/create - Create a new subject
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      code, 
      credits = 3, 
      semester, 
      branchId, 
      description 
    }: CreateSubjectRequest = req.body;

    // Validate required fields
    if (!name || !code || !semester || !branchId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, code, semester, branchId'
      });
    }

    // Validate semester range
    if (semester < 1 || semester > 8) {
      return res.status(400).json({
        success: false,
        error: 'Semester must be between 1 and 8'
      });
    }

    // Validate credits
    if (credits < 1 || credits > 10) {
      return res.status(400).json({
        success: false,
        error: 'Credits must be between 1 and 10'
      });
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        error: 'Branch not found'
      });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check for duplicate code
    const existingCode = await prisma.subject.findUnique({
      where: { code: cleanCode }
    });

    if (existingCode) {
      return res.status(409).json({
        success: false,
        error: 'Subject code already exists'
      });
    }

    // Create the subject
    const newSubject = await prisma.subject.create({
      data: {
        name: name.trim(),
        code: cleanCode,
        credits,
        semester,
        branchId,
        description: description?.trim()
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: {
        subject: newSubject
      }
    });

  } catch (error) {
    console.error('Error creating subject:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while creating subject'
    });
  }
});

// GET /subject/all - Get all subjects
router.get('/all', async (req: Request, res: Response) => {
  try {
    const { 
      branchId,
      semester,
      search,
      includeSchedules = false,
      page = 1,
      limit = 50
    } = req.query;

    const where: any = {};

    if (branchId) {
      where.branchId = parseInt(branchId as string);
    }

    if (semester) {
      where.semester = parseInt(semester as string);
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [subjects, totalCount] = await Promise.all([
      prisma.subject.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          ...(includeSchedules === 'true' && {
            schedules: {
              select: {
                id: true,
                inchargeName: true,
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                roomNumber: true,
                scheduleType: true,
                isActive: true
              }
            }
          })
        },
        orderBy: [
          { branch: { name: 'asc' } },
          { semester: 'asc' },
          { name: 'asc' }
        ],
        skip,
        take: limitNum
      }),
      prisma.subject.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        subjects,
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
    console.error('Error fetching subjects:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching subjects'
    });
  }
});

// GET /subject/:id - Get subject by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const subject = await prisma.subject.findUnique({
      where: { id: parseInt(id) },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true
          }
        },
        schedules: {
          include: {
            _count: {
              select: {
                attendances: true
              }
            }
          }
        }
      }
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        subject: {
          ...subject,
          schedules: subject.schedules.map((schedule: any) => ({
            ...schedule,
            attendanceCount: schedule._count.attendances
          }))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching subject:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching subject'
    });
  }
});

// GET /subject/branch/:branchId - Get subjects by branch
router.get('/branch/:branchId', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const { semester } = req.query;

    const where: any = { branchId: parseInt(branchId) };

    if (semester) {
      where.semester = parseInt(semester as string);
    }

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        branch: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: [
        { semester: 'asc' },
        { name: 'asc' }
      ]
    });

    // Group by semester
    const subjectsBySemester = subjects.reduce((acc: any, subject: any) => {
      if (!acc[subject.semester]) {
        acc[subject.semester] = [];
      }
      acc[subject.semester].push(subject);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        subjects,
        subjectsBySemester,
        totalCount: subjects.length
      }
    });

  } catch (error) {
    console.error('Error fetching subjects by branch:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching subjects'
    });
  }
});

// PUT /subject/:id - Update subject
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      code, 
      credits, 
      semester, 
      branchId, 
      description 
    }: CreateSubjectRequest = req.body;

    // Check if subject exists
    const existingSubject = await prisma.subject.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSubject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    // Validate required fields
    if (!name || !code || !semester || !branchId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, code, semester, branchId'
      });
    }

    // Validate semester range
    if (semester < 1 || semester > 8) {
      return res.status(400).json({
        success: false,
        error: 'Semester must be between 1 and 8'
      });
    }

    // Validate credits
    if (credits && (credits < 1 || credits > 10)) {
      return res.status(400).json({
        success: false,
        error: 'Credits must be between 1 and 10'
      });
    }

    // Check if branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        error: 'Branch not found'
      });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check for duplicate code (excluding current subject)
    if (cleanCode !== existingSubject.code) {
      const duplicateCode = await prisma.subject.findUnique({
        where: { code: cleanCode }
      });

      if (duplicateCode) {
        return res.status(409).json({
          success: false,
          error: 'Subject code already exists'
        });
      }
    }

    // Update the subject
    const updatedSubject = await prisma.subject.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        code: cleanCode,
        credits: credits || existingSubject.credits,
        semester,
        branchId,
        description: description?.trim()
      },
      include: {
        branch: {
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
      message: 'Subject updated successfully',
      data: {
        subject: updatedSubject
      }
    });

  } catch (error) {
    console.error('Error updating subject:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while updating subject'
    });
  }
});

// DELETE /subject/:id - Delete subject
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if subject exists
    const existingSubject = await prisma.subject.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            schedules: true
          }
        }
      }
    });

    if (!existingSubject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    // Check if subject has associated schedules
    if (existingSubject._count.schedules > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete subject. It has ${existingSubject._count.schedules} schedules associated with it.`,
        details: {
          scheduleCount: existingSubject._count.schedules
        }
      });
    }

    // Delete the subject
    await prisma.subject.delete({
      where: { id: parseInt(id) }
    });

    return res.status(200).json({
      success: true,
      message: 'Subject deleted successfully',
      data: {
        deletedSubject: {
          id: existingSubject.id,
          name: existingSubject.name,
          code: existingSubject.code
        }
      }
    });

  } catch (error) {
    console.error('Error deleting subject:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while deleting subject'
    });
  }
});

export { router as subjectRouter };