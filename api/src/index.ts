import 'dotenv/config';
import https from 'https';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { setScheduleRouter } from './routes/schedule/setSchedule';
import { registerStudentRouter } from './routes/student/registerStudent';
import { attendanceRouter } from './routes/attendance/attendance';
import { branchRouter } from './routes/branch/branch';
import { subjectRouter } from './routes/subject/subject';
import { reportsRouter } from './routes/reports/reports';
import { adminRouter } from './routes/admin/admin';
import { timetableRouter } from './routes/timetable/timetable';
// import {loginRouter, registerRouter} from './routes/auth/userAuth';
// import { sessionRouter } from './routes/sessions/manageSession';
// import { getSessionRouter } from './routes/sessions/sessionFetch';
// import projectsRouter from './routes/projects/projects';
// import recordingsRouter from './routes/recordings/recording';
// import editsRouter from './routes/edits/edits';
// import exportsRouter from './routes/exports/exports';
// import madeForYouRouter from './routes/madeForYou/madeForYou';

const app = express();
app.use(express.json());
app.use(cors());

// Schedule routes
app.use("/schedule", setScheduleRouter);

// Student routes
app.use("/student", registerStudentRouter);

// Attendance routes
app.use("/attendance", attendanceRouter);

// Branch routes
app.use("/branch", branchRouter);

// Subject routes
app.use("/subject", subjectRouter);

// Reports routes
app.use("/reports", reportsRouter);

// Admin routes
app.use("/admin", adminRouter);

// Timetable routes
app.use("/timetable", timetableRouter);

// app.use("/auth/login", loginRouter)
// app.use("/auth/register", registerRouter)
// app.use("/sessions", sessionRouter)
// app.use("/getsession", getSessionRouter);
// app.use("/project", projectsRouter);

//project subItems
// app.use("/recording", recordingsRouter);
// app.use("/madeforyou", madeForYouRouter);
// app.use("/edit", editsRouter);
// app.use("/export", exportsRouter);

// HTTPS server wraps the express app
// const httpsServer = https.createServer(
//     {
//         cert: fs.readFileSync('./certs/cert.pem'),
//         key: fs.readFileSync('./certs/key.pem'),
//     },
//     app
// );

app.listen(3003, () => {
    console.log('HTTP Express server running at http://localhost:3003');
});