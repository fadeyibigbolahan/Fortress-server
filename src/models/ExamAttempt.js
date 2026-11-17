const mongoose = require("mongoose");

// ========================================
// ATTEMPT OPTION SNAPSHOT
// ========================================

const attemptOptionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

// ========================================
// ATTEMPT QUESTION SNAPSHOT
// ========================================

const attemptQuestionSchema = new mongoose.Schema(
  {
    // References the question snapshot inside Examination.questions.
    examQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    questionText: {
      type: String,
      required: true,
    },

    questionType: {
      type: String,
      enum: ["objective", "theory"],
      required: true,
    },

    options: {
      type: [attemptOptionSchema],
      default: [],
    },

    marks: {
      type: Number,
      required: true,
      min: 0.5,
    },

    // Student's objective answer.
    selectedOptionId: {
      type: String,
      default: null,
    },

    // Student's theory answer.
    responseText: {
      type: String,
      default: "",
    },

    // Internal grading fields. Never expose these in student responses.
    awardedMarks: {
      type: Number,
      default: null,
      min: 0,
    },

    isCorrect: {
      type: Boolean,
      default: null,
    },

    gradingStatus: {
      type: String,
      enum: ["not_required", "pending", "graded"],
      default: "pending",
    },

    teacherFeedback: {
      type: String,
      default: "",
    },

    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    gradedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true },
);

// ========================================
// EXAMINATION ATTEMPT
// ========================================

const examAttemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    examination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Examination",
      required: true,
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

    questions: {
      type: [attemptQuestionSchema],
      required: true,
      validate: {
        validator: (questions) =>
          Array.isArray(questions) && questions.length > 0,
        message: "An examination attempt must contain questions.",
      },
    },

    startedAt: {
      type: Date,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["in_progress", "submitted", "auto_submitted"],
      default: "in_progress",
    },

    objectiveMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    theoryMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAwardedMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalPossibleMarks: {
      type: Number,
      required: true,
      min: 0.5,
    },

    gradingStatus: {
      type: String,
      enum: ["pending", "partially_graded", "graded"],
      default: "pending",
    },

    // Optional audit information.
    startedFromIp: {
      type: String,
      default: null,
    },

    submittedFromIp: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ========================================
// VALIDATION
// ========================================

examAttemptSchema.pre("validate", function () {
  if (this.expiresAt && this.startedAt && this.expiresAt <= this.startedAt) {
    this.invalidate(
      "expiresAt",
      "Attempt expiry must be later than its start time.",
    );
  }

  if (this.submittedAt && this.submittedAt < this.startedAt) {
    this.invalidate(
      "submittedAt",
      "Submission time cannot precede the attempt start time.",
    );
  }

  if (this.questions?.length) {
    const totalPossible = this.questions.reduce(
      (sum, question) => sum + Number(question.marks || 0),
      0,
    );

    if (totalPossible !== this.totalPossibleMarks) {
      this.totalPossibleMarks = totalPossible;
    }
  }
});

// ========================================
// INDEXES
// ========================================

// A student can have only one attempt for an examination.
examAttemptSchema.index(
  {
    student: 1,
    examination: 1,
  },
  {
    unique: true,
  },
);

// Useful for monitoring active attempts.
examAttemptSchema.index({
  examination: 1,
  status: 1,
});

// Useful for finding a student's examination history.
examAttemptSchema.index({
  student: 1,
  createdAt: -1,
});

// Useful for expiry processing.
examAttemptSchema.index({
  status: 1,
  expiresAt: 1,
});

module.exports = mongoose.model("ExamAttempt", examAttemptSchema);
