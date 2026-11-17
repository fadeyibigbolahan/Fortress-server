require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../src/models/User");

const seedAdmin = async () => {
  try {
    if (
      !process.env.MONGO_URI ||
      !process.env.ADMIN_USERNAME ||
      !process.env.ADMIN_PASSWORD
    ) {
      throw new Error(
        "MONGO_URI, ADMIN_USERNAME and ADMIN_PASSWORD are required.",
      );
    }

    if (process.env.ADMIN_PASSWORD.length < 12) {
      throw new Error("Admin password must contain at least 12 characters.");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("Database connected.");

    // Prevent duplicate administrator creation
    const existingAdmin = await User.findOne({
      role: "admin",
    });

    if (existingAdmin) {
      console.log("An administrator already exists. Seeder stopped.");
      return;
    }

    const admin = await User.create({
      firstName: process.env.ADMIN_FIRST_NAME || "School",
      lastName: process.env.ADMIN_LAST_NAME || "Administrator",
      username: process.env.ADMIN_USERNAME,
      email: process.env.ADMIN_EMAIL || undefined,
      password: process.env.ADMIN_PASSWORD,
      role: "admin",
      status: "active",
    });

    console.log("Administrator created successfully.");
    console.log(`Username: ${admin.username}`);
  } catch (error) {
    console.error("Admin seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedAdmin();
