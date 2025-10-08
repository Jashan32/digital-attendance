import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface CreateBranchRequest {
  name: string;
  code: string;
  description?: string;
}

// POST /branch/create - Create a new branch/department
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { name, code, description }: CreateBranchRequest = req.body;

    // Validate required fields
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, code'
      });
    }

    // Validate code format (should be short and uppercase)
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 2 || cleanCode.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Branch code must be between 2 and 10 characters'
      });
    }

    // Check for duplicate name
    const existingName = await prisma.branch.findUnique({
      where: { name: name.trim() }
    });

    if (existingName) {
      return res.status(409).json({
        success: false,
        error: 'Branch name already exists'
      });
    }

    // Check for duplicate code
    const existingCode = await prisma.branch.findUnique({
      where: { code: cleanCode }
    });

    if (existingCode) {
      return res.status(409).json({
        success: false,
        error: 'Branch code already exists'
      });
    }

    // Create the branch
    const newBranch = await prisma.branch.create({
      data: {
        name: name.trim(),
        code: cleanCode,
        description: description?.trim()
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      data: {
        branch: newBranch
      }
    });

  } catch (error) {
    console.error('Error creating branch:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while creating branch'
    });
  }
});

// GET /branch/all - Get all branches
router.get('/all', async (req: Request, res: Response) => {
  try {
    const { 
      includeStats = false,
      search 
    } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const branches = await prisma.branch.findMany({
      where,
      include: includeStats === 'true' ? {
        _count: {
          select: {
            students: true,
            subjects: true
          }
        }
      } : undefined,
      orderBy: { name: 'asc' }
    });

    return res.status(200).json({
      success: true,
      data: {
        branches: branches.map((branch: any) => ({
          id: branch.id,
          name: branch.name,
          code: branch.code,
          description: branch.description,
          createdAt: branch.createdAt,
          updatedAt: branch.updatedAt,
          ...(includeStats === 'true' && {
            stats: {
              studentCount: branch._count?.students || 0,
              subjectCount: branch._count?.subjects || 0
            }
          })
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching branches:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching branches'
    });
  }
});

// GET /branch/:id - Get branch by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            students: true,
            subjects: true
          }
        },
        students: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
            semester: true,
            isActive: true
          },
          orderBy: [
            { semester: 'asc' },
            { rollNumber: 'asc' }
          ]
        },
        subjects: {
          select: {
            id: true,
            name: true,
            code: true,
            credits: true,
            semester: true
          },
          orderBy: [
            { semester: 'asc' },
            { name: 'asc' }
          ]
        }
      }
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        error: 'Branch not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        branch: {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          description: branch.description,
          createdAt: branch.createdAt,
          updatedAt: branch.updatedAt,
          stats: {
            studentCount: branch._count.students,
            subjectCount: branch._count.subjects
          },
          students: branch.students,
          subjects: branch.subjects
        }
      }
    });

  } catch (error) {
    console.error('Error fetching branch:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching branch'
    });
  }
});

// PUT /branch/:id - Update branch
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description }: CreateBranchRequest = req.body;

    // Check if branch exists
    const existingBranch = await prisma.branch.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingBranch) {
      return res.status(404).json({
        success: false,
        error: 'Branch not found'
      });
    }

    // Validate required fields
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, code'
      });
    }

    const cleanCode = code.trim().toUpperCase();
    
    // Check for duplicate name (excluding current branch)
    if (name.trim() !== existingBranch.name) {
      const duplicateName = await prisma.branch.findUnique({
        where: { name: name.trim() }
      });

      if (duplicateName) {
        return res.status(409).json({
          success: false,
          error: 'Branch name already exists'
        });
      }
    }

    // Check for duplicate code (excluding current branch)
    if (cleanCode !== existingBranch.code) {
      const duplicateCode = await prisma.branch.findUnique({
        where: { code: cleanCode }
      });

      if (duplicateCode) {
        return res.status(409).json({
          success: false,
          error: 'Branch code already exists'
        });
      }
    }

    // Update the branch
    const updatedBranch = await prisma.branch.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        code: cleanCode,
        description: description?.trim()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Branch updated successfully',
      data: {
        branch: updatedBranch
      }
    });

  } catch (error) {
    console.error('Error updating branch:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while updating branch'
    });
  }
});

// DELETE /branch/:id - Delete branch
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if branch exists
    const existingBranch = await prisma.branch.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            students: true,
            subjects: true
          }
        }
      }
    });

    if (!existingBranch) {
      return res.status(404).json({
        success: false,
        error: 'Branch not found'
      });
    }

    // Check if branch has associated students or subjects
    if (existingBranch._count.students > 0 || existingBranch._count.subjects > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete branch. It has ${existingBranch._count.students} students and ${existingBranch._count.subjects} subjects associated with it.`,
        details: {
          studentCount: existingBranch._count.students,
          subjectCount: existingBranch._count.subjects
        }
      });
    }

    // Delete the branch
    await prisma.branch.delete({
      where: { id: parseInt(id) }
    });

    return res.status(200).json({
      success: true,
      message: 'Branch deleted successfully',
      data: {
        deletedBranch: {
          id: existingBranch.id,
          name: existingBranch.name,
          code: existingBranch.code
        }
      }
    });

  } catch (error) {
    console.error('Error deleting branch:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while deleting branch'
    });
  }
});

export { router as branchRouter };