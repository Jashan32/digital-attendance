import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface RegisterStudentRequest {
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
}

// POST /student/register - Register a new student
router.post('/register', async (req: Request, res: Response) => {
    try {
        const {
            name,
            rollNumber,
            email,
            phone,
            branchId,
            semester,
            fingerId,
            fingerPrintId,
            admissionYear,
            isActive = true
        }: RegisterStudentRequest = req.body;

        // Validate required fields
        if (!name || !rollNumber || !branchId || !semester || !fingerId || !admissionYear) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, rollNumber, branchId, semester, fingerId, admissionYear'
            });
        }

        // Validate semester range
        if (semester < 1 || semester > 8) {
            return res.status(400).json({
                success: false,
                error: 'Semester must be between 1 and 8'
            });
        }

        // Validate admission year (basic check - should be reasonable)
        const currentYear = new Date().getFullYear();
        if (admissionYear < (currentYear - 10) || admissionYear > currentYear) {
            return res.status(400).json({
                success: false,
                error: `Admission year must be between ${currentYear - 10} and ${currentYear}`
            });
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Validate phone format if provided (basic check for digits and length)
        if (phone && typeof phone === 'string' && !/^\d{10,15}$/.test(phone.replace(/[\s\-\(\)]/g, ''))) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format. Should be 10-15 digits.'
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

        // Check for duplicate roll number
        const existingRollNumber = await prisma.student.findUnique({
            where: { rollNumber }
        });

        if (existingRollNumber) {
            return res.status(409).json({
                success: false,
                error: 'Roll number already exists'
            });
        }

        // Check for duplicate finger ID
        const existingFingerprint = await prisma.student.findUnique({
            where: { fingerId }
        });

        if (existingFingerprint) {
            return res.status(409).json({
                success: false,
                error: 'Finger ID already exists'
            });
        }

        // Check for duplicate email if provided
        if (email) {
            const existingEmail = await prisma.student.findUnique({
                where: { email }
            });

            if (existingEmail) {
                return res.status(409).json({
                    success: false,
                    error: 'Email already exists'
                });
            }
        }

        // Create the student
        const newStudent = await prisma.student.create({
            data: {
                name: name.trim(),
                rollNumber: rollNumber.trim().toUpperCase(),
                email: email?.trim().toLowerCase(),
                phone: phone?.toString(),
                branchId,
                semester,
                fingerId,
                fingerPrintId: fingerPrintId?.toString(),
                admissionYear,
                isActive
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

        // Format response
        const response = {
            success: true,
            message: 'Student registered successfully',
            data: {
                student: {
                    id: newStudent.id,
                    name: newStudent.name,
                    rollNumber: newStudent.rollNumber,
                    email: newStudent.email,
                    phone: newStudent.phone,
                    branch: {
                        id: newStudent.branch.id,
                        name: newStudent.branch.name,
                        code: newStudent.branch.code
                    },
                    semester: newStudent.semester,
                    fingerId: newStudent.fingerId,
                    fingerPrintId: newStudent.fingerPrintId,
                    admissionYear: newStudent.admissionYear,
                    isActive: newStudent.isActive,
                    createdAt: newStudent.createdAt,
                    updatedAt: newStudent.updatedAt
                }
            }
        };

        return res.status(201).json(response);

    } catch (error) {
        console.error('Error registering student:', error);

        // Handle Prisma unique constraint errors
        if (error && typeof error === 'object' && 'code' in error) {
            const prismaError = error as any;
            if (prismaError.code === 'P2002') {
                const target = prismaError.meta?.target as string[];
                if (target?.includes('rollNumber')) {
                    return res.status(409).json({
                        success: false,
                        error: 'Roll number already exists'
                    });
                }
                if (target?.includes('fingerId')) {
                    return res.status(409).json({
                        success: false,
                        error: 'Finger ID already exists'
                    });
                }
                if (target?.includes('fingerPrintId')) {
                    return res.status(409).json({
                        success: false,
                        error: 'Fingerprint ID already exists'
                    });
                }
                if (target?.includes('email')) {
                    return res.status(409).json({
                        success: false,
                        error: 'Email already exists'
                    });
                }
            }
        }

        return res.status(500).json({
            success: false,
            error: 'Internal server error while registering student'
        });
    }
});

// GET /student/all - Get all students
router.get('/all', async (req: Request, res: Response) => {
    try {
        const {
            branchId,
            semester,
            isActive,
            page = 1,
            limit = 50,
            search
        } = req.query;

        // Build where clause
        const where: any = {};

        if (branchId) {
            where.branchId = parseInt(branchId as string);
        }

        if (semester) {
            where.semester = parseInt(semester as string);
        }

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { rollNumber: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        // Calculate pagination
        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 50;
        const skip = (pageNum - 1) * limitNum;

        // Get students with pagination
        const [students, totalCount] = await Promise.all([
            prisma.student.findMany({
                where,
                include: {
                    branch: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    }
                },
                orderBy: [
                    { branch: { name: 'asc' } },
                    { semester: 'asc' },
                    { rollNumber: 'asc' }
                ],
                skip,
                take: limitNum
            }),
            prisma.student.count({ where })
        ]);

        const totalPages = Math.ceil(totalCount / limitNum);

        return res.status(200).json({
            success: true,
            data: {
                students: students.map((student: any) => ({
                    id: student.id,
                    name: student.name,
                    rollNumber: student.rollNumber,
                    email: student.email,
                    phone: student.phone,
                    branch: student.branch,
                    semester: student.semester,
                    fingerPrintId: student.fingerPrintId,
                    admissionYear: student.admissionYear,
                    isActive: student.isActive,
                    createdAt: student.createdAt,
                    updatedAt: student.updatedAt
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
        console.error('Error fetching students:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while fetching students'
        });
    }
});

// GET /student/:id - Get student by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const student = await prisma.student.findUnique({
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
                attendances: {
                    include: {
                        timeSlot: {
                            include: {
                                subject: {
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
                    orderBy: { date: 'desc' },
                    take: 10 // Last 10 attendance records
                }
            }
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                student: {
                    id: student.id,
                    name: student.name,
                    rollNumber: student.rollNumber,
                    email: student.email,
                    phone: student.phone,
                    branch: student.branch,
                    semester: student.semester,
                    fingerPrintId: student.fingerPrintId,
                    admissionYear: student.admissionYear,
                    isActive: student.isActive,
                    createdAt: student.createdAt,
                    updatedAt: student.updatedAt,
                    recentAttendances: student.attendances.map((attendance: any) => ({
                        id: attendance.id,
                        date: attendance.date,
                        status: attendance.status,
                        checkInTime: attendance.checkInTime,
                        checkOutTime: attendance.checkOutTime,
                        subject: {
                            name: attendance.timeSlot ? attendance.timeSlot.subject.name : attendance.schedule?.subject.name,
                            code: attendance.timeSlot ? attendance.timeSlot.subject.code : attendance.schedule?.subject.code
                        },
                        markedBy: attendance.markedBy,
                        remarks: attendance.remarks
                    }))
                }
            }
        });

    } catch (error) {
        console.error('Error fetching student:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while fetching student'
        });
    }
});

// GET /student/fingerprint/:fingerId - Get student by finger ID
router.get('/fingerprint/:fingerId', async (req: Request, res: Response) => {
    try {
        const { fingerId } = req.params;

        const student = await prisma.student.findUnique({
            where: { fingerId: parseInt(fingerId) },
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

        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found with this finger ID'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                student: {
                    id: student.id,
                    name: student.name,
                    rollNumber: student.rollNumber,
                    email: student.email,
                    phone: student.phone,
                    branch: student.branch,
                    semester: student.semester,
                    fingerId: student.fingerId,
                    fingerPrintId: student.fingerPrintId,
                    admissionYear: student.admissionYear,
                    isActive: student.isActive,
                    createdAt: student.createdAt,
                    updatedAt: student.updatedAt
                }
            }
        });

    } catch (error) {
        console.error('Error fetching student by fingerprint:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error while fetching student'
        });
    }
});

export { router as registerStudentRouter };