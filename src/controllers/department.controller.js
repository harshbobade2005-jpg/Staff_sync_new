import { Department } from '../models/department.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';

export async function listDepartments(_req, res) {
  const departments = await Department.find()
    .populate('head', 'name email employeeCode designation')
    .sort({ name: 1 })
    .lean();

  // Attach employee count to each department
  const counts = await User.aggregate([
    { $match: { department: { $ne: null } } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);

  const countMap = counts.reduce((acc, curr) => {
    acc[curr._id.toString()] = curr.count;
    return acc;
  }, {});

  const data = departments.map((d) => ({
    ...d,
    employeeCount: countMap[d._id.toString()] || 0,
  }));

  res.json({ success: true, data });
}

export async function getDepartment(req, res) {
  const department = await Department.findById(req.params.id)
    .populate('head', 'name email employeeCode designation')
    .lean();

  if (!department) throw ApiError.notFound('Department not found');

  const employeeCount = await User.countDocuments({ department: department._id });

  res.json({ success: true, data: { ...department, employeeCount } });
}

export async function createDepartment(req, res) {
  const { name, code, description, head } = req.validated;

  const existing = await Department.findOne({
    $or: [{ code }, { name }],
  });

  if (existing) {
    if (existing.code === code) throw ApiError.conflict(`Department code '${code}' is already in use`);
    throw ApiError.conflict(`Department name '${name}' is already in use`);
  }

  const department = await Department.create({
    name,
    code,
    description,
    head: head || null,
  });

  res.status(201).json({ success: true, data: department });
}

export async function updateDepartment(req, res) {
  const { name, code, description, head } = req.validated;

  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');

  if (code && code !== department.code) {
    const existingCode = await Department.findOne({ code });
    if (existingCode) throw ApiError.conflict(`Department code '${code}' is already in use`);
    department.code = code;
  }

  if (name && name !== department.name) {
    const existingName = await Department.findOne({ name });
    if (existingName) throw ApiError.conflict(`Department name '${name}' is already in use`);
    department.name = name;
  }

  if (description !== undefined) department.description = description;
  if (head !== undefined) department.head = head || null;

  await department.save();

  res.json({ success: true, data: department });
}

export async function deleteDepartment(req, res) {
  const department = await Department.findById(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');

  // Check if any employees belong to this department
  const userCount = await User.countDocuments({ department: department._id });
  if (userCount > 0) {
    throw ApiError.conflict('Cannot delete department with active employees. Reassign employees first.');
  }

  await Department.findByIdAndDelete(department._id);

  res.json({ success: true, message: 'Department deleted successfully' });
}
