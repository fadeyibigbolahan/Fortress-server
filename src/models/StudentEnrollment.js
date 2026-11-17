const mongoose = require("mongoose");

const studentEnrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    enrollmentDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["active", "promoted", "repeated", "withdrawn"],
      default: "active",
    },

    previousEnrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentEnrollment",
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
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

// A student can only have one enrollment per academic session
studentEnrollmentSchema.index(
  { student: 1, academicSession: 1 },
  { unique: true },
);

studentEnrollmentSchema.index({
  class: 1,
  academicSession: 1,
  status: 1,
});

module.exports = mongoose.model("StudentEnrollment", studentEnrollmentSchema);
