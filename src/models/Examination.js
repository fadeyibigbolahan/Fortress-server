const mongoose = require("mongoose");

// ========================================
// EXAMINATION QUESTION SNAPSHOT
// ========================================

const examOptionSchema = new mongoose.Schema(
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

    // Internal server-side field.
    // Never expose this field in student examination responses.
    isCorrect: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  { _id: false },
);

const examQuestionSchema = new mongoose.Schema(
  {
    originalQuestion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    questionType: {
      type: String,
      enum: ["objective", "theory"],
      required: true,
    },

    options: {
      type: [examOptionSchema],
      default: [],
    },

    // Internal marking guide. Never expose to students.
    markingGuide: {
      type: String,
      select: false,
    },

    marks: {
      type: Number,
      required: true,
      min: 0.5,
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
  },
  { _id: true },
);

// ========================================
// EXAMINATION SCHEMA
// ========================================

const examinationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 5000,
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

    questions: {
      type: [examQuestionSchema],
      validate: {
        validator: (questions) =>
          Array.isArray(questions) && questions.length > 0,
        message: "An examination must contain at least one question.",
      },
    },

    totalQuestions: {
      type: Number,
      default: 0,
      min: 1,
    },

    totalMarks: {
      type: Number,
      required: true,
      min: 0.5,
    },

    passMarks: {
      type: Number,
      required: true,
      min: 0,
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 600,
    },

    startAt: {
      type: Date,
      required: true,
    },

    endAt: {
      type: Date,
      required: true,
    },

    shuffleQuestions: {
      type: Boolean,
      default: true,
    },

    shuffleOptions: {
      type: Boolean,
      default: true,
    },

    allowBackNavigation: {
      type: Boolean,
      default: true,
    },

    // Controls whether students can start an attempt.
    status: {
      type: String,
      enum: ["draft", "published", "closed", "cancelled"],
      default: "draft",
    },

    // Results remain hidden until explicitly released.
    resultsReleased: {
      type: Boolean,
      default: false,
    },

    resultsReleasedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

examinationSchema.pre("validate", function () {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    this.invalidate(
      "endAt",
      "Examination end time must be later than its start time.",
    );
  }

  if (this.startAt && this.endAt && this.durationMinutes) {
    const availableMinutes =
      (this.endAt.getTime() - this.startAt.getTime()) / 60000;

    if (this.durationMinutes > availableMinutes) {
      this.invalidate(
        "durationMinutes",
        "Examination duration cannot exceed its availability window.",
      );
    }
  }

  if (this.passMarks > this.totalMarks) {
    this.invalidate(
      "passMarks",
      "Pass marks cannot exceed total examination marks.",
    );
  }

  if (this.questions?.length) {
    this.totalQuestions = this.questions.length;

    const calculatedTotal = this.questions.reduce(
      (sum, question) => sum + Number(question.marks || 0),
      0,
    );

    this.totalMarks = calculatedTotal;

    const questionIds = this.questions.map((question) =>
      question.originalQuestion.toString(),
    );

    if (new Set(questionIds).size !== questionIds.length) {
      this.invalidate(
        "questions",
        "The same question cannot be added more than once.",
      );
    }
  }

  if (this.resultsReleased && !this.resultsReleasedAt) {
    this.resultsReleasedAt = new Date();
  }
});

// ========================================
// INDEXES
// ========================================

examinationSchema.index({
  academicSession: 1,
  term: 1,
  schoolClass: 1,
  subject: 1,
});

examinationSchema.index({
  status: 1,
  startAt: 1,
  endAt: 1,
});

examinationSchema.index({
  createdBy: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Examination", examinationSchema);
