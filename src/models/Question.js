const mongoose = require("mongoose");

const questionOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

const questionSchema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    classLevel: {
      type: String,
      required: true,
      enum: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
    },

    topic: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    subtopic: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    questionType: {
      type: String,
      required: true,
      enum: ["objective", "theory"],
    },

    options: {
      type: [questionOptionSchema],
      default: [],
    },

    // Used for theory questions.
    markingGuide: {
      type: String,
      trim: true,
    },

    // Optional explanation for objective questions.
    explanation: {
      type: String,
      trim: true,
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

    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
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
// QUESTION VALIDATION
// ========================================

questionSchema.pre("validate", function () {
  if (this.questionType === "objective") {
    if (!Array.isArray(this.options) || this.options.length < 2) {
      this.invalidate(
        "options",
        "Objective questions must have at least two options.",
      );
      return;
    }

    if (this.options.length > 6) {
      this.invalidate(
        "options",
        "Objective questions cannot have more than six options.",
      );
      return;
    }

    const correctOptions = this.options.filter(
      (option) => option.isCorrect === true,
    );

    if (correctOptions.length !== 1) {
      this.invalidate(
        "options",
        "An objective question must have exactly one correct option.",
      );
    }

    const emptyOption = this.options.some(
      (option) => !option.text || !option.text.trim(),
    );

    if (emptyOption) {
      this.invalidate("options", "Every objective option must contain text.");
    }
  }

  if (this.questionType === "theory" && this.options.length > 0) {
    this.invalidate(
      "options",
      "Theory questions must not contain multiple-choice options.",
    );
  }

  if (!Number.isFinite(this.marks) || this.marks <= 0) {
    this.invalidate("marks", "Question marks must be greater than zero.");
  }
});

// ========================================
// INDEXES
// ========================================

questionSchema.index({
  subject: 1,
  classLevel: 1,
  status: 1,
});

questionSchema.index({
  questionType: 1,
  difficulty: 1,
});

questionSchema.index({
  createdBy: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Question", questionSchema);
