import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Department } from '../models/department.model.js';
import { User, generateEmployeeCode } from '../models/user.model.js';
import { LeaveType } from '../models/leaveType.model.js';
import { Holiday } from '../models/holiday.model.js';
import { LeaveBalance } from '../models/leaveBalance.model.js';
import { ensureBalances } from '../services/leave.service.js';
import { ROLES } from '../config/constants.js';

export async function runSeed({ disconnect = true } = {}) {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(env.MONGODB_URI);
  }
  console.log('🌱  Seeding StaffSync…');

  // ── Departments ──────────────────────────────────────────────
  const deptData = [
    { name: 'Human Resources', code: 'HR', description: 'HR department' },
    { name: 'Engineering', code: 'ENG', description: 'Engineering department' },
    { name: 'Sales', code: 'SALES', description: 'Sales department' },
    { name: 'Finance', code: 'FIN', description: 'Finance department' },
  ];

  const depts = {};
  for (const d of deptData) {
    const dept = await Department.findOneAndUpdate({ code: d.code }, d, {
      upsert: true,
      returnDocument: 'after',
    });
    depts[d.code] = dept;
    console.log(`  ✅  Department: ${dept.name}`);
  }

  // ── Users ─────────────────────────────────────────────────────
  const userData = [
    {
      email: 'hr@staffsync.test',
      name: 'Alice HR',
      role: ROLES.HR,
      departmentCode: 'HR',
      designation: 'HR Manager',
    },
    {
      email: 'hr2@staffsync.test',
      name: 'Bob HR',
      role: ROLES.HR,
      departmentCode: 'HR',
      designation: 'HR Specialist',
    },
    {
      email: 'manager@staffsync.test',
      name: 'Carol Manager',
      role: ROLES.MANAGER,
      departmentCode: 'ENG',
      designation: 'Engineering Manager',
    },
    {
      email: 'employee1@staffsync.test',
      name: 'Dave Employee',
      role: ROLES.EMPLOYEE,
      departmentCode: 'ENG',
      designation: 'Software Engineer',
      managerEmail: 'manager@staffsync.test',
    },
    {
      email: 'employee2@staffsync.test',
      name: 'Eve Employee',
      role: ROLES.EMPLOYEE,
      departmentCode: 'ENG',
      designation: 'Frontend Engineer',
      managerEmail: 'manager@staffsync.test',
    },
    {
      email: 'employee3@staffsync.test',
      name: 'Frank Employee',
      role: ROLES.EMPLOYEE,
      departmentCode: 'SALES',
      designation: 'Sales Executive',
      // no manager — routes to HR pool
    },
    // ── Additional workforce for pagination & testing ──
    {
      email: 'grace.eng@staffsync.test',
      name: 'Grace Hopper',
      role: ROLES.EMPLOYEE,
      departmentCode: 'ENG',
      designation: 'DevOps Engineer',
      managerEmail: 'manager@staffsync.test',
    },
    {
      email: 'heidi.eng@staffsync.test',
      name: 'Heidi Stone',
      role: ROLES.EMPLOYEE,
      departmentCode: 'ENG',
      designation: 'Backend Architect',
      managerEmail: 'manager@staffsync.test',
    },
    {
      email: 'ian.eng@staffsync.test',
      name: 'Ian Wright',
      role: ROLES.EMPLOYEE,
      departmentCode: 'ENG',
      designation: 'QA Automation Engineer',
      managerEmail: 'manager@staffsync.test',
    },
    {
      email: 'sales.lead@staffsync.test',
      name: 'Sara Sales',
      role: ROLES.MANAGER,
      departmentCode: 'SALES',
      designation: 'Sales Director',
    },
    {
      email: 'judy.sales@staffsync.test',
      name: 'Judy Alvarez',
      role: ROLES.EMPLOYEE,
      departmentCode: 'SALES',
      designation: 'Senior Account Executive',
      managerEmail: 'sales.lead@staffsync.test',
    },
    {
      email: 'kevin.sales@staffsync.test',
      name: 'Kevin Flynn',
      role: ROLES.EMPLOYEE,
      departmentCode: 'SALES',
      designation: 'Enterprise Account Executive',
      managerEmail: 'sales.lead@staffsync.test',
    },
    {
      email: 'laura.sales@staffsync.test',
      name: 'Laura Croft',
      role: ROLES.EMPLOYEE,
      departmentCode: 'SALES',
      designation: 'Customer Success Manager',
      managerEmail: 'sales.lead@staffsync.test',
    },
    {
      email: 'finance.lead@staffsync.test',
      name: 'Felix Finance',
      role: ROLES.MANAGER,
      departmentCode: 'FIN',
      designation: 'Financial Controller',
    },
    {
      email: 'mike.fin@staffsync.test',
      name: 'Mike Ross',
      role: ROLES.EMPLOYEE,
      departmentCode: 'FIN',
      designation: 'Senior Accountant',
      managerEmail: 'finance.lead@staffsync.test',
    },
    {
      email: 'nina.fin@staffsync.test',
      name: 'Nina Simone',
      role: ROLES.EMPLOYEE,
      departmentCode: 'FIN',
      designation: 'Budget Analyst',
      managerEmail: 'finance.lead@staffsync.test',
    },
    {
      email: 'oscar.hr@staffsync.test',
      name: 'Oscar Martinez',
      role: ROLES.EMPLOYEE,
      departmentCode: 'HR',
      designation: 'Talent Acquisition Lead',
      managerEmail: 'hr@staffsync.test',
    },
    {
      email: 'peggy.hr@staffsync.test',
      name: 'Peggy Carter',
      role: ROLES.EMPLOYEE,
      departmentCode: 'HR',
      designation: 'People Operations Specialist',
      managerEmail: 'hr@staffsync.test',
    },
  ];

  for (const u of userData) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`  ⏭️   User already exists: ${u.email}`);
      continue;
    }

    let managerId = null;
    if (u.managerEmail) {
      const mgr = await User.findOne({ email: u.managerEmail });
      managerId = mgr?._id ?? null;
    }

    const code = await generateEmployeeCode();
    const newUser = new User({
      employeeCode: code,
      name: u.name,
      email: u.email,
      passwordHash: env.SEED_PASSWORD,
      role: u.role,
      department: depts[u.departmentCode]._id,
      designation: u.designation,
      manager: managerId,
      dateOfJoining: new Date(),
      status: 'active',
    });
    await newUser.save();
    console.log(`  ✅  User: ${u.email} (${u.role}) [${code}]`);
  }

  // ── Leave Types ──────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const leaveTypesData = [
    {
      name: 'Casual Leave',
      code: 'CASUAL',
      annualQuota: 12,
      isPaid: true,
      isUnlimited: false,
      isActive: true,
      description: 'Casual leave for personal or urgent matters',
    },
    {
      name: 'Sick Leave',
      code: 'SICK',
      annualQuota: 10,
      isPaid: true,
      isUnlimited: false,
      isActive: true,
      description: 'Leave for medical care and recovery',
    },
    {
      name: 'Earned Leave',
      code: 'EARNED',
      annualQuota: 15,
      isPaid: true,
      isUnlimited: false,
      isActive: true,
      description: 'Annual paid vacation/earned leave',
    },
    {
      name: 'Unpaid Leave',
      code: 'UNPAID',
      annualQuota: 0,
      isPaid: false,
      isUnlimited: true,
      isActive: true,
      description: 'Unpaid leave of absence',
    },
  ];

  for (const lt of leaveTypesData) {
    const doc = await LeaveType.findOneAndUpdate({ code: lt.code }, lt, {
      upsert: true,
      returnDocument: 'after',
    });
    console.log(`  ✅  Leave Type: ${doc.name} (${doc.code}) [quota: ${doc.annualQuota}]`);
  }

  // ── Holidays ──────────────────────────────────────────────────
  const holidayData = [
    { name: "New Year's Day", date: `${currentYear}-01-01` },
    { name: 'Republic Day', date: `${currentYear}-01-26` },
    { name: 'International Labor Day', date: `${currentYear}-05-01` },
    { name: 'Independence Day', date: `${currentYear}-08-15` },
    { name: 'Gandhi Jayanti', date: `${currentYear}-10-02` },
    { name: 'Christmas Day', date: `${currentYear}-12-25` },
  ];

  for (const h of holidayData) {
    const hol = await Holiday.findOneAndUpdate({ date: h.date }, h, {
      upsert: true,
      returnDocument: 'after',
    });
    console.log(`  ✅  Holiday: ${hol.name} on ${hol.date}`);
  }

  // ── Ensure Balances for all active users ────────────────────────
  const allActiveUsers = await User.find({ status: 'active' });
  for (const user of allActiveUsers) {
    await ensureBalances(user._id, currentYear);
  }
  console.log(`  ✅  Initialized leave balances for ${allActiveUsers.length} users for ${currentYear}`);

  console.log('\n🎉  Seed complete!');
  if (disconnect) {
    await mongoose.disconnect();
  }
}

const isMainModule = process.argv[1] && (
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) ||
  process.argv[1].endsWith('seed.js')
);

if (isMainModule) {
  runSeed().catch((err) => {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  });
}

