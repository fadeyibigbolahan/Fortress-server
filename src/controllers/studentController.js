const studentService = require("../services/studentService");

// ========================================
// 1. CREATE STUDENT
// ========================================

const createStudent = async (req, res, next) => {
  try {
    const student = await studentService.createStudent(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Student registered successfully.",
      student,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 2. GET ALL STUDENTS
// ========================================

const getStudents = async (req, res, next) => {
  try {
    const result = await studentService.getStudents(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 3. GET STUDENT BY ID
// ========================================

const getStudentById = async (req, res, next) => {
  try {
    const student = await studentService.getStudentById(req.params.id);

    res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 4. UPDATE STUDENT
// ========================================

const updateStudent = async (req, res, next) => {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Student information updated successfully.",
      student,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 5. UPDATE STUDENT STATUS
// ========================================

const updateStudentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const student = await studentService.updateStudentStatus(
      req.params.id,
      status,
    );

    res.status(200).json({
      success: true,
      message: `Student status changed to ${status}.`,
      student,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// 6. STUDENT STATISTICS
// ========================================

const getStudentStatistics = async (req, res, next) => {
  try {
    const statistics = await studentService.getStudentStatistics();

    res.status(200).json({
      success: true,
      statistics,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  updateStudentStatus,
  getStudentStatistics,
};
