const mongoose = require("mongoose");

const teacherAssignmentSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// One teacher responsible for a subject in a class
// during a particular academic session.
teacherAssignmentSchema.index(
  {
    subject: 1,
    class: 1,
    academicSession: 1,
  },
  { unique: true },
);

teacherAssignmentSchema.index({
  teacher: 1,
  academicSession: 1,
  status: 1,
});

teacherAssignmentSchema.index({
  class: 1,
  academicSession: 1,
});

module.exports = mongoose.model("TeacherAssignment", teacherAssignmentSchema);
