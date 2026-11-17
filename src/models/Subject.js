const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
    },

    code: {
      type: String,
      required: [true, "Subject code is required"],
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    levels: {
      type: [
        {
          type: String,
          enum: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
        },
      ],
      required: true,
      validate: {
        validator: (levels) => levels.length > 0,
        message: "At least one class level must be selected.",
      },
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

// Prevent duplicate subject codes
subjectSchema.index({ code: 1 }, { unique: true });

// Support subject searches by name
subjectSchema.index({ name: 1 });

subjectSchema.index({ status: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
