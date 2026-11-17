const mongoose = require("mongoose");

const termSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ["First Term", "Second Term", "Third Term"],
    },

    termNumber: {
      type: Number,
      required: true,
      enum: [1, 2, 3],
    },

    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["upcoming", "active", "completed"],
      default: "upcoming",
    },

    isCurrent: {
      type: Boolean,
      default: false,
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

termSchema.pre("validate", function () {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    this.invalidate("endDate", "Term end date must be after its start date");
  }

  if (this.status === "active" && !this.isCurrent) {
    this.invalidate("isCurrent", "An active term must be the current term");
  }
});

// Prevent duplicate terms within the same session
termSchema.index({ academicSession: 1, termNumber: 1 }, { unique: true });

// Only one current term across the school
termSchema.index(
  { isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
  },
);

termSchema.index({ academicSession: 1, status: 1 });

module.exports = mongoose.model("Term", termSchema);
