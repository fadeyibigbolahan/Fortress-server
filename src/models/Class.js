const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    level: {
      type: String,
      required: true,
      enum: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
    },

    arm: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "A",
    },

    capacity: {
      type: Number,
      default: 40,
      min: 1,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
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

// Prevent duplicate class arms
classSchema.index({ level: 1, arm: 1 }, { unique: true });

classSchema.index({ status: 1, level: 1 });

module.exports = mongoose.model("Class", classSchema);
