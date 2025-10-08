/*
  Warnings:

  - The primary key for the `attendances` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `attendances` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `scheduleId` column on the `attendances` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `timeSlotId` column on the `attendances` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `branches` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `branches` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `schedules` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `schedules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `students` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `students` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `subjects` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `subjects` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `time_slots` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `time_slots` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `timetables` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `timetables` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `studentId` on the `attendances` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `subjectId` on the `schedules` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `branchId` on the `students` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `branchId` on the `subjects` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `timetableId` on the `time_slots` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `subjectId` on the `time_slots` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `branchId` on the `timetables` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."attendances" DROP CONSTRAINT "attendances_scheduleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."attendances" DROP CONSTRAINT "attendances_studentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."attendances" DROP CONSTRAINT "attendances_timeSlotId_fkey";

-- DropForeignKey
ALTER TABLE "public"."schedules" DROP CONSTRAINT "schedules_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."students" DROP CONSTRAINT "students_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."subjects" DROP CONSTRAINT "subjects_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."time_slots" DROP CONSTRAINT "time_slots_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."time_slots" DROP CONSTRAINT "time_slots_timetableId_fkey";

-- DropForeignKey
ALTER TABLE "public"."timetables" DROP CONSTRAINT "timetables_branchId_fkey";

-- AlterTable
ALTER TABLE "attendances" DROP CONSTRAINT "attendances_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "studentId",
ADD COLUMN     "studentId" INTEGER NOT NULL,
DROP COLUMN "scheduleId",
ADD COLUMN     "scheduleId" INTEGER,
DROP COLUMN "timeSlotId",
ADD COLUMN     "timeSlotId" INTEGER,
ADD CONSTRAINT "attendances_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "branches" DROP CONSTRAINT "branches_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "subjectId",
ADD COLUMN     "subjectId" INTEGER NOT NULL,
ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "students" DROP CONSTRAINT "students_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "branchId",
ADD COLUMN     "branchId" INTEGER NOT NULL,
ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "branchId",
ADD COLUMN     "branchId" INTEGER NOT NULL,
ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "time_slots" DROP CONSTRAINT "time_slots_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "timetableId",
ADD COLUMN     "timetableId" INTEGER NOT NULL,
DROP COLUMN "subjectId",
ADD COLUMN     "subjectId" INTEGER NOT NULL,
ADD CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "timetables" DROP CONSTRAINT "timetables_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "branchId",
ADD COLUMN     "branchId" INTEGER NOT NULL,
ADD CONSTRAINT "timetables_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_studentId_timeSlotId_date_key" ON "attendances"("studentId", "timeSlotId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_studentId_scheduleId_date_key" ON "attendances"("studentId", "scheduleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_timetableId_dayOfWeek_startTime_key" ON "time_slots"("timetableId", "dayOfWeek", "startTime");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "timetables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
