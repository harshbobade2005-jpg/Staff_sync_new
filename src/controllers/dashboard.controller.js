import { User } from '../models/user.model.js';
import { Department } from '../models/department.model.js';
import { LeaveRequest } from '../models/leaveRequest.model.js';
import { Holiday } from '../models/holiday.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Announcement } from '../models/announcement.model.js';
import { TrainingProgram } from '../models/trainingProgram.model.js';
import { TrainingEnrollment } from '../models/trainingEnrollment.model.js';
import { getLocalDateKey } from '../services/attendance.service.js';
import { ensureBalances } from '../services/leave.service.js';

export async function getDashboardData(req, res, next) {
  try {
    const user = req.user;
    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const currentYear = now.getFullYear();

    // Common data: Latest Announcements visible to user
    const announcements = await Announcement.find({
      publishAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      audience: { $in: ['all', user.role] },
    })
      .populate('createdBy', 'name')
      .sort({ isPinned: -1, publishAt: -1 })
      .limit(5)
      .lean();

    // Common data: Upcoming Holidays for current year
    const upcomingHolidays = await Holiday.find({
      date: { $gte: todayKey },
      year: currentYear,
    })
      .sort({ date: 1 })
      .limit(5)
      .lean();

    if (user.role === 'hr') {
      // 1. Employee metrics
      const [totalEmployees, activeEmployees, depts] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ status: 'active' }),
        Department.find().select('name _id').lean(),
      ]);

      // 2. Headcount by department
      const deptCounts = await User.aggregate([
        { $match: { status: 'active', department: { $ne: null } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]);
      const deptMap = {};
      depts.forEach((d) => {
        deptMap[d._id.toString()] = d.name;
      });
      const headcountByDepartment = deptCounts.map((dc) => ({
        department: deptMap[dc._id.toString()] || 'Unknown',
        count: dc.count,
      }));

      // 3. Today's attendance metrics
      const todayAttendance = await Attendance.find({ date: todayKey }).lean();
      const presentToday = todayAttendance.filter(
        (a) => a.status === 'present' || a.status === 'half-day'
      ).length;
      const lateToday = todayAttendance.filter((a) => a.isLate).length;

      // 4. On leave today & pending leaves
      const [leavesToday, pendingLeavesCount, leavesByStatus] = await Promise.all([
        LeaveRequest.countDocuments({
          status: 'approved',
          startDate: { $lte: todayKey },
          endDate: { $gte: todayKey },
        }),
        LeaveRequest.countDocuments({ status: 'pending' }),
        LeaveRequest.aggregate([
          {
            $match: {
              startDate: { $gte: `${currentYear}-01-01`, $lte: `${currentYear}-12-31` },
            },
          },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
      ]);

      const leaveRequestsByStatus = {
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
      };
      leavesByStatus.forEach((s) => {
        leaveRequestsByStatus[s._id] = s.count;
      });

      // 5. 30-day attendance trend
      const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgoKey = getLocalDateKey(thirtyDaysAgo);
      const pastAttendance = await Attendance.find({
        date: { $gte: thirtyDaysAgoKey, $lte: todayKey },
      }).lean();

      const attendanceByDate = {};
      pastAttendance.forEach((a) => {
        if (!attendanceByDate[a.date]) attendanceByDate[a.date] = 0;
        if (a.status === 'present' || a.status === 'half-day') {
          attendanceByDate[a.date]++;
        }
      });

      const attendanceRateTrend = [];
      const totalWorkforce = activeEmployees || 1;
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const k = getLocalDateKey(d);
        const presentCount = attendanceByDate[k] || 0;
        const rate = Math.min(100, Math.round((presentCount / totalWorkforce) * 100));
        attendanceRateTrend.push({ date: k, rate, present: presentCount });
      }

      // 6. Training completion rate
      const [allEnrollments, completedEnrollments] = await Promise.all([
        TrainingEnrollment.countDocuments(),
        TrainingEnrollment.countDocuments({ status: 'completed' }),
      ]);
      const trainingCompletionRate =
        allEnrollments > 0 ? Math.round((completedEnrollments / allEnrollments) * 100) : 0;

      return res.json({
        success: true,
        role: 'hr',
        data: {
          totalEmployees,
          activeEmployees,
          presentToday,
          lateToday,
          onLeaveToday: leavesToday,
          pendingLeaves: pendingLeavesCount,
          headcountByDepartment,
          leaveRequestsByStatus,
          attendanceRateTrend,
          upcomingHolidays,
          latestAnnouncements: announcements,
          trainingCompletionRate,
        },
      });
    }

    if (user.role === 'manager') {
      // 1. Direct reports
      const teamMembers = await User.find({ manager: user._id, status: 'active' }).select('_id name');
      const teamSize = teamMembers.length;
      const teamMemberIds = teamMembers.map((m) => m._id);

      // 2. Team attendance today
      const teamAttendance = await Attendance.find({
        user: { $in: teamMemberIds },
        date: todayKey,
      }).lean();

      const teamPresentToday = teamAttendance.filter(
        (a) => a.status === 'present' || a.status === 'half-day'
      ).length;
      const teamLateToday = teamAttendance.filter((a) => a.isLate).length;

      // 3. Team on leave today
      const teamOnLeaveToday = await LeaveRequest.countDocuments({
        user: { $in: teamMemberIds },
        status: 'approved',
        startDate: { $lte: todayKey },
        endDate: { $gte: todayKey },
      });

      // 4. Pending approvals assigned to this manager
      const pendingApprovals = await LeaveRequest.find({
        assignedTo: user._id,
        status: 'pending',
      })
        .populate('user', 'name employeeCode department')
        .populate('leaveType', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      // 5. Upcoming team trainings created by manager
      const upcomingTeamTrainings = await TrainingProgram.find({
        createdBy: user._id,
        status: { $in: ['scheduled', 'ongoing'] },
      })
        .sort({ startDate: 1 })
        .limit(5)
        .lean();

      return res.json({
        success: true,
        role: 'manager',
        data: {
          teamSize,
          teamPresentToday,
          teamLateToday,
          teamOnLeaveToday,
          pendingApprovals,
          upcomingTeamTrainings,
          latestAnnouncements: announcements,
          upcomingHolidays,
        },
      });
    }

    // Role: Employee
    // 1. Today's attendance
    const todayRecord = await Attendance.findOne({ user: user._id, date: todayKey }).lean();

    // 2. Leave balances
    const balances = await ensureBalances(user._id, currentYear);

    // 3. Next approved leave
    const nextApprovedLeave = await LeaveRequest.findOne({
      user: user._id,
      status: 'approved',
      startDate: { $gte: todayKey },
    })
      .populate('leaveType', 'name')
      .sort({ startDate: 1 })
      .lean();

    // 4. My upcoming trainings
    const myEnrollments = await TrainingEnrollment.find({
      user: user._id,
      status: { $in: ['enrolled', 'in_progress'] },
    })
      .populate('program')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return res.json({
      success: true,
      role: 'employee',
      data: {
        todayRecord,
        leaveBalances: balances,
        nextApprovedLeave,
        myUpcomingTrainings: myEnrollments,
        latestAnnouncements: announcements,
        upcomingHolidays,
      },
    });
  } catch (err) {
    next(err);
  }
}
