const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // =====================================
    // PERSONAL INFORMATION
    // =====================================

    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },

    middleName: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: undefined,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: undefined,
    },

    // =====================================
    // AUTHENTICATION INFORMATION
    // =====================================

    username: {
      type: String,
      trim: true,
      lowercase: true,
      default: undefined,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must contain at least 8 characters"],
      select: false,
    },

    // =====================================
    // USER ROLE
    // =====================================

    role: {
      type: String,
      required: true,
      enum: ["admin", "teacher", "student", "exam_officer"],
    },

    // =====================================
    // SCHOOL IDENTIFICATION
    // =====================================

    admissionNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },

    staffId: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },

    // =====================================
    // STUDENT INFORMATION
    // =====================================

    currentClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },

    // =====================================
    // ACCOUNT MANAGEMENT
    // =====================================

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },

    // =====================================
    // LOGIN SECURITY
    // =====================================

    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    lockUntil: {
      type: Date,
      default: null,
      select: false,
    },

    // =====================================
    // ACCOUNT CREATION
    // =====================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.failedLoginAttempts;
        delete ret.lockUntil;
        return ret;
      },
    },
  },
);

// =====================================
// ROLE-SPECIFIC VALIDATION
// =====================================

userSchema.pre("validate", function () {
  if (this.role === "admin" && !this.username) {
    this.invalidate("username", "Admin username is required");
  }

  if (this.role === "student" && !this.admissionNumber) {
    this.invalidate("admissionNumber", "Student admission number is required");
  }

  if (["teacher", "exam_officer"].includes(this.role) && !this.staffId) {
    this.invalidate("staffId", "Staff ID is required");
  }
});

// =====================================
// PASSWORD HASHING
// =====================================

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
});

// =====================================
// PASSWORD COMPARISON
// =====================================

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// =====================================
// DATABASE INDEXES
// =====================================

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  },
);

userSchema.index(
  { username: 1 },
  {
    unique: true,
    partialFilterExpression: { username: { $type: "string" } },
  },
);

userSchema.index(
  { admissionNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      admissionNumber: { $type: "string" },
    },
  },
);

userSchema.index(
  { staffId: 1 },
  {
    unique: true,
    partialFilterExpression: { staffId: { $type: "string" } },
  },
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ currentClass: 1 });

const User = mongoose.model("User", userSchema);

module.exports = User;
