const mongoose = require("mongoose");

const academicSessionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Academic session name is required"],
      trim: true,
      unique: true,
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

// Validate date sequence
academicSessionSchema.pre("validate", function () {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    this.invalidate("endDate", "End date must be after the start date");
  }

  if (this.status === "active" && !this.isCurrent) {
    this.invalidate(
      "isCurrent",
      "An active academic session must be the current session",
    );
  }
});

// Only one current academic session
academicSessionSchema.index(
  { isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
  },
);

module.exports = mongoose.model("AcademicSession", academicSessionSchema);
