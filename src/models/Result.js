const mongoose = require("mongoose");

const ResultSchema = new mongoose.Schema(
  {
    attempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamAttempt",
      required: true,
      unique: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    examination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Examination",
      required: true,
      index: true,
    },

    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },

    term: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
      required: true,
    },

    schoolClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    // How the examination was graded.
    gradingMode: {
      type: String,
      enum: ["automatic", "manual", "mixed"],
      required: true,
    },

    objectiveMarks: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    theoryMarks: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    totalAwardedMarks: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    totalPossibleMarks: {
      type: Number,
      required: true,
      min: 0,
    },

    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    passMarks: {
      type: Number,
      required: true,
      min: 0,
    },

    isPassed: {
      type: Boolean,
      default: false,
    },

    gradingStatus: {
      type: String,
      enum: ["pending_review", "approved", "released"],
      default: "pending_review",
      index: true,
    },

    // Teachers who participated in grading.
    gradedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    releasedAt: {
      type: Date,
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// One result per examination attempt.
ResultSchema.index({ attempt: 1 }, { unique: true });

// Result management and reporting.
ResultSchema.index({
  examination: 1,
  schoolClass: 1,
  gradingStatus: 1,
});

ResultSchema.index({
  student: 1,
  academicSession: 1,
  term: 1,
});

// Calculate percentage and pass/fail automatically.
// Calculate percentage and pass/fail automatically.
ResultSchema.pre("validate", function () {
  if (this.totalAwardedMarks > this.totalPossibleMarks) {
    throw new Error("Awarded marks cannot exceed total possible marks.");
  }

  if (this.passMarks > this.totalPossibleMarks) {
    throw new Error("Pass marks cannot exceed total possible marks.");
  }

  if (this.totalPossibleMarks > 0) {
    this.percentage = Number(
      ((this.totalAwardedMarks / this.totalPossibleMarks) * 100).toFixed(2),
    );
  } else {
    this.percentage = 0;
  }

  this.isPassed = this.totalAwardedMarks >= this.passMarks;

  // Approved or released results must have approval details.
  if (["approved", "released"].includes(this.gradingStatus)) {
    if (!this.approvedBy || !this.approvedAt) {
      throw new Error("Approved results must have approval details.");
    }
  }

  // Released results must have publication details.
  if (this.gradingStatus === "released") {
    if (!this.releasedBy || !this.releasedAt) {
      throw new Error("Released results must have release details.");
    }
  }
});

module.exports = mongoose.model("Result", ResultSchema);
