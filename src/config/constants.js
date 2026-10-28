export const ROLES = Object.freeze({
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
});

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

export const LEAVE_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

export const ATTENDANCE_STATUS = Object.freeze({
  PRESENT: 'present',
  HALF_DAY: 'half-day',
  ABSENT: 'absent',
});

export const APPROVER_ROLE = Object.freeze({
  MANAGER: 'manager',
  HR: 'hr',
});
