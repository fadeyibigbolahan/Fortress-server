const User = require("../models/User");
const Class = require("../models/Class");
const Examination = require("../models/Examination");

const getAdminDashboard = async () => {
  const [totalStudents, totalTeachers, totalClasses, totalExaminations] =
    await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "teacher" }),
      Class.countDocuments({ status: "active" }),
      Examination.countDocuments({}),
    ]);

  return {
    statistics: {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalExaminations,
    },
  };
};

module.exports = {
  getAdminDashboard,
};
